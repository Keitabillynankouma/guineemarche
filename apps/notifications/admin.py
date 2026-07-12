from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display   = ('user', 'type', 'title', 'is_read', 'created_at')
    list_filter    = ('type', 'is_read')
    search_fields  = ('user__full_name', 'user__phone_number', 'title', 'body')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    actions        = ['mark_read', 'mark_unread']

    @admin.action(description='✅ Marquer comme lues')
    def mark_read(self, request, queryset):
        queryset.update(is_read=True)

    @admin.action(description='🔔 Marquer comme non lues')
    def mark_unread(self, request, queryset):
        queryset.update(is_read=False)
