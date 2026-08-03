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
        BUYER             = 'buyer',             'Acheteur'
        SELLER            = 'seller',            'Vendeur'
        ADMIN             = 'admin',             'Administrateur'
        LIVREUR           = 'livreur',           'Livreur'
        # ── Sous-rôles admin ──────────────────────────────────────────────
        SUPER_ADMIN       = 'super_admin',       'Super Administrateur'
        ADMIN_DELIVERY    = 'admin_delivery',    'Admin Livraison'
        ADMIN_MARKETING   = 'admin_marketing',   'Admin Marketing'
        ADMIN_ACCOUNTING  = 'admin_accounting',  'Admin Comptabilité'

    phone_number = PhoneNumberField(unique=True, null=True, blank=True, region='GN')
    email        = models.EmailField(unique=True, null=True, blank=True)
    full_name    = models.CharField(max_length=150)
    role         = models.CharField(max_length=20, choices=Role.choices, default=Role.BUYER)

    # Localisation guinéenne
    city         = models.CharField(max_length=100, default='Conakry')
    quartier     = models.CharField(max_length=100, blank=True)

    is_verified   = models.BooleanField(default=False)
    is_active     = models.BooleanField(default=True)
    is_staff      = models.BooleanField(default=False)
    # Livreur : disponibilité manuelle (le livreur bascule lui-même)
    is_available  = models.BooleanField(default=True, help_text='Livreur disponible pour recevoir des commandes')

    # Push notifications FCM (Firebase Cloud Messaging)
    fcm_token = models.CharField(
        max_length=512, blank=True, default='',
        help_text='Token FCM du dernier appareil connecté (web ou mobile)',
    )

    referral_code = models.CharField(max_length=12, unique=True, blank=True, db_index=True)
    referred_by   = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='referrals_made')

    # Coordonnées mobile money — utilisées pour les virements automatiques
    # (livreurs : virements hebdomadaires / vendeurs : libération escrow)
    class PayoutProvider(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        MTN_MOMO     = 'mtn_momo',     'MTN MoMo'
        PAYCARD      = 'paycard',      'PayCard'
        KULU         = 'kulu',         'Kulu'
        SOUTRA_MONEY = 'soutra_money', 'Soutra Money'
        AKIBA        = 'akiba',        'Akiba'

    payout_phone    = models.CharField(
        max_length=20, blank=True,
        help_text="Numéro de compte pour recevoir les paiements (Mobile Money, PayCard…)"
    )
    payout_provider = models.CharField(
        max_length=15, choices=PayoutProvider.choices, blank=True,
        help_text="Opérateur pour les virements"
    )

    objects = UserManager()

    USERNAME_FIELD  = 'phone_number'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"

    def save(self, *args, **kwargs):
        if not self.referral_code:
            import secrets, string
            chars = string.ascii_uppercase + string.digits
            while True:
                code = ''.join(secrets.choice(chars) for _ in range(8))
                if not User.objects.filter(referral_code=code).exists():
                    self.referral_code = code
                    break
        super().save(*args, **kwargs)

    @property
    def has_payout_info(self):
        return bool(self.payout_phone and self.payout_provider)

    @property
    def is_seller(self):
        return self.role == self.Role.SELLER

    # Rôles considérés comme "admin" pour les permissions backend
    ADMIN_ROLES = (
        Role.ADMIN, Role.SUPER_ADMIN,
        Role.ADMIN_DELIVERY, Role.ADMIN_MARKETING, Role.ADMIN_ACCOUNTING,
    )

    @property
    def is_admin(self):
        return self.role in self.ADMIN_ROLES

    @property
    def is_super_admin(self):
        return self.role in (self.Role.SUPER_ADMIN, self.Role.ADMIN)

    @property
    def can_manage_deliveries(self):
        return self.role in (self.Role.SUPER_ADMIN, self.Role.ADMIN, self.Role.ADMIN_DELIVERY)

    @property
    def can_manage_marketing(self):
        return self.role in (self.Role.SUPER_ADMIN, self.Role.ADMIN, self.Role.ADMIN_MARKETING)

    @property
    def can_manage_accounting(self):
        return self.role in (self.Role.SUPER_ADMIN, self.Role.ADMIN, self.Role.ADMIN_ACCOUNTING)


class AdminUser(User):
    """Proxy model — affiche uniquement les administrateurs dans le panel Django."""
    class Meta:
        proxy = True
        verbose_name = 'Administrateur'
        verbose_name_plural = 'Équipe Admin'
        ordering = ['-last_login']


class UserProfile(BaseModel):

    class PayoutProvider(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        MTN_MOMO     = 'mtn_momo',     'MTN MoMo'
        PAYCARD      = 'paycard',      'PayCard'
        KULU         = 'kulu',         'Kulu'
        SOUTRA_MONEY = 'soutra_money', 'Soutra Money'
        AKIBA        = 'akiba',        'Akiba'

    user          = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_url    = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio           = models.TextField(max_length=500, blank=True)
    rating_avg    = models.FloatField(default=0.0)
    total_ratings = models.PositiveIntegerField(default=0)
    total_sales   = models.PositiveIntegerField(default=0)

    # Coordonnées de paiement sortant (pour recevoir les revenus de ventes)
    payout_phone    = models.CharField(
        max_length=20, blank=True,
        help_text="Numéro de compte pour recevoir vos paiements (Mobile Money, PayCard…)"
    )
    payout_provider = models.CharField(
        max_length=15, choices=PayoutProvider.choices, blank=True,
        help_text="Opérateur pour les versements"
    )

    class Meta:
        verbose_name = 'Profil'

    def __str__(self):
        return f"Profil de {self.user.full_name}"

    @property
    def has_payout_info(self):
        return bool(self.payout_phone and self.payout_provider)


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


class Shop(BaseModel):
    """Profil boutique d'un vendeur professionnel."""

    class Status(models.TextChoices):
        PENDING  = 'pending',  'En attente de validation'
        APPROVED = 'approved', 'Approuvée'
        REJECTED = 'rejected', 'Rejetée'

    class Plan(models.TextChoices):
        STANDARD = 'standard', 'Boutique Standard'
        PREMIUM  = 'premium',  'Boutique Premium'

    owner       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='shop')
    name        = models.CharField(max_length=200)
    logo        = models.ImageField(upload_to='shops/', null=True, blank=True)
    description = models.TextField(blank=True)
    phone       = models.CharField(max_length=20, blank=True)
    address     = models.CharField(max_length=300, blank=True)
    city        = models.CharField(max_length=100, default='Conakry')
    website     = models.CharField(max_length=255, blank=True)
    whatsapp    = models.CharField(max_length=20, blank=True)
    status      = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    plan        = models.CharField(max_length=10, choices=Plan.choices, default=Plan.STANDARD)
    plan_until  = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Boutique'
        verbose_name_plural = 'Boutiques'
        ordering = ['-is_featured', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.owner.full_name})"

    @property
    def logo_url(self):
        if self.logo:
            try:
                url = self.logo.url
                return url if url.startswith('http') else None
            except Exception:
                return None
        return None

    @property
    def listing_count(self):
        return self.owner.listings.filter(status='active').count()


class Subscription(BaseModel):
    """Abonnement utilisateur. Gratuit = 5 annonces max, Pro = illimité."""

    class Plan(models.TextChoices):
        FREE  = 'free',  'Gratuit (5 annonces)'
        PRO   = 'pro',   'Pro — illimité'

    user            = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan            = models.CharField(max_length=10, choices=Plan.choices, default=Plan.FREE)
    listings_used   = models.PositiveIntegerField(default=0)
    valid_until     = models.DateTimeField(null=True, blank=True)
    referral_bonus  = models.PositiveIntegerField(default=0, help_text='Slots gratuits supplémentaires gagnés par parrainage')

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
    def effective_limit(self):
        return self.FREE_LIMIT + self.referral_bonus

    @property
    def can_post(self):
        return self.is_pro or self.listings_used < self.effective_limit

    @property
    def remaining_free(self):
        if self.is_pro:
            return None  # illimité
        return max(0, self.effective_limit - self.listings_used)


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


# ── Parrainage ────────────────────────────────────────────────────────────────

class Referral(BaseModel):
    """Parrainage : quand un filleul s'inscrit via le code d'un parrain."""

    REWARD_LISTINGS = 2   # annonces gratuites supplémentaires pour le parrain

    referrer       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrals_given')
    referred       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='referral_received')
    reward_given   = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Parrainage'
        verbose_name_plural = 'Parrainages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.referrer.full_name} → {self.referred.full_name}"

    def give_reward(self):
        """Crédite le parrain avec des annonces supplémentaires."""
        if self.reward_given:
            return
        sub, _ = Subscription.objects.get_or_create(user=self.referrer)
        sub.referral_bonus += self.REWARD_LISTINGS
        sub.save(update_fields=['referral_bonus'])
        self.reward_given = True
        self.save(update_fields=['reward_given'])
        # Badge "Parrain actif" si ≥ 3 filleuls
        if Referral.objects.filter(referrer=self.referrer, reward_given=True).count() >= 3:
            Badge.award(self.referrer, Badge.Type.TRUSTED)