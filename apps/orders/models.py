from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.listings.models import Listing


class DeliveryZone(BaseModel):
    """Tarif fixe de livraison à domicile par ville."""
    city           = models.CharField(max_length=100, unique=True, db_index=True)
    fee_gnf        = models.BigIntegerField(default=0, help_text="Frais de livraison en GNF")
    estimated_days = models.PositiveSmallIntegerField(default=1, help_text="Délai estimé en jours ouvrables")
    is_active      = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Zone de livraison'
        verbose_name_plural = 'Zones de livraison'
        ordering            = ['city']

    def __str__(self):
        return f"{self.city} — {self.fee_gnf:,} GNF ({self.estimated_days}j)"


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


class MeetingZone(BaseModel):
    """Zone de rencontre pour remise en main propre."""
    city      = models.CharField(max_length=100, db_index=True)
    name      = models.CharField(max_length=200)
    address   = models.CharField(max_length=300, blank=True)
    latitude  = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Zone de rencontre'
        verbose_name_plural = 'Zones de rencontre'
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

    COMMISSION_PCT = 4  # 4 % de commission plateforme (transparente pour l'acheteur)

    listing            = models.ForeignKey(Listing,     on_delete=models.PROTECT,  related_name='orders')
    buyer              = models.ForeignKey(User,        on_delete=models.PROTECT,  related_name='orders_as_buyer')
    seller             = models.ForeignKey(User,        on_delete=models.PROTECT,  related_name='orders_as_seller')
    amount_gnf         = models.BigIntegerField()
    commission_gnf     = models.BigIntegerField(default=0)
    seller_payout_gnf  = models.BigIntegerField(default=0)
    status             = models.CharField(max_length=12, choices=Status.choices,       default=Status.PENDING)
    delivery_mode      = models.CharField(max_length=15, choices=DeliveryMode.choices, default=DeliveryMode.MEETING_POINT)
    pickup_point       = models.ForeignKey(PickupPoint, on_delete=models.SET_NULL,     null=True, blank=True, related_name='orders')
    meet_location      = models.CharField(max_length=255, blank=True)
    escrow_status      = models.CharField(max_length=10, choices=EscrowStatus.choices, default=EscrowStatus.NONE)
    escrow_released_at = models.DateTimeField(null=True, blank=True)
    escrow_release_at  = models.DateTimeField(null=True, blank=True)   # date planifiée de libération auto
    escrow_admin_hold  = models.BooleanField(default=False)             # admin a bloqué manuellement
    note               = models.TextField(blank=True)
    delivery_address   = models.CharField(max_length=400, blank=True, help_text="Adresse de livraison à domicile")
    delivery_fee_gnf   = models.BigIntegerField(default=0, help_text="Frais de livraison inclus dans amount_gnf")

    # Seuils escrow
    LARGE_AMOUNT_GNF  = 500_000   # montants ≥ 500 000 GNF → délai étendu + alerte admin
    ESCROW_DELAY_STD  = 6         # heures pour petits montants
    ESCROW_DELAY_LARGE = 48       # heures pour gros montants

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

    def set_escrow_schedule(self):
        """
        Planifie la libération automatique des fonds selon le montant.
        - < 500 000 GNF : libération dans 6h (fenêtre annulation OM dépassée)
        - ≥ 500 000 GNF : libération dans 48h + alerte admin immédiate
        """
        from django.utils import timezone
        from datetime import timedelta
        is_large = self.amount_gnf >= self.LARGE_AMOUNT_GNF
        delay    = self.ESCROW_DELAY_LARGE if is_large else self.ESCROW_DELAY_STD
        self.escrow_release_at = timezone.now() + timedelta(hours=delay)
        self.escrow_status     = self.EscrowStatus.HELD
        self.save(update_fields=['escrow_status', 'escrow_release_at', 'updated_at'])

        if is_large:
            # Notifier l'admin immédiatement
            try:
                from apps.notifications.models import Notification
                from django.contrib.auth import get_user_model
                User = get_user_model()
                admins = User.objects.filter(is_staff=True)
                for admin in admins:
                    Notification.send(
                        user=admin,
                        type=Notification.Type.SYSTEM,
                        title='⚠️ Gros paiement en escrow',
                        body=f'Transaction de {self.amount_gnf:,} GNF pour « {self.listing.title} ». '
                             f'Libération automatique dans 48h. Vérifiez si nécessaire.',
                        data={'order_id': str(self.id)},
                    )
                # SMS admin
                from core.sms import send_sms
                for admin in admins:
                    try:
                        send_sms(
                            str(admin.phone_number),
                            f'Guimatrix: Gros paiement {self.amount_gnf:,} GNF reçu '
                            f'(commande {str(self.id)[:8]}). Libération auto dans 48h. '
                            f'Bloquez sur l\'admin si fraude détectée.'
                        )
                    except Exception:
                        pass
            except Exception:
                pass

    def release_escrow(self):
        from django.utils import timezone
        self.commission_gnf    = int(self.amount_gnf * self.COMMISSION_PCT / 100)
        self.seller_payout_gnf = self.amount_gnf - self.commission_gnf
        self.escrow_status      = self.EscrowStatus.RELEASED
        self.escrow_released_at = timezone.now()
        self.save(update_fields=[
            'commission_gnf', 'seller_payout_gnf',
            'escrow_status', 'escrow_released_at', 'updated_at',
        ])
        # Incrémenter le compteur de ventes du vendeur
        profile = self.seller.profile
        profile.total_sales += 1
        profile.save(update_fields=['total_sales'])
        # Vérifier les badges après chaque vente
        from apps.accounts.models import Badge
        Badge.check_and_award(self.seller)

    def refund_escrow(self):
        self.escrow_status = self.EscrowStatus.REFUNDED
        self.save(update_fields=['escrow_status', 'updated_at'])


class Payment(BaseModel):

    class Provider(models.TextChoices):
        ORANGE_MONEY = 'orange_money', 'Orange Money'
        MTN_MOMO     = 'mtn_momo',     'MTN Mobile Money'
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
