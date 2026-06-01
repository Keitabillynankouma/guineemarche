from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.listings.models import Listing


class PickupPoint(BaseModel):
    name      = models.CharField(max_length=200)
    address   = models.CharField(max_length=300)
    city      = models.CharField(max_length=100, default='Conakry')
    commune   = models.CharField(max_length=100, blank=True)
    phone     = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Point de retrait'
        verbose_name_plural = 'Points de retrait'
        ordering            = ['city', 'name']

    def __str__(self):
        return f"{self.name} — {self.city}"


class Order(BaseModel):

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        CONFIRMED = 'confirmed', 'Confirmée'
        COMPLETED = 'completed', 'Terminée'
        CANCELLED = 'cancelled', 'Annulée'
        DISPUTED  = 'disputed',  'Litige'

    class DeliveryMode(models.TextChoices):
        MEETING_POINT = 'meeting_point', 'Remise en main propre'
        PICKUP_POINT  = 'pickup_point',  'Point de retrait'
        HOME_DELIVERY = 'home_delivery', 'Livraison à domicile'

    class EscrowStatus(models.TextChoices):
        NONE     = 'none',     'Sans escrow'
        HELD     = 'held',     'Fonds retenus'
        RELEASED = 'released', 'Fonds libérés'
        REFUNDED = 'refunded', 'Remboursé'

    listing            = models.ForeignKey(Listing,     on_delete=models.PROTECT,  related_name='orders')
    buyer              = models.ForeignKey(User,        on_delete=models.PROTECT,  related_name='orders_as_buyer')
    seller             = models.ForeignKey(User,        on_delete=models.PROTECT,  related_name='orders_as_seller')
    amount_gnf         = models.BigIntegerField()
    status             = models.CharField(max_length=12, choices=Status.choices,       default=Status.PENDING)
    delivery_mode      = models.CharField(max_length=15, choices=DeliveryMode.choices, default=DeliveryMode.MEETING_POINT)
    pickup_point       = models.ForeignKey(PickupPoint, on_delete=models.SET_NULL,     null=True, blank=True, related_name='orders')
    meet_location      = models.CharField(max_length=255, blank=True)
    escrow_status      = models.CharField(max_length=10, choices=EscrowStatus.choices, default=EscrowStatus.NONE)
    escrow_released_at = models.DateTimeField(null=True, blank=True)
    note               = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Commande'
        verbose_name_plural = 'Commandes'
        ordering            = ['-created_at']

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

    def release_escrow(self):
        from django.utils import timezone
        self.escrow_status      = self.EscrowStatus.RELEASED
        self.escrow_released_at = timezone.now()
        self.save(update_fields=['escrow_status', 'escrow_released_at', 'updated_at'])

    def refund_escrow(self):
        self.escrow_status = self.EscrowStatus.REFUNDED
        self.save(update_fields=['escrow_status', 'updated_at'])


class Payment(BaseModel):

    class Provider(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        MTN_MOMO     = 'mtn_momo',     'MTN MoMo'
        CASH         = 'cash',         'Espèces (remise en main)'
        CARD         = 'card',         'Carte bancaire'

    class Status(models.TextChoices):
        PENDING  = 'pending',  'En attente'
        SUCCESS  = 'success',  'Réussi'
        FAILED   = 'failed',   'Échoué'
        REFUNDED = 'refunded', 'Remboursé'

    order        = models.ForeignKey(Order, on_delete=models.PROTECT, related_name='payments')
    provider     = models.CharField(max_length=15, choices=Provider.choices)
    phone_number = models.CharField(max_length=20, blank=True)
    amount_gnf   = models.BigIntegerField()
    status       = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    external_ref = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name        = 'Paiement'
        verbose_name_plural = 'Paiements'
        ordering            = ['-created_at']

    def __str__(self):
        return f"Paiement {self.provider} — {self.amount_gnf} GNF"
