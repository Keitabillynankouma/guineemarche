from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django.utils.timesince import timesince
from django.utils import timezone
from .models import User, AdminUser, UserProfile, OTPCode, Session, Shop, Subscription, Badge


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ('full_name', 'phone_number', 'email', 'role', 'city', 'is_verified', 'is_active', 'is_available', 'created_at')
    list_filter    = ('role', 'is_verified', 'is_active', 'is_available', 'city')
    list_editable  = ('is_available',)
    search_fields  = ('full_name', 'phone_number', 'email')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'referral_code')

    fieldsets = (
        (None,           {'fields': ('phone_number', 'password')}),
        ('Informations', {'fields': ('full_name', 'email', 'role', 'city', 'quartier')}),
        ('Statut',       {'fields': ('is_verified', 'is_active', 'is_available', 'is_staff', 'is_superuser')}),
        ('Parrainage',   {'fields': ('referral_code', 'referred_by')}),
        ('Permissions',  {'fields': ('groups', 'user_permissions')}),
        ('Dates',        {'fields': ('created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(AdminUser)
class AdminUserAdmin(BaseUserAdmin):
    """Section dédiée 'Équipe Admin' — proxy filtré sur role=admin ou is_staff=True."""

    list_display   = ('full_name', 'phone_number', 'email', 'role_badge', 'staff_badge',
                      'superuser_badge', 'last_login_display', 'is_active')
    list_filter    = ('role', 'is_staff', 'is_superuser', 'is_active')
    list_editable  = ('is_active',)
    search_fields  = ('full_name', 'phone_number', 'email')
    ordering       = ('-last_login',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'referral_code', 'last_login')
    actions        = ['promote_to_admin', 'demote_to_user', 'grant_superuser',
                      'revoke_superuser', 'activate_accounts', 'deactivate_accounts']

    fieldsets = (
        (None,           {'fields': ('phone_number', 'password')}),
        ('Informations', {'fields': ('full_name', 'email', 'role', 'city', 'quartier')}),
        ('Statut',       {'fields': ('is_verified', 'is_active', 'is_staff', 'is_superuser')}),
        ('Permissions',  {'fields': ('groups', 'user_permissions')}),
        ('Dates',        {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'role', 'password1', 'password2'),
        }),
    )

    def get_queryset(self, request):
        from django.db.models import Q
        return super().get_queryset(request).filter(
            Q(role='admin') | Q(is_staff=True)
        )

    # ── Colonnes enrichies ────────────────────────────────────────────────────

    @admin.display(description='Rôle')
    def role_badge(self, obj):
        colors = {'admin': '#16a34a', 'buyer': '#6b7280', 'seller': '#2563eb', 'livreur': '#d97706'}
        color = colors.get(obj.role, '#6b7280')
        return format_html(
            '<span style="background:{};color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600">{}</span>',
            color, obj.get_role_display()
        )

    @admin.display(description='Staff', boolean=True)
    def staff_badge(self, obj):
        return obj.is_staff

    @admin.display(description='Superuser', boolean=True)
    def superuser_badge(self, obj):
        return obj.is_superuser

    @admin.display(description='Dernière connexion')
    def last_login_display(self, obj):
        if not obj.last_login:
            return format_html('<span style="color:#9ca3af">Jamais</span>')
        delta = timesince(obj.last_login, timezone.now())
        return format_html('<span style="color:#374151">il y a {}</span>', delta)

    # ── Actions bulk ──────────────────────────────────────────────────────────

    @admin.action(description='⬆️ Promouvoir en admin (role=admin + is_staff)')
    def promote_to_admin(self, request, queryset):
        updated = queryset.update(role='admin', is_staff=True)
        self.message_user(request, f'✅ {updated} utilisateur(s) promu(s) administrateur.')

    @admin.action(description='⬇️ Rétrograder (role=buyer, retirer is_staff)')
    def demote_to_user(self, request, queryset):
        updated = queryset.update(role='buyer', is_staff=False, is_superuser=False)
        self.message_user(request, f'✅ {updated} utilisateur(s) rétrogradé(s) en acheteur.')

    @admin.action(description='🔑 Accorder les droits superuser')
    def grant_superuser(self, request, queryset):
        updated = queryset.update(is_superuser=True, is_staff=True)
        self.message_user(request, f'✅ {updated} compte(s) élevé(s) en superuser.')

    @admin.action(description='🔒 Retirer les droits superuser')
    def revoke_superuser(self, request, queryset):
        updated = queryset.filter(is_superuser=True).update(is_superuser=False)
        self.message_user(request, f'✅ {updated} compte(s) rétrogradé(s) (sans superuser).')

    @admin.action(description='✅ Activer les comptes')
    def activate_accounts(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'✅ {updated} compte(s) activé(s).')

    @admin.action(description='🚫 Désactiver les comptes')
    def deactivate_accounts(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'⚠️ {updated} compte(s) désactivé(s).')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display   = ('user', 'rating_avg', 'total_ratings', 'total_sales')
    search_fields  = ('user__phone_number', 'user__full_name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display   = ('user', 'code', 'purpose', 'is_used', 'expires_at', 'created_at')
    list_filter    = ('purpose', 'is_used')
    search_fields  = ('user__phone_number', 'user__email', 'code')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display   = ('user', 'device_info', 'expires_at', 'created_at')
    search_fields  = ('user__phone_number', 'user__full_name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display   = ('name', 'owner', 'city', 'status', 'plan', 'is_verified', 'is_featured', 'created_at')
    list_filter    = ('status', 'plan', 'is_verified', 'is_featured', 'city')
    search_fields  = ('name', 'owner__full_name', 'owner__phone_number')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    actions        = ['approve_shops', 'reject_shops', 'feature_shops']

    @admin.action(description='✅ Approuver les boutiques sélectionnées')
    def approve_shops(self, request, queryset):
        updated = queryset.update(status='approved', is_verified=True)
        self.message_user(request, f'{updated} boutique(s) approuvée(s).')

    @admin.action(description='❌ Rejeter les boutiques sélectionnées')
    def reject_shops(self, request, queryset):
        updated = queryset.update(status='rejected')
        self.message_user(request, f'{updated} boutique(s) rejetée(s).')

    @admin.action(description='⭐ Mettre en vedette')
    def feature_shops(self, request, queryset):
        updated = queryset.update(is_featured=True)
        self.message_user(request, f'{updated} boutique(s) mise(s) en vedette.')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display   = ('user', 'plan', 'listings_used', 'valid_until', 'referral_bonus')
    list_filter    = ('plan',)
    search_fields  = ('user__full_name', 'user__phone_number')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display   = ('user', 'type', 'created_at')
    list_filter    = ('type',)
    search_fields  = ('user__full_name',)
    readonly_fields = ('id', 'created_at', 'updated_at')
