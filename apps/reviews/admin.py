from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display   = ('reviewer', 'reviewee', 'rating', 'order', 'created_at')
    list_filter    = ('rating',)
    search_fields  = ('reviewer__full_name', 'reviewee__full_name', 'comment')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
