from rest_framework.permissions import BasePermission


class IsSeller(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_seller


class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.seller == request.user or obj.user == request.user


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin