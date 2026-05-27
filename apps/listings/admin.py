from django.contrib import admin
from .models import Category, Listing, ListingMedia, Favorite, ListingReport


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'parent', 'is_active', 'sort_order')
    list_filter   = ('is_active', 'parent')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}


class ListingMediaInline(admin.TabularInline):
    model  = ListingMedia
    extra  = 1
    fields = ('file', 'media_type', 'sort_order', 'is_cover')


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display  = ('title', 'seller', 'category', 'price_gnf', 'price_type', 'status', 'is_boosted', 'created_at')
    list_filter   = ('status', 'price_type', 'condition', 'city', 'is_boosted')
    search_fields = ('title', 'seller__full_name', 'seller__phone_number')
    inlines       = [ListingMediaInline]
    readonly_fields = ('view_count', 'created_at', 'updated_at')


@admin.register(ListingReport)
class ListingReportAdmin(admin.ModelAdmin):
    list_display  = ('listing', 'reporter', 'reason', 'status', 'created_at')
    list_filter   = ('reason', 'status')