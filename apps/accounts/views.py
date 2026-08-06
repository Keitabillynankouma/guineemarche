from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone


class OTPRateThrottle(SimpleRateThrottle):
    """5 tentatives par heure par IP sur les endpoints OTP."""
    scope = 'otp'
    rate  = '5/hour'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class LoginRateThrottle(AnonRateThrottle):
    """10 tentatives par heure par IP sur le login."""
    scope = 'login'
    rate  = '10/hour'

from .models import User, OTPCode, Subscription, Badge, Shop, Referral
from .serializers import (
    RegisterSerializer, EmailRegisterSerializer,
    VerifyOTPSerializer, VerifyEmailOTPSerializer,
    LoginSerializer,
    UserSerializer, UserProfileSerializer, ChangePasswordSerializer,
    SubscriptionSerializer, BadgeSerializer, ShopSerializer, AdminShopSerializer,
)
from core.permissions import IsAdmin


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Traitement du parrainage
        ref_code = request.data.get('referral_code', '').strip().upper()
        if ref_code:
            try:
                referrer = User.objects.get(referral_code=ref_code)
                if referrer.id != user.id:
                    user.referred_by = referrer
                    user.save(update_fields=['referred_by'])
                    Referral.objects.get_or_create(referrer=referrer, referred=user)
                    # La récompense est déclenchée lors de la 1ère commande payée du filleul
            except User.DoesNotExist:
                pass  # code invalide, on ignore silencieusement
            except Exception:
                pass  # IntegrityError sur double-inscription — on ignore

        return Response({
            'message': 'Compte créé. Vérifiez votre code OTP.',
            'phone_number': str(user.phone_number),
        }, status=status.HTTP_201_CREATED)


class EmailRegisterView(APIView):
    """Inscription diaspora — email + mot de passe, OTP envoyé par email."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        serializer = EmailRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Parrainage éventuel
        ref_code = request.data.get('referral_code', '').strip().upper()
        if ref_code:
            try:
                referrer = User.objects.get(referral_code=ref_code)
                if referrer.id != user.id:
                    user.referred_by = referrer
                    user.save(update_fields=['referred_by'])
                    Referral.objects.get_or_create(referrer=referrer, referred=user)
                    # La récompense est déclenchée lors de la 1ère commande payée du filleul
            except User.DoesNotExist:
                pass
            except Exception:
                pass  # IntegrityError sur double-inscription — on ignore

        return Response({
            'message': 'Compte créé. Vérifiez votre email pour le code OTP.',
            'email': user.email,
        }, status=status.HTTP_201_CREATED)


class VerifyEmailOTPView(APIView):
    """Vérifie l'OTP reçu par email et active le compte diaspora."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        serializer = VerifyEmailOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        otp  = serializer.validated_data['otp']

        otp.is_used = True
        otp.save(update_fields=['is_used'])

        user.is_verified = True
        user.save(update_fields=['is_verified'])

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Email vérifié. Bienvenue sur Guimatrix !',
            'tokens': tokens,
            'user': UserSerializer(user).data,
        })


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        otp  = serializer.validated_data['otp']

        # Marquer l'OTP comme utilisé
        otp.is_used = True
        otp.save(update_fields=['is_used'])

        # Vérifier le compte si c'est pour l'inscription
        if otp.purpose == OTPCode.Purpose.REGISTER:
            user.is_verified = True
            user.save(update_fields=['is_verified'])

        # SÉCURITÉ : pour RESET_PASSWORD, ne pas retourner de tokens JWT complets.
        # Le frontend utilise le ResetPasswordView directement avec le code SMS.
        if otp.purpose == OTPCode.Purpose.RESET_PASSWORD:
            return Response({
                'message': 'Code vérifié. Vous pouvez maintenant réinitialiser votre mot de passe.',
                'verified': True,
            })

        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Vérification réussie.',
            'tokens': tokens,
            'user': UserSerializer(user).data,
        })


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user   = serializer.validated_data['user']
        tokens = get_tokens_for_user(user)
        return Response({
            'tokens': tokens,
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({'message': 'Déconnexion réussie.'})


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = UserSerializer

    def get_object(self):
        user = self.request.user
        # Créer les objets manquants pour les utilisateurs antérieurs à la migration
        from apps.accounts.models import Subscription, UserProfile
        UserProfile.objects.get_or_create(user=user)
        Subscription.objects.get_or_create(user=user)
        return user


class RegisterFCMTokenView(APIView):
    """
    PATCH /accounts/me/fcm-token/
    Enregistre ou met à jour le token FCM de l'appareil courant.
    Appelé par le frontend après avoir obtenu le token via Firebase SDK.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        token = str(request.data.get('fcm_token', '')).strip()
        if not token:
            return Response({'error': 'fcm_token requis.'}, status=400)
        request.user.fcm_token = token
        request.user.save(update_fields=['fcm_token'])
        return Response({'message': 'Token FCM enregistré.'})


class LivreurToggleAvailabilityView(APIView):
    """Livreur : bascule son propre statut disponible/indisponible."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'livreur':
            return Response({'error': 'Réservé aux livreurs.'}, status=403)
        user.is_available = not user.is_available
        user.save(update_fields=['is_available', 'updated_at'])
        return Response({
            'is_available': user.is_available,
            'message': 'Vous êtes maintenant disponible.' if user.is_available else 'Vous êtes maintenant indisponible.',
        })


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'message': 'Mot de passe modifié avec succès.'})


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        from core.utils import generate_otp, otp_expiry
        from core.sms import send_otp_sms
        phone_number = request.data.get('phone_number')
        purpose      = request.data.get('purpose', OTPCode.Purpose.REGISTER)

        try:
            user = User.objects.get(phone_number=phone_number)
        except User.DoesNotExist:
            return Response(
                {'error': 'Utilisateur introuvable.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Invalider tous les OTPs précédents non utilisés pour ce purpose
        OTPCode.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)

        code = generate_otp()
        OTPCode.objects.create(
            user=user,
            code=code,
            purpose=purpose,
            expires_at=otp_expiry(minutes=10)
        )
        send_otp_sms(str(user.phone_number), code)
        return Response({'message': 'Nouveau code envoyé.'})


class ForgotPasswordView(APIView):
    """POST /auth/forgot-password/ — envoie un OTP via SMS (phone_number) ou email."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        from core.utils import generate_otp, otp_expiry
        from core.sms import send_otp_sms
        from core.email_notifications import send_otp_email as _send_otp_email
        from .models import User, OTPCode

        phone_number = request.data.get('phone_number', '').strip()
        email        = request.data.get('email', '').strip().lower()

        if not phone_number and not email:
            return Response({'error': 'Numéro de téléphone ou adresse email requis.'}, status=400)

        # Recherche de l'utilisateur
        user = None
        if phone_number:
            try:
                user = User.objects.get(phone_number=phone_number)
            except User.DoesNotExist:
                return Response({'message': 'Si ce numéro est enregistré, vous recevrez un code par SMS.'})
        else:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return Response({'message': 'Si cette adresse est enregistrée, vous recevrez un code par email.'})

        # Invalider tous les OTPs de reset précédents non utilisés
        OTPCode.objects.filter(user=user, purpose=OTPCode.Purpose.RESET_PASSWORD, is_used=False).update(is_used=True)

        code = generate_otp()
        OTPCode.objects.create(
            user=user,
            code=code,
            purpose=OTPCode.Purpose.RESET_PASSWORD,
            expires_at=otp_expiry(minutes=10),
        )

        if phone_number:
            send_otp_sms(str(user.phone_number), code)
            return Response({'message': 'Code de vérification envoyé par SMS.'})
        else:
            _send_otp_email(user.email, code, user.full_name or '')
            return Response({'message': 'Code de vérification envoyé par email.'})


class ResetPasswordView(APIView):
    """POST /auth/reset-password/ — vérifie l'OTP (SMS ou email) et définit le nouveau mot de passe."""
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [OTPRateThrottle]

    def post(self, request):
        from .models import User, OTPCode

        phone_number = request.data.get('phone_number', '').strip()
        email        = request.data.get('email', '').strip().lower()
        code         = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not (phone_number or email) or not code or not new_password:
            return Response({'error': 'Tous les champs sont requis.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({'error': 'Le mot de passe doit contenir au moins 6 caractères.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(phone_number=phone_number) if phone_number else User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Utilisateur introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        otp = OTPCode.objects.filter(
            user=user,
            code=code,
            purpose=OTPCode.Purpose.RESET_PASSWORD,
            is_used=False,
            expires_at__gt=timezone.now(),
        ).last()

        if not otp:
            return Response({'error': 'Code invalide ou expiré.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save(update_fields=['is_used'])

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'})


# Prix Pro par durée (GNF)
PRO_PRICES = {1: 40_000, 3: 105_000, 6: 190_000, 12: 350_000}


class SubscriptionRateThrottle(SimpleRateThrottle):
    """10 demandes par heure par utilisateur sur l'endpoint abonnement."""
    scope = 'subscription'
    rate  = '10/hour'

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.id)}


class SubscriptionView(APIView):
    """
    GET  — statut de l'abonnement.
    POST — paiement réel + activation automatique du plan Pro.
    Body: { months: 1|3|6|12, provider: 'orange_money'|'cash', phone: '...' }
    """
    permission_classes  = [permissions.IsAuthenticated]
    throttle_classes    = [SubscriptionRateThrottle]

    def get(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        return Response(SubscriptionSerializer(sub).data)

    def post(self, request):
        from apps.orders.payment_service import initiate_orange_money
        from apps.orders.models import Payment
        from dateutil.relativedelta import relativedelta
        import uuid as _uuid

        months   = int(request.data.get('months', 1))
        provider = request.data.get('provider', Payment.Provider.ORANGE_MONEY)
        phone    = request.data.get('phone', '')

        if months not in PRO_PRICES:
            return Response({'error': 'Durée invalide. Choisissez 1, 3, 6 ou 12 mois.'}, status=400)

        amount = PRO_PRICES[months]

        # ── Paiement Orange Money (initiation immédiate) ──────────────────────
        if provider == Payment.Provider.ORANGE_MONEY:
            if not phone:
                return Response({'error': 'Numéro de téléphone requis pour Orange Money.'}, status=400)

            # SÉCURITÉ : n'activer Pro qu'après un VRAI paiement confirmé.
            # Sans ORANGE_MONEY_API_KEY, la fonction simule toujours success=True,
            # ce qui permettrait d'obtenir Pro gratuitement.
            # → Si pas de clé configurée, traiter comme paiement manuel (admin valide).
            from django.conf import settings as _settings
            om_key = getattr(_settings, 'ORANGE_MONEY_API_KEY', '').strip()
            if not om_key:
                # Simulation / pas de clé → flux manuel identique aux autres providers
                ref = f'SUB-OM-{request.user.id}-{_uuid.uuid4().hex[:8].upper()}'
                try:
                    admins = User.objects.filter(
                        role__in=['admin', 'super_admin', 'admin_accounting'], is_active=True
                    )
                    for adm in admins[:3]:
                        from apps.notifications.models import Notification as _N
                        _N.send(
                            user=adm,
                            type=_N.Type.ORDER_UPDATE,
                            title='💳 Demande abonnement Pro (OM)',
                            body=f'{request.user.full_name} souhaite {months} mois Pro ({amount:,} GNF) '
                                 f'via Orange Money. Réf : {ref}. Vérifiez le virement puis activez.',
                            data={'user_id': str(request.user.id), 'months': months, 'ref': ref},
                        )
                except Exception:
                    pass
                sub, _ = Subscription.objects.get_or_create(user=request.user)
                return Response({
                    'message': (
                        f'Demande reçue (réf : {ref}). Votre Plan Pro ({months} mois — {amount:,} GNF) '
                        f'sera activé après validation du paiement par notre équipe sous 24h.'
                    ),
                    'reference': ref,
                    'amount_gnf': amount,
                    'months': months,
                    'subscription': SubscriptionSerializer(sub).data,
                }, status=202)

            result = initiate_orange_money(phone, amount, f'pro-{request.user.id}')
            if not result.success:
                return Response({'error': result.message}, status=502)

            # Activer uniquement si paiement OM confirmé en temps réel
            sub, _ = Subscription.objects.get_or_create(user=request.user)
            now  = timezone.now()
            base = sub.valid_until if (sub.valid_until and sub.valid_until > now) else now
            sub.plan        = Subscription.Plan.PRO
            sub.valid_until = base + relativedelta(months=months)
            sub.save(update_fields=['plan', 'valid_until'])
            Badge.award(request.user, Badge.Type.PRO)
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=request.user,
                    type=Notification.Type.ORDER_UPDATE,
                    title='💎 Plan Pro activé !',
                    body=f'Votre abonnement Pro est actif pour {months} mois. Publiez des annonces illimitées.',
                    data={},
                )
            except Exception:
                pass
            return Response({
                'message':      f'Plan Pro activé pour {months} mois.',
                'subscription': SubscriptionSerializer(sub).data,
            })

        # ── Autres méthodes (espèces, virement, ChaChaP…) ────────────────────
        # Créer une demande en attente — l'admin valide manuellement après réception.
        ref = f'SUB-{request.user.id}-{_uuid.uuid4().hex[:8].upper()}'
        try:
            from apps.notifications.models import Notification
            # Notifier l'équipe admin
            admins = User.objects.filter(role__in=['admin', 'super_admin', 'admin_accounting'], is_active=True)
            for adm in admins[:3]:
                Notification.send(
                    user=adm,
                    type=Notification.Type.ORDER_UPDATE,
                    title='💳 Demande abonnement Pro',
                    body=f'{request.user.full_name} souhaite activer {months} mois de Pro ({amount:,} GNF) '
                         f'via {provider}. Réf : {ref}. Vérifiez le paiement et activez manuellement.',
                    data={'user_id': str(request.user.id), 'months': months, 'ref': ref},
                )
        except Exception:
            pass

        sub, _ = Subscription.objects.get_or_create(user=request.user)
        return Response({
            'message':      (
                f'Demande reçue (réf : {ref}). Votre Plan Pro ({months} mois — {amount:,} GNF) '
                f'sera activé après validation du paiement par notre équipe sous 24h.'
            ),
            'reference':    ref,
            'amount_gnf':   amount,
            'months':       months,
            'subscription': SubscriptionSerializer(sub).data,
        }, status=202)


class BadgeListView(generics.ListAPIView):
    """Liste les badges de l'utilisateur connecté."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = BadgeSerializer

    def get_queryset(self):
        Badge.check_and_award(self.request.user)
        return Badge.objects.filter(user=self.request.user)


class ReferralStatsView(APIView):
    """GET /accounts/referral/ — stats de parrainage de l'utilisateur connecté."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        referrals = Referral.objects.filter(referrer=user, reward_given=True)
        sub, _ = Subscription.objects.get_or_create(user=user)
        site_url = request.build_absolute_uri('/').rstrip('/')
        return Response({
            'referral_code':  user.referral_code,
            'referral_url':   f'{site_url}/register?ref={user.referral_code}',
            'referral_count': referrals.count(),
            'reward_per_ref': Referral.REWARD_LISTINGS,
            'total_bonus':    sub.referral_bonus,
        })


class ShopListView(generics.ListAPIView):
    """Boutiques publiques — uniquement les boutiques approuvées."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = ShopSerializer

    def get_queryset(self):
        qs = Shop.objects.filter(is_active=True, status=Shop.Status.APPROVED).select_related('owner')
        if self.request.query_params.get('featured'):
            qs = qs.filter(is_featured=True)
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__iexact=city)
        return qs


class ShopDetailView(generics.RetrieveAPIView):
    """Détail d'une boutique — uniquement les boutiques approuvées."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = ShopSerializer
    queryset           = Shop.objects.filter(is_active=True, status=Shop.Status.APPROVED).select_related('owner')


class MyShopView(APIView):
    """Créer ou mettre à jour sa boutique (soumis à validation admin)."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        try:
            shop = request.user.shop
            return Response(ShopSerializer(shop).data)
        except Shop.DoesNotExist:
            return Response(None)

    def post(self, request):
        # Sépare le logo du reste des données pour gérer l'upload indépendamment
        data = request.data.copy()
        logo = data.pop('logo', None)
        if isinstance(logo, list):
            logo = logo[0] if logo else None

        try:
            shop = request.user.shop
            serializer = ShopSerializer(shop, data=data, partial=True)
        except Shop.DoesNotExist:
            serializer = ShopSerializer(data=data)

        if not serializer.is_valid():
            return Response({'validation_errors': serializer.errors}, status=400)

        shop = serializer.save(owner=request.user, status=Shop.Status.PENDING)

        # Upload du logo séparé — si Cloudinary échoue, la boutique est quand même créée
        if logo:
            try:
                shop.logo = logo
                shop.save(update_fields=['logo', 'updated_at'])
            except Exception as e:
                print(f'[SHOP] Logo upload failed (shop still created): {e}')

        # Notification admin
        try:
            from apps.notifications.models import Notification
            for admin_user in User.objects.filter(role=User.Role.ADMIN):
                Notification.send(
                    user=admin_user,
                    type=Notification.Type.ORDER_UPDATE,
                    title='Nouvelle boutique à approuver',
                    body=f'La boutique « {shop.name} » attend votre validation.',
                    data={'shop_id': str(shop.id)},
                )
        except Exception:
            pass

        return Response(ShopSerializer(shop).data)


# ── Vues Admin Boutiques ───────────────────────────────────────────────────────

class AdminShopListView(generics.ListAPIView):
    """Admin : liste toutes les boutiques avec filtre par statut."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminShopSerializer

    def get_queryset(self):
        qs = Shop.objects.select_related('owner').all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-created_at')


class AdminShopApproveView(APIView):
    """Admin : approuver ou rejeter une boutique."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        shop   = get_object_or_404(Shop, pk=pk)
        action = request.data.get('action')  # 'approve' | 'reject'
        plan   = request.data.get('plan', Shop.Plan.STANDARD)
        reason = request.data.get('reason', '')

        if action == 'approve':
            shop.status      = Shop.Status.APPROVED
            shop.is_verified = True
            shop.plan        = plan
            shop.reject_reason = ''
            # Plan premium → 1 mois par défaut si pas de date définie
            if plan == Shop.Plan.PREMIUM and not shop.plan_until:
                from django.utils import timezone
                from dateutil.relativedelta import relativedelta
                shop.plan_until = timezone.now() + relativedelta(months=1)
            shop.save(update_fields=['status', 'is_verified', 'plan', 'plan_until', 'reject_reason', 'updated_at'])
            # Notifier le propriétaire
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=shop.owner,
                    type=Notification.Type.ORDER_UPDATE,
                    title='✅ Boutique approuvée !',
                    body=f'Votre boutique « {shop.name} » a été approuvée. Elle est maintenant visible sur Guimatrix.',
                    data={'shop_id': str(shop.id)},
                )
            except Exception:
                pass

        elif action == 'reject':
            shop.status        = Shop.Status.REJECTED
            shop.reject_reason = reason
            shop.save(update_fields=['status', 'reject_reason', 'updated_at'])
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=shop.owner,
                    type=Notification.Type.ORDER_UPDATE,
                    title='❌ Boutique non approuvée',
                    body=f'Votre boutique « {shop.name} » n\'a pas pu être approuvée. Raison : {reason or "Non précisée"}. Vous pouvez la modifier et la soumettre à nouveau.',
                    data={'shop_id': str(shop.id)},
                )
            except Exception:
                pass
        else:
            return Response({'error': "action doit être 'approve' ou 'reject'."}, status=400)

        return Response(AdminShopSerializer(shop).data)


class AdminShopUpdateView(generics.UpdateAPIView):
    """Admin : modifier un plan ou featured status d'une boutique."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminShopSerializer
    queryset           = Shop.objects.all()


# ── Vues Admin Utilisateurs ────────────────────────────────────────────────────

class AdminUserListView(APIView):
    """Admin : liste tous les utilisateurs avec filtres."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Q
        qs = User.objects.all().order_by('-created_at')

        role   = request.query_params.get('role')
        search = request.query_params.get('search')
        active = request.query_params.get('is_active')

        if role:
            qs = qs.filter(role=role)
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(email__icontains=search)
            )
        if active is not None:
            qs = qs.filter(is_active=(active.lower() == 'true'))

        data = list(qs.values(
            'id', 'full_name', 'phone_number', 'email',
            'role', 'city', 'is_active', 'is_verified', 'is_available', 'is_staff',
            'created_at', 'last_login',
        )[:500])
        # Sérialiser UUID et dates
        for u in data:
            u['id']         = str(u['id'])
            u['phone_number'] = str(u['phone_number']) if u['phone_number'] else ''
            u['created_at'] = u['created_at'].isoformat() if u['created_at'] else None
            u['last_login'] = u['last_login'].isoformat() if u['last_login'] else None
        return Response(data)


class AdminUserUpdateView(APIView):
    """Admin : modifier le rôle ou le statut d'un utilisateur."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404
        target_user = get_object_or_404(User, pk=pk)
        requester   = request.user

        # Seul super_admin peut modifier les rôles ou is_staff
        # Un admin ordinaire ne peut que (dés)activer is_active / is_available
        is_super = requester.role == 'super_admin'
        sensitive_fields = {'role', 'is_staff'}

        for sf in sensitive_fields:
            if sf in request.data and not is_super:
                return Response(
                    {'error': f'Seul un super_admin peut modifier le champ « {sf} ».'},
                    status=403,
                )

        # Empêcher l'auto-promotion (même pour super_admin)
        if str(target_user.id) == str(requester.id) and 'role' in request.data:
            return Response({'error': 'Vous ne pouvez pas modifier votre propre rôle.'}, status=403)

        allowed_fields = {'role', 'is_active', 'is_available', 'is_staff'}
        update_fields  = []

        for field in allowed_fields:
            if field in request.data:
                setattr(target_user, field, request.data[field])
                update_fields.append(field)

        if not update_fields:
            return Response({'error': 'Aucun champ à modifier'}, status=400)

        update_fields.append('updated_at')
        target_user.save(update_fields=update_fields)

        return Response({
            'id':           str(target_user.id),
            'role':         target_user.role,
            'is_active':    target_user.is_active,
            'is_available': target_user.is_available,
            'is_staff':     target_user.is_staff,
        })


# ── Admin — activer/désactiver le Plan Pro manuellement ───────────────────────

class AdminActivateSubscriptionView(APIView):
    """
    Admin : activer ou annuler manuellement un abonnement Pro.
    POST /accounts/admin/users/<uuid>/subscription/
    Body: { months: 1|3|6|12, action: 'activate'|'cancel' }
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from dateutil.relativedelta import relativedelta
        from django.shortcuts import get_object_or_404

        target_user = get_object_or_404(User, pk=pk)
        action      = request.data.get('action', 'activate')
        months      = int(request.data.get('months', 1))

        sub, _ = Subscription.objects.get_or_create(user=target_user)

        if action == 'cancel':
            sub.plan        = Subscription.Plan.FREE
            sub.valid_until = None
            sub.save(update_fields=['plan', 'valid_until'])
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=target_user,
                    type=Notification.Type.ORDER_UPDATE,
                    title='Abonnement Pro annulé',
                    body="Votre abonnement Pro a été annulé par l'équipe GuinéeMarché.",
                    data={},
                )
            except Exception:
                pass
            return Response({
                'message':      f'Abonnement Pro annulé pour {target_user.full_name}.',
                'subscription': SubscriptionSerializer(sub).data,
            })

        # action == 'activate'
        if months not in PRO_PRICES:
            return Response({'error': 'Durée invalide. Choisissez 1, 3, 6 ou 12 mois.'}, status=400)

        now  = timezone.now()
        base = sub.valid_until if (sub.valid_until and sub.valid_until > now) else now
        sub.plan        = Subscription.Plan.PRO
        sub.valid_until = base + relativedelta(months=months)
        sub.save(update_fields=['plan', 'valid_until'])
        Badge.award(target_user, Badge.Type.PRO)

        try:
            from apps.notifications.models import Notification
            Notification.send(
                user=target_user,
                type=Notification.Type.ORDER_UPDATE,
                title='Plan Pro activé !',
                body=f'Votre abonnement Pro est actif pour {months} mois. Publiez des annonces illimitées.',
                data={},
            )
        except Exception:
            pass

        return Response({
            'message':      f'Plan Pro activé pour {target_user.full_name} ({months} mois).',
            'subscription': SubscriptionSerializer(sub).data,
        })


# ── Suppression de compte ──────────────────────────────────────────────────────

class DeleteAccountView(APIView):
    """
    POST /accounts/delete/
    Body: { password: "...", refresh_token: "..." }
    Vérifie le mot de passe, anonymise les données PII et désactive le compte.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user     = request.user
        password = request.data.get('password', '').strip()

        if not password:
            return Response({'error': 'Le mot de passe est obligatoire.'}, status=400)

        if not user.check_password(password):
            return Response({'error': 'Mot de passe incorrect.'}, status=400)

        # Blacklister le refresh token pour invalider la session
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass

        # Anonymisation PII + désactivation (soft delete)
        # RGPD : effacer TOUTES les données personnelles identifiantes
        user.full_name    = 'Compte supprimé'
        user.email        = None
        user.phone_number = None   # PII principal — doit être effacé
        user.city         = ''
        user.quartier     = ''
        user.is_active    = False
        user.save(update_fields=['full_name', 'email', 'phone_number', 'city', 'quartier', 'is_active', 'updated_at'])

        return Response(status=204)