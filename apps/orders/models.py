from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.listings.models import Listing


class Order(BaseModel):

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        CONFIRMED = 'confirmed', 'Confirmée'
        COMPLETED = 'completed', 'Terminée'
        CANCELLED = 'cancelled', 'Annulée'
        DISPUTED  = 'disputed',  'Litige'

    listing       = models.ForeignKey(Listing, on_delete=models.PROTECT, related_name='orders')
    buyer         = models.ForeignKey(User, on_delete=models.PROTECT, related_name='orders_as_buyer')
    seller        = models.ForeignKey(User, on_delete=models.PROTECT, related_name='orders_as_seller')
    amount_gnf    = models.BigIntegerField()
    status        = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    meet_location = models.CharField(max_length=255, blank=True)
    note          = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Commande'
        verbose_name_plural = 'Commandes'
        ordering = ['-created_at']

    def __str__(self):
        return f"Commande {self.id} — {self.listing.title}"

    @property
    def is_completed(self):
        return self.status == self.Status.COMPLETED

    def confirm(self):
        self.status = self.Status.CONFIRMED
        self.save(update_fields=['status', 'updated_at'])

    def complete(self):
        self.status = self.Status.COMPLETED
        self.save(update_fields=['status', 'updated_at'])

    def cancel(self):
        self.status = self.Status.CANCELLED
        self.save(update_fields=['status', 'updated_at'])


class Payment(BaseModel):

    class Provider(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        MTN_MOMO     = 'mtn_momo',     'MTN MoMo'
        CASH         = 'cash',         'Espèces (remise en main)'
        CARD         = 'card',         'Carte bancaire'

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        SUCCESS   = 'success',   'Réussi'
        FAILED    = 'failed',    'Échoué'
        REFUNDED  = 'refunded',  'Remboursé'

    order        = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='payments')
    provider     = models.CharField(max_length=15, choices=Provider.choices)
    phone_number = models.CharField(max_length=20, blank=True)
    amount_gnf   = models.BigIntegerField()
    status       = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    external_ref = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'Paiement'
        verbose_name_plural = 'Paiements'
        ordering = ['-created_at']

    def __str__(self):
        return f"Paiement {self.provider} — {self.amount_gnf} GNF"