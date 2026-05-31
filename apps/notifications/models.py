from django.db import models
from core.models import BaseModel
from apps.accounts.models import User


class Notification(BaseModel):

    class Type(models.TextChoices):
        NEW_MESSAGE  = 'new_message',  'Nouveau message'
        ORDER_UPDATE = 'order_update', 'Mise à jour commande'
        NEW_REVIEW   = 'new_review',   'Nouvel avis'
        LISTING_SOLD = 'listing_sold', 'Annonce vendue'
        OTP          = 'otp',          'Code OTP'
        SYSTEM       = 'system',       'Système'

    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type    = models.CharField(max_length=20, choices=Type.choices)
    title   = models.CharField(max_length=200)
    body    = models.TextField()
    data    = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type} → {self.user.full_name}"

    def mark_as_read(self):
        self.is_read = True
        self.save(update_fields=['is_read'])

    @classmethod
    def send(cls, user, type, title, body, data=None):
        notif = cls.objects.create(
            user=user,
            type=type,
            title=title,
            body=body,
            data=data or {}
        )
        # Pousser en temps réel via WebSocket (silencieux si channels non dispo)
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    f"user_{user.id}",
                    {
                        'type':              'notification.message',
                        'notification_type': type,
                        'title':             title,
                        'body':              body,
                        'data':              data or {},
                        'notif_id':          str(notif.id),
                    }
                )
        except Exception:
            pass
        return notif