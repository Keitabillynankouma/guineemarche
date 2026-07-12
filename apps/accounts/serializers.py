from rest_framework import serializers
from django.utils import timezone
from .models import User, UserProfile, OTPCode, Subscription, Badge, Shop
from core.utils import generate_otp, otp_expiry
from core.sms import send_otp_sms


class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ('phone_number', 'full_name', 'email', 'password', 'password2', 'city', 'quartier')
        extra_kwargs = {'email': {'required': False, 'allow_blank': True, 'allow_null': True}}

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs

    def validate_phone_number(self, value):
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("Ce numéro est déjà utilisé.")
        return value

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Générer OTP de vérification et envoyer par SMS
        code = generate_otp()
        OTPCode.objects.create(
            user=user,
            code=code,
            purpose=OTPCode.Purpose.REGISTER,
            expires_at=otp_expiry(minutes=10)
        )
        send_otp_sms(str(user.phone_number), code)
        return user


class EmailRegisterSerializer(serializers.ModelSerializer):
    """Inscription diaspora — email + mot de passe, sans numéro guinéen."""
    password  = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = ('email', 'full_name', 'password', 'password2', 'city', 'quartier')
        extra_kwargs = {'email': {'required': True}}

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("L'email est requis.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value.lower().strip()

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas.")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # OTP envoyé par email (30 min — plus long que SMS)
        from core.utils import generate_otp, otp_expiry
        code = generate_otp()
        OTPCode.objects.create(
            user=user,
            code=code,
            purpose=OTPCode.Purpose.REGISTER,
            expires_at=otp_expiry(minutes=30),
        )
        import logging as _log
        _logger = _log.getLogger(__name__)
        try:
            from core.email_notifications import send_otp_email
            send_otp_email(user.email, code, user.full_name)
        except Exception as _e:
            # NE PAS avaler silencieusement — logger pour diagnostic Railway
            _logger.error(
                "[REGISTER EMAIL] Échec envoi OTP à %s : %s",
                user.email, _e, exc_info=True
            )
        return user


class VerifyEmailOTPSerializer(serializers.Serializer):
    """Vérification OTP pour l'inscription diaspora (lookup par email)."""
    email   = serializers.EmailField()
    code    = serializers.CharField(max_length=6)

    def validate(self, attrs):
        from django.utils import timezone
        try:
            user = User.objects.get(email__iexact=attrs['email'])
        except User.DoesNotExist:
            raise serializers.ValidationError("Utilisateur introuvable.")

        otp = OTPCode.objects.filter(
            user=user,
            code=attrs['code'],
            purpose=OTPCode.Purpose.REGISTER,
            is_used=False,
            expires_at__gt=timezone.now()
        ).last()

        if not otp:
            raise serializers.ValidationError("Code invalide ou expiré.")

        attrs['user'] = user
        attrs['otp']  = otp
        return attrs


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code         = serializers.CharField(max_length=6)
    purpose      = serializers.ChoiceField(choices=OTPCode.Purpose.choices)

    def validate(self, attrs):
        try:
            user = User.objects.get(phone_number=attrs['phone_number'])
        except User.DoesNotExist:
            raise serializers.ValidationError("Utilisateur introuvable.")

        otp = OTPCode.objects.filter(
            user=user,
            code=attrs['code'],
            purpose=attrs['purpose'],
            is_used=False,
            expires_at__gt=timezone.now()
        ).last()

        if not otp:
            raise serializers.ValidationError("Code invalide ou expiré.")

        attrs['user'] = user
        attrs['otp']  = otp
        return attrs


class LoginSerializer(serializers.Serializer):
    """
    Connexion par numéro de téléphone (Guinée) OU par email (diaspora).
    Envoie phone_number OU email — l'un des deux est suffisant.
    """
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    email        = serializers.CharField(required=False, allow_blank=True, default='')
    password     = serializers.CharField(write_only=True)

    def validate(self, attrs):
        phone = attrs.get('phone_number', '').strip()
        email = attrs.get('email', '').strip().lower()

        if not phone and not email:
            raise serializers.ValidationError("Numéro de téléphone ou email requis.")

        user = None
        if email:
            user = User.objects.filter(email__iexact=email).first()
        elif phone:
            user = User.objects.filter(phone_number=phone).first()

        if not user or not user.check_password(attrs['password']):
            raise serializers.ValidationError("Identifiants incorrects.")

        if not user.is_active:
            raise serializers.ValidationError("Ce compte est désactivé.")

        if not user.is_verified:
            raise serializers.ValidationError("Veuillez vérifier votre compte d'abord.")

        attrs['user'] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model  = UserProfile
        fields = ('avatar_url', 'bio', 'rating_avg', 'total_ratings', 'total_sales')
        read_only_fields = ('rating_avg', 'total_ratings', 'total_sales')

    def get_avatar_url(self, obj):
        if not obj.avatar_url:
            return None
        try:
            return obj.avatar_url.url
        except Exception:
            return None


class BadgeSerializer(serializers.ModelSerializer):
    icon  = serializers.SerializerMethodField()
    label = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model  = Badge
        fields = ('type', 'label', 'icon', 'created_at')

    def get_icon(self, obj):
        return Badge.ICONS.get(obj.type, '🏅')


class SubscriptionSerializer(serializers.ModelSerializer):
    is_pro        = serializers.BooleanField(read_only=True)
    can_post      = serializers.BooleanField(read_only=True)
    remaining_free = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model  = Subscription
        fields = ('plan', 'listings_used', 'valid_until', 'is_pro', 'can_post', 'remaining_free')
        read_only_fields = fields


class ShopSerializer(serializers.ModelSerializer):
    logo_url      = serializers.SerializerMethodField()
    listing_count = serializers.IntegerField(read_only=True)
    owner_name    = serializers.CharField(source='owner.full_name', read_only=True)
    owner_phone   = serializers.CharField(source='owner.phone_number', read_only=True)

    class Meta:
        model  = Shop
        fields = (
            'id', 'name', 'logo', 'logo_url', 'description',
            'phone', 'whatsapp', 'address', 'city', 'website',
            'is_verified', 'is_featured', 'listing_count',
            'status', 'plan', 'plan_until',
            'owner', 'owner_name', 'owner_phone', 'created_at',
        )
        read_only_fields = (
            'id', 'is_verified', 'is_featured', 'status', 'plan', 'plan_until',
            'owner', 'owner_name', 'owner_phone', 'created_at',
        )
        extra_kwargs = {'logo': {'write_only': True, 'required': False}}

    def get_logo_url(self, obj):
        return obj.logo_url


class AdminShopSerializer(serializers.ModelSerializer):
    """Sérialiseur admin complet — lecture + actions d'approbation."""
    logo_url      = serializers.SerializerMethodField(read_only=True)
    listing_count = serializers.IntegerField(read_only=True)
    owner_name    = serializers.CharField(source='owner.full_name', read_only=True)
    owner_phone   = serializers.CharField(source='owner.phone_number', read_only=True)

    class Meta:
        model  = Shop
        fields = (
            'id', 'name', 'logo_url', 'description',
            'phone', 'whatsapp', 'address', 'city', 'website',
            'is_verified', 'is_featured', 'listing_count',
            'status', 'plan', 'plan_until', 'reject_reason',
            'owner', 'owner_name', 'owner_phone', 'created_at',
        )
        read_only_fields = (
            'id', 'listing_count', 'owner', 'owner_name', 'owner_phone', 'created_at',
        )

    def get_logo_url(self, obj):
        return obj.logo_url


class UserSerializer(serializers.ModelSerializer):
    profile      = UserProfileSerializer(read_only=True)
    badges       = BadgeSerializer(many=True, read_only=True)
    subscription = serializers.SerializerMethodField()
    shop         = serializers.SerializerMethodField()

    def get_shop(self, obj):
        try:
            return ShopSerializer(obj.shop).data
        except Exception:
            return None

    def get_subscription(self, obj):
        try:
            sub, _ = Subscription.objects.get_or_create(user=obj)
            return SubscriptionSerializer(sub).data
        except Exception:
            return {'plan': 'free', 'listings_used': 0, 'valid_until': None,
                    'is_pro': False, 'can_post': True, 'remaining_free': 5}

    class Meta:
        model  = User
        fields = (
            'id', 'phone_number', 'full_name', 'email',
            'role', 'city', 'quartier', 'is_verified',
            'created_at', 'profile', 'badges', 'subscription', 'shop'
        )
        read_only_fields = ('id', 'phone_number', 'is_verified', 'created_at')


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Ancien mot de passe incorrect.")
        return value