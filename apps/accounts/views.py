from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone

from .models import User, OTPCode, Subscription, Badge
from .serializers import (
    RegisterSerializer, VerifyOTPSerializer, LoginSerializer,
    UserSerializer, UserProfileSerializer, ChangePasswordSerializer,
    SubscriptionSerializer, BadgeSerializer,
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

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


class SubscriptionView(APIView):
    """GET : statut de l'abonnement. POST : activer Pro (simulation)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        return Response(SubscriptionSerializer(sub).data)

    def post(self, request):
        """
        Simule l'activation Pro.
        En production : déclencher un paiement Mobile Money puis valider ici.
        """
        sub, _ = Subscription.objects.get_or_create(user=request.user)
        duration_months = int(request.data.get('months', 1))
        from dateutil.relativedelta import relativedelta
        sub.plan        = Subscription.Plan.PRO
        sub.valid_until = timezone.now() + relativedelta(months=duration_months)
        sub.save(update_fields=['plan', 'valid_until'])
        Badge.award(request.user, Badge.Type.PRO)
        return Response({
            'message': f'Abonnement Pro activé pour {duration_months} mois.',
            'subscription': SubscriptionSerializer(sub).data,
        })


class BadgeListView(generics.ListAPIView):
    """Liste les badges de l'utilisateur connecté."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = BadgeSerializer

    def get_queryset(self):
        Badge.check_and_award(self.request.user)
        return Badge.objects.filter(user=self.request.user)