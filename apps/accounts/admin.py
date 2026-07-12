from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile, OTPCode, Session, Shop, Subscription, Badge


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display   = ('full_name', 'phone_number', 'email', 'role', 'city', 'is_verified', 'is_active', 'created_at')
    list_filter    = ('role', 'is_verified', 'is_active', 'city')
    search_fields  = ('full_name', 'phone_number', 'email')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'referral_code')

    fieldsets = (
        (None,           {'fields': ('phone_number', 'password')}),
        ('Informations', {'fields': ('full_name', 'email', 'role', 'city', 'quartier')}),
        ('Statut',       {'fields': ('is_verified', 'is_active', 'is_staff', 'is_superuser')}),
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
