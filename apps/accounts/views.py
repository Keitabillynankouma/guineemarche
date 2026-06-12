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

from .models import User, OTPCode, Subscription, Badge, Shop
from .serializers import (
    RegisterSerializer, VerifyOTPSerializer, LoginSerializer,
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
        return Response({
            'message': 'Compte créé. Vérifiez votre code OTP.',
            'phone_number': str(user.phone_number),
        }, status=status.HTTP_201_CREATED)


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

        code = generate_otp()
        OTPCode.objects.create(
            user=user,
            code=code,
            purpose=purpose,
            expires_at=otp_expiry(minutes=10)
        )
        send_otp_sms(str(user.phone_number), code)
        return Response({'message': 'Nouveau code envoyé.'})


# Prix Pro par durée (GNF)
PRO_PRICES = {1: 40_000, 3: 105_000, 6: 190_000, 12: 350_000}


class SubscriptionView(APIView):
    """
    GET  — statut de l'abonnement.
    POST — paiement réel + activation automatique du plan Pro.
    Body: { months: 1|3|6|12, provider: 'orange_money'|'mtn_momo'|'cash', phone: '...' }
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        return Response(SubscriptionSerializer(sub).data)

    def post(self, request):
        from apps.orders.payment_service import initiate_orange_money, initiate_mtn_momo
        from apps.orders.models import Payment
        from dateutil.relativedelta import relativedelta

        months   = int(request.data.get('months', 1))
        provider = request.data.get('provider', Payment.Provider.CASH)
        phone    = request.data.get('phone', '')

        if months not in PRO_PRICES:
            return Response({'error': 'Durée invalide. Choisissez 1, 3, 6 ou 12 mois.'}, status=400)

        amount = PRO_PRICES[months]

        # Initier le paiement
        if provider == Payment.Provider.ORANGE_MONEY:
            result = initiate_orange_money(phone, amount, f'pro-{request.user.id}')
        elif provider == Payment.Provider.MTN_MOMO:
            result = initiate_mtn_momo(phone, amount, f'pro-{request.user.id}')
        else:
            result = type('R', (), {'success': True, 'reference': '', 'message': 'Plan Pro activé'})()

        if not result.success:
            return Response({'error': result.message}, status=502)

        # Activer automatiquement
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        now = timezone.now()
        # Si déjà Pro, prolonger depuis la date d'expiration
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


class BadgeListView(generics.ListAPIView):
    """Liste les badges de l'utilisateur connecté."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = BadgeSerializer

    def get_queryset(self):
        Badge.check_and_award(self.request.user)
        return Badge.objects.filter(user=self.request.user)


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
    """Détail d'une boutique."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = ShopSerializer
    queryset           = Shop.objects.filter(is_active=True).select_related('owner')


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
                    body=f'Votre boutique « {shop.name} » a été approuvée. Elle est maintenant visible sur GuinéeMarché.',
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