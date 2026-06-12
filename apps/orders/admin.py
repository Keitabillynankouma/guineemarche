from django.contrib import admin
from .models import Order, PickupPoint


@admin.register(PickupPoint)
class PickupPointAdmin(admin.ModelAdmin):
    list_display  = ('name', 'city', 'commune', 'address', 'phone', 'is_active')
    list_filter   = ('city', 'is_active')
    search_fields = ('name', 'address', 'city', 'commune')
    list_editable = ('is_active',)
    ordering      = ('city', 'name')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = ('id', 'listing', 'buyer', 'status', 'delivery_mode', 'created_at')
    list_filter   = ('status', 'delivery_mode')
    search_fields = ('buyer__full_name', 'listing__title')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering      = ('-created_at',)
