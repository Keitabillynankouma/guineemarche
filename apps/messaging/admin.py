from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model   = Message
    extra   = 0
    fields  = ('sender', 'msg_type', 'content', 'is_read', 'created_at')
    readonly_fields = ('created_at',)
    ordering = ('created_at',)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display   = ('buyer', 'seller', 'listing', 'last_message_at', 'created_at')
    search_fields  = ('buyer__full_name', 'seller__full_name', 'listing__title')
    ordering       = ('-last_message_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    inlines        = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display   = ('sender', 'conversation', 'msg_type', 'is_read', 'created_at')
    list_filter    = ('msg_type', 'is_read')
    search_fields  = ('sender__full_name', 'content')
    ordering       = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
