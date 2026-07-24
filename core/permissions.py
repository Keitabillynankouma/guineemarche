from rest_framework.permissions import BasePermission


class IsSeller(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_seller


class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.seller == request.user or obj.user == request.user


class IsAdmin(BasePermission):
    """Tout rôle admin (général, super, livraison, marketing, comptabilité)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


class IsSuperAdmin(BasePermission):
    """Super admin ou admin général — accès complet."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_super_admin


class IsAdminDelivery(BasePermission):
    """Admin livraison, super admin, ou admin général."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_manage_deliveries


class IsAdminMarketing(BasePermission):
    """Admin marketing, super admin, ou admin général."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_manage_marketing


class IsAdminAccounting(BasePermission):
    """Admin comptable, super admin, ou admin général."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.can_manage_accounting