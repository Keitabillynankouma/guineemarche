from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.listings.models import Listing


class Conversation(BaseModel):
    listing = models.ForeignKey(
        Listing,
        on_delete=models.CASCADE,
        related_name='conversations'
    )
    buyer  = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_buyer')
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_as_seller')
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Conversation'
        verbose_name_plural = 'Conversations'
        ordering = ['-last_message_at']
        unique_together = ('listing', 'buyer', 'seller')

    def __str__(self):
        return f"{self.buyer.full_name} → {self.seller.full_name} | {self.listing.title}"


class Message(BaseModel):

    class MsgType(models.TextChoices):
        TEXT  = 'text',  'Texte'
        IMAGE = 'image', 'Image'
        OFFER = 'offer', 'Offre de prix'

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_sent')
    content      = models.TextField()
    msg_type     = models.CharField(max_length=10, choices=MsgType.choices, default=MsgType.TEXT)
    is_read      = models.BooleanField(default=False)

    # Si c'est une offre de prix
    offer_amount_gnf = models.BigIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.full_name}: {self.content[:50]}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=['is_read'])