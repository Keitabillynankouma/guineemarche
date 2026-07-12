from django.contrib import admin
from .models import Order, PickupPoint, MeetingZone, DeliveryZone, Payment, DeliveryAssignment


@admin.register(PickupPoint)
class PickupPointAdmin(admin.ModelAdmin):
    list_display   = ('name', 'city', 'commune', 'address', 'phone', 'is_active')
    list_filter    = ('city', 'is_active')
    search_fields  = ('name', 'address', 'city', 'commune')
    list_editable  = ('is_active',)
    ordering       = ('city', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(MeetingZone)
class MeetingZoneAdmin(admin.ModelAdmin):
    list_display   = ('name', 'city', 'address', 'is_active')
    list_filter    = ('city', 'is_active')
    search_fields  = ('name', 'city', 'address')
    list_editable  = ('is_active',)
    ordering       = ('city', 'name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display   = ('city', 'fee_gnf', 'estimated_days', 'is_active')
    list_filter    = ('is_active',)
    search_fields  = ('city',)
    list_editable  = ('fee_gnf', 'estimated_days', 'is_active')
    ordering       = ('city',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display   = ('id', 'listing', 'buyer', 'seller', 'status', 'delivery_mode', 'amount_gnf', 'escrow_status', 'created_at')
    list_filter    = ('status', 'delivery_mode', 'escrow_status')
    search_fields  = ('buyer__full_name', 'buyer__phone_number', 'seller__full_name', 'listing__title')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering       = ('-created_at',)
    actions        = ['confirm_orders', 'cancel_orders']

    @admin.action(description='✅ Confirmer les commandes sélectionnées')
    def confirm_orders(self, request, queryset):
        for order in queryset.filter(status='pending'):
            order.confirm()
        self.message_user(request, 'Commandes confirmées.')

    @admin.action(description='❌ Annuler les commandes sélectionnées')
    def cancel_orders(self, request, queryset):
        for order in queryset.filter(status__in=['pending', 'confirmed']):
            order.cancel()
        self.message_user(request, 'Commandes annulées.')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display   = ('id', 'order', 'provider', 'phone_number', 'amount_gnf', 'status', 'created_at')
    list_filter    = ('provider', 'status')
    search_fields  = ('phone_number', 'external_ref', 'order__buyer__full_name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering       = ('-created_at',)


@admin.register(DeliveryAssignment)
class DeliveryAssignmentAdmin(admin.ModelAdmin):
    list_display   = ('order', 'livreur', 'status', 'verification_code', 'assigned_at', 'delivered_at')
    list_filter    = ('status',)
    search_fields  = ('livreur__full_name', 'livreur__phone_number', 'order__buyer__full_name', 'verification_code')
    readonly_fields = ('id', 'verification_code', 'assigned_at', 'created_at', 'updated_at')
    ordering       = ('-assigned_at',)
    actions        = ['mark_delivered']

    @admin.action(description='✅ Marquer comme livrées')
    def mark_delivered(self, request, queryset):
        from django.utils import timezone
        queryset.update(status='delivered', delivered_at=timezone.now())
        self.message_user(request, 'Livraisons marquées comme livrées.')
