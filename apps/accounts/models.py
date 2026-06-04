from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from phonenumber_field.modelfields import PhoneNumberField
from core.models import BaseModel


class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("Le numéro de téléphone est obligatoire")
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):

    class Role(models.TextChoices):
        BUYER  = 'buyer',  'Acheteur'
        SELLER = 'seller', 'Vendeur'
        ADMIN  = 'admin',  'Administrateur'

    phone_number = PhoneNumberField(unique=True, region='GN')
    email        = models.EmailField(blank=True, null=True)
    full_name    = models.CharField(max_length=150)
    role         = models.CharField(max_length=10, choices=Role.choices, default=Role.BUYER)

    # Localisation guinéenne
    city         = models.CharField(max_length=100, default='Conakry')
    quartier     = models.CharField(max_length=100, blank=True)

    is_verified  = models.BooleanField(default=False)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD  = 'phone_number'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"

    @property
    def is_seller(self):
        return self.role == self.Role.SELLER

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN


class UserProfile(BaseModel):
    user        = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_url  = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio         = models.TextField(max_length=500, blank=True)
    rating_avg  = models.FloatField(default=0.0)
    total_ratings = models.PositiveIntegerField(default=0)
    total_sales = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Profil'

    def __str__(self):
        return f"Profil de {self.user.full_name}"


class OTPCode(BaseModel):

    class Purpose(models.TextChoices):
        REGISTER       = 'register',        'Inscription'
        LOGIN          = 'login',           'Connexion'
        RESET_PASSWORD = 'reset_password',  'Réinitialisation'

    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otp_codes')
    code       = models.CharField(max_length=6)
    purpose    = models.CharField(max_length=20, choices=Purpose.choices)
    is_used    = models.BooleanField(default=False)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = 'Code OTP'
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP {self.code} pour {self.user.phone_number}"

    @property
    def is_valid(self):
        from django.utils import timezone
        return not self.is_used and self.expires_at > timezone.now()


class Session(BaseModel):
    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    token       = models.CharField(max_length=255, unique=True)
    device_info = models.CharField(max_length=255, blank=True)
    expires_at  = models.DateTimeField()

    class Meta:
        verbose_name = 'Session'

    def __str__(self):
        return f"Session de {self.user.phone_number}"


class Subscription(BaseModel):
    """Abonnement utilisateur. Gratuit = 5 annonces max, Pro = illimité."""

    class Plan(models.TextChoices):
        FREE  = 'free',  'Gratuit (5 annonces)'
        PRO   = 'pro',   'Pro — illimité'

    user           = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan           = models.CharField(max_length=10, choices=Plan.choices, default=Plan.FREE)
    listings_used  = models.PositiveIntegerField(default=0)
    valid_until    = models.DateTimeField(null=True, blank=True)

    FREE_LIMIT = 5

    class Meta:
        verbose_name = 'Abonnement'

    def __str__(self):
        return f"{self.user.full_name} — {self.plan}"

    @property
    def is_pro(self):
        from django.utils import timezone
        return self.plan == self.Plan.PRO and (
            self.valid_until is None or self.valid_until > timezone.now()
        )

    @property
    def can_post(self):
        return self.is_pro or self.listings_used < self.FREE_LIMIT

    @property
    def remaining_free(self):
        if self.is_pro:
            return None  # illimité
        return max(0, self.FREE_LIMIT - self.listings_used)


class Badge(BaseModel):
    """Badges attribués automatiquement selon les actions de l'utilisateur."""

    class Type(models.TextChoices):
        VERIFIED      = 'verified',      'Compte vérifié'
        FIRST_LISTING = 'first_listing', 'Première annonce'
        SELLER_5      = 'seller_5',      '5 ventes réalisées'
        SELLER_10     = 'seller_10',     '10 ventes réalisées'
        TOP_RATED     = 'top_rated',     'Top noté (≥ 4.5/5)'
        TRUSTED       = 'trusted',       'Vendeur de confiance'
        PRO           = 'pro',           'Membre Pro'

    ICONS = {
        'verified':      '✅',
        'first_listing': '🎉',
        'seller_5':      '🥈',
        'seller_10':     '🥇',
        'top_rated':     '⭐',
        'trusted':       '🛡️',
        'pro':           '💎',
    }

    user  = models.ForeignKey(User, on_delete=models.CASCADE, related_name='badges')
    type  = models.CharField(max_length=20, choices=Type.choices)

    class Meta:
        verbose_name      = 'Badge'
        unique_together   = ('user', 'type')
        ordering          = ['type']

    def __str__(self):
        return f"{self.ICONS.get(self.type, '🏅')} {self.get_type_display()} — {self.user.full_name}"

    @classmethod
    def award(cls, user, badge_type):
        cls.objects.get_or_create(user=user, type=badge_type)

    @classmethod
    def revoke(cls, user, badge_type):
        cls.objects.filter(user=user, type=badge_type).delete()

    @classmethod
    def check_and_award(cls, user):
        profile = getattr(user, 'profile', None)
        if not profile:
            return

        if user.is_verified:
            cls.award(user, cls.Type.VERIFIED)

        sales = profile.total_sales
        if sales >= 1:
            cls.award(user, cls.Type.FIRST_LISTING)
        if sales >= 5:
            cls.award(user, cls.Type.SELLER_5)
        if sales >= 10:
            cls.award(user, cls.Type.SELLER_10)

        if profile.rating_avg >= 4.5 and profile.total_ratings >= 10:
            cls.award(user, cls.Type.TOP_RATED)

        if (user.is_verified and sales >= 5 and profile.rating_avg >= 4.0):
            cls.award(user, cls.Type.TRUSTED)

        sub = getattr(user, 'subscription', None)
        if sub and sub.is_pro:
            cls.award(user, cls.Type.PRO)
        else:
            cls.revoke(user, cls.Type.PRO)