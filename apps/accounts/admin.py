from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile, OTPCode, Session


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('phone_number', 'full_name', 'role', 'city', 'is_verified', 'is_active')
    list_filter   = ('role', 'is_verified', 'is_active', 'city')
    search_fields = ('phone_number', 'full_name', 'email')
    ordering      = ('-created_at',)

    fieldsets = (
        (None,           {'fields': ('phone_number', 'password')}),
        ('Informations', {'fields': ('full_name', 'email', 'role', 'city', 'quartier')}),
        ('Statut',       {'fields': ('is_verified', 'is_active', 'is_staff', 'is_superuser')}),
        ('Permissions',  {'fields': ('groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'full_name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display  = ('user', 'rating_avg', 'total_ratings', 'total_sales')
    search_fields = ('user__phone_number', 'user__full_name')


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display  = ('user', 'code', 'purpose', 'is_used', 'expires_at')
    list_filter   = ('purpose', 'is_used')
    search_fields = ('user__phone_number',)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display  = ('user', 'device_info', 'expires_at')
    search_fields = ('user__phone_number',)