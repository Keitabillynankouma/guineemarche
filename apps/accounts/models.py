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