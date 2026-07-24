from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.listings.models import Listing


class DeliveryZone(BaseModel):
    """Tarif de livraison à domicile par ville — base + surcharge distance + surcharge poids."""
    city              = models.CharField(max_length=100, unique=True, db_index=True)
    fee_gnf           = models.BigIntegerField(default=0,   help_text="Frais de base en GNF (inclut free_km_radius et free_weight_kg)")
    estimated_days    = models.PositiveSmallIntegerField(default=1, help_text="Délai estimé en jours ouvrables")
    is_active         = models.BooleanField(default=True)

    # ── Tarification à la distance ────────────────────────────────────────────
    free_km_radius    = models.PositiveSmallIntegerField(default=0,  help_text="Km inclus dans le tarif de base (0 = aucun)")
    price_per_km_gnf  = models.BigIntegerField(default=0,            help_text="Surcharge par km supplémentaire en GNF (0 = pas de surcharge)")

    # ── Tarification au poids ─────────────────────────────────────────────────
    free_weight_kg    = models.DecimalField(max_digits=6, decimal_places=2, default=0,
                                            help_text="Poids inclus dans le tarif de base en kg (0 = aucun)")
    price_per_kg_gnf  = models.BigIntegerField(default=0,            help_text="Surcharge par kg supplémentaire en GNF (0 = pas de surcharge)")

    class Meta:
        verbose_name        = 'Zone de livraison'
        verbose_name_plural = 'Zones de livraison'
        ordering            = ['city']

    def __str__(self):
        return f"{self.city} — {self.fee_gnf:,} GNF ({self.estimated_days}j)"

    def calculate_fee(self, distance_km=0, weight_kg=0):
        """Calcule le tarif total selon distance et poids."""
        distance_km = max(0.0, float(distance_km or 0))
        weight_kg   = max(0.0, float(weight_kg   or 0))

        dist_charge   = max(0.0, distance_km - float(self.free_km_radius))  * self.price_per_km_gnf
        weight_charge = max(0.0, weight_kg   - float(self.free_weight_kg))  * self.price_per_kg_gnf

        return {
            'fee_gnf':         int(self.fee_gnf + dist_charge + weight_charge),
            'base_fee_gnf':    int(self.fee_gnf),
            'distance_charge': int(dist_charge),
            'weight_charge':   int(weight_charge),
        }


class IntraCityZoneRate(BaseModel):
    """
    Tarif fixe entre deux communes d'une même ville (ex : Ratoma → Kaloum).
    Prioritaire sur le calcul distance × prix/km quand une paire est configurée.
    """
    city            = models.CharField(max_length=100, db_index=True)
    from_commune    = models.CharField(max_length=100, help_text="Commune du vendeur")
    to_commune      = models.CharField(max_length=100, help_text="Commune de l'acheteur")
    fee_gnf         = models.BigIntegerField(default=0)
    estimated_hours = models.PositiveSmallIntegerField(default=2, help_text="Délai indicatif en heures")
    is_active       = models.BooleanField(default=True)

    class Meta:
        verbose_name        = 'Tarif inter-commune'
        verbose_name_plural = 'Tarifs inter-communes'
        unique_together     = ('city', 'from_commune', 'to_commune')
        ordering            = ['city', 'from_commune', 'to_commune']

    def __str__(self):
        return f"{self.city} : {self.from_commune} → {self.to_commune} — {self.fee_gnf:,} GNF"


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
    delivery_fee_gnf      = models.BigIntegerField(default=0, help_text="Frais de livraison inclus dans amount_gnf")
    delivery_distance_km   = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True,
                                                 help_text="Distance de livraison en km (GPS ou saisie manuelle)")
    delivery_weight_kg     = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                                 help_text="Poids du colis en kg (saisie par l'acheteur)")
    delivery_buyer_commune = models.CharField(max_length=100, blank=True,
                                              help_text="Commune de l'acheteur — déclenche la tarification inter-commune")

    # Seuils escrow — configurables dans SiteSettings (escrow_delay_std_h, escrow_delay_large_h)
    LARGE_AMOUNT_GNF   = 500_000  # montants ≥ 500 000 GNF → délai étendu + alerte admin
    ESCROW_DELAY_STD   = 24       # heures pour petits montants (défaut 24h)
    ESCROW_DELAY_LARGE = 72       # heures pour gros montants (défaut 72h)

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
        if self.status != self.Status.PENDING:
            return  # Idempotent : ne rien faire si déjà confirmé/annulé/terminé
        self.status = self.Status.CONFIRMED
        self.save(update_fields=['status', 'updated_at'])

    def complete(self):
        if self.status != self.Status.CONFIRMED:
            return  # Seulement depuis CONFIRMED
        self.status = self.Status.COMPLETED
        self.save(update_fields=['status', 'updated_at'])
        # Marquer l'annonce comme vendue
        try:
            listing = self.listing
            if listing.status != 'sold':
                listing.status = 'sold'
                listing.save(update_fields=['status'])
        except Exception:
            pass

    def cancel(self):
        if self.status not in (self.Status.PENDING, self.Status.CONFIRMED):
            return  # Ne pas annuler si déjà terminé ou annulé
        # Si des fonds sont en escrow, les rembourser automatiquement
        if self.escrow_status == self.EscrowStatus.HELD:
            self.refund_escrow()
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
        from core.site_settings import SiteSettings
        is_large = self.amount_gnf >= self.LARGE_AMOUNT_GNF
        delay_std   = SiteSettings.flag('escrow_delay_std_h',   default=self.ESCROW_DELAY_STD)
        delay_large = SiteSettings.flag('escrow_delay_large_h', default=self.ESCROW_DELAY_LARGE)
        delay    = delay_large if is_large else delay_std
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
        from core.site_settings import SiteSettings
        # Commission calculée uniquement sur le prix de l'article, pas sur les frais de livraison
        commission_pct         = SiteSettings.flag('commission_pct', default=self.COMMISSION_PCT)
        item_amount            = self.amount_gnf - (self.delivery_fee_gnf or 0)
        self.commission_gnf    = int(item_amount * commission_pct / 100)
        # Le vendeur reçoit : prix article - commission (les frais de livraison vont au livreur)
        self.seller_payout_gnf = item_amount - self.commission_gnf
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
        CHACHAP      = 'chachap',      'ChaChap Pay'
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


class DeliveryAssignment(BaseModel):
    """Affectation d'un livreur à une commande home_delivery."""

    class Status(models.TextChoices):
        ASSIGNED  = 'assigned',  'Affectée'
        EN_ROUTE  = 'en_route',  'En route'
        DELIVERED = 'delivered', 'Livrée'
        FAILED    = 'failed',    'Échec livraison'

    order             = models.OneToOneField(Order,  on_delete=models.CASCADE, related_name='delivery_assignment')
    livreur           = models.ForeignKey(User,   on_delete=models.PROTECT,  related_name='delivery_assignments')
    status            = models.CharField(max_length=12, choices=Status.choices, default=Status.ASSIGNED)
    verification_code = models.CharField(max_length=6, help_text="Code 6 chiffres que l'acheteur fournit au livreur à la réception")
    pickup_code       = models.CharField(max_length=6, blank=True, help_text="Code 6 chiffres que le livreur montre au vendeur pour récupérer le colis")
    assigned_at       = models.DateTimeField(auto_now_add=True)
    delivered_at      = models.DateTimeField(null=True, blank=True)
    notes             = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Affectation livreur'
        verbose_name_plural = 'Affectations livreurs'
        ordering            = ['-assigned_at']

    def __str__(self):
        return f"Livraison #{str(self.order.id)[:8]} → {self.livreur.full_name}"

    def save(self, *args, **kwargs):
        import random
        if not self.verification_code:
            self.verification_code = str(random.randint(100000, 999999))
        if not self.pickup_code:
            self.pickup_code = str(random.randint(100000, 999999))
        super().save(*args, **kwargs)


# ── Paiements livreurs ────────────────────────────────────────────────────────

class LivreurPayment(BaseModel):
    """
    Gain d'un livreur pour une livraison effectuée.
    Créé automatiquement quand la livraison est confirmée (DeliveryAssignment.status = DELIVERED).

    Split configurable dans SiteSettings.livreur_commission_pct (défaut 80 %).
    → Si delivery_fee_gnf = 50 000 GNF et livreur_pct = 80 :
        net_gnf           = 40 000 GNF  (reversé au livreur)
        platform_cut_gnf  = 10 000 GNF  (garde la plateforme)
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'À payer'
        PAID    = 'paid',    'Payé'

    LIVREUR_PCT_DEFAULT = 80  # part livreur par défaut si SiteSettings indisponible

    assignment       = models.OneToOneField(
        'DeliveryAssignment', on_delete=models.CASCADE, related_name='livreur_payment'
    )
    livreur          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='livreur_payments')
    gross_gnf        = models.BigIntegerField(help_text="Frais de livraison bruts (delivery_fee_gnf)")
    platform_cut_gnf = models.BigIntegerField(default=0, help_text="Part plateforme")
    net_gnf          = models.BigIntegerField(help_text="Montant net à verser au livreur")
    status           = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_at          = models.DateTimeField(null=True, blank=True)
    payment_ref      = models.CharField(max_length=150, blank=True, help_text="Référence virement/OM/MTN")
    note             = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Paiement livreur'
        verbose_name_plural = 'Paiements livreurs'
        ordering            = ['-created_at']

    def __str__(self):
        return f"{self.livreur.full_name} — {self.net_gnf:,} GNF ({self.status})"

    @classmethod
    def create_for_assignment(cls, assignment):
        """
        Crée (ou récupère) le paiement livreur pour une affectation.
        Appelé quand la livraison est confirmée.
        """
        if cls.objects.filter(assignment=assignment).exists():
            return  # déjà créé

        delivery_fee = assignment.order.delivery_fee_gnf or 0
        if delivery_fee <= 0:
            return  # pas de frais = pas de paiement

        try:
            from core.site_settings import SiteSettings
            pct = SiteSettings.flag('livreur_commission_pct', default=cls.LIVREUR_PCT_DEFAULT)
        except Exception:
            pct = cls.LIVREUR_PCT_DEFAULT

        net          = int(delivery_fee * pct / 100)
        platform_cut = delivery_fee - net

        cls.objects.create(
            assignment=assignment,
            livreur=assignment.livreur,
            gross_gnf=delivery_fee,
            platform_cut_gnf=platform_cut,
            net_gnf=net,
        )


# ── Amendes livreurs ──────────────────────────────────────────────────────────

class LivreurFine(BaseModel):
    """
    Amende infligée à un livreur par l'admin (retard, colis abîmé, mauvaise conduite...).
    Déduite du prochain virement hebdomadaire.
    """

    class Reason(models.TextChoices):
        LATE_DELIVERY    = 'late_delivery',    'Retard de livraison'
        DAMAGED_PACKAGE  = 'damaged_package',  'Colis abîmé'
        BAD_BEHAVIOR     = 'bad_behavior',     'Mauvaise conduite'
        FRAUD_ATTEMPT    = 'fraud_attempt',    'Tentative de fraude'
        NO_SHOW          = 'no_show',          'Absence injustifiée'
        OTHER            = 'other',            'Autre'

    class Status(models.TextChoices):
        PENDING  = 'pending',  'À déduire'
        DEDUCTED = 'deducted', 'Déduite'
        WAIVED   = 'waived',   'Annulée'

    livreur    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fines')
    amount_gnf = models.BigIntegerField(help_text="Montant de l'amende en GNF")
    reason     = models.CharField(max_length=20, choices=Reason.choices, default=Reason.OTHER)
    description = models.TextField(blank=True, help_text="Détail de l'amende")
    status     = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    deducted_at = models.DateTimeField(null=True, blank=True)
    order      = models.ForeignKey('Order', null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name='livreur_fines', help_text="Commande liée (optionnel)")
    admin_note = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Amende livreur'
        verbose_name_plural = 'Amendes livreurs'
        ordering            = ['-created_at']

    def __str__(self):
        return f"Amende {self.livreur.full_name} — {self.amount_gnf:,} GNF ({self.status})"


# ── Virements hebdomadaires livreurs ──────────────────────────────────────────

class LivreurWeeklyPayout(BaseModel):
    """
    Récapitulatif de virement hebdomadaire pour un livreur.
    Créé chaque semaine par la tâche Celery weekly_livreur_payouts.
    Regroupe tous les LivreurPayment PENDING de la semaine - les amendes PENDING.
    """

    class Status(models.TextChoices):
        PENDING  = 'pending',  'En attente'
        PAID     = 'paid',     'Versé'
        PARTIAL  = 'partial',  'Versement partiel'
        ON_HOLD  = 'on_hold',  'Bloqué'

    livreur          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='weekly_payouts')
    week_start       = models.DateField(help_text="Lundi de la semaine (ISO)")
    week_end         = models.DateField(help_text="Dimanche de la semaine (ISO)")
    deliveries_count = models.PositiveIntegerField(default=0)
    gross_gnf        = models.BigIntegerField(default=0, help_text="Total brut livraisons")
    fines_gnf        = models.BigIntegerField(default=0, help_text="Total amendes déduites")
    net_gnf          = models.BigIntegerField(default=0, help_text="Net à verser = brut - amendes")
    status           = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    paid_at          = models.DateTimeField(null=True, blank=True)
    payment_ref      = models.CharField(max_length=150, blank=True)
    payment_method   = models.CharField(max_length=50, blank=True, help_text="Ex: orange_money, mtn, virement")
    note             = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Virement hebdomadaire livreur'
        verbose_name_plural = 'Virements hebdomadaires livreurs'
        ordering            = ['-week_start']
        unique_together     = [('livreur', 'week_start')]

    def __str__(self):
        return f"{self.livreur.full_name} semaine du {self.week_start} — {self.net_gnf:,} GNF ({self.status})"

    @classmethod
    def generate_for_week(cls, week_start_date):
        """
        Génère les récapitulatifs de la semaine pour tous les livreurs ayant des paiements PENDING.
        Appelé par la tâche Celery chaque lundi matin.
        """
        from datetime import timedelta
        week_end = week_start_date + timedelta(days=6)

        # Trouver tous les livreurs avec des paiements en attente créés dans la semaine
        pending_payments = LivreurPayment.objects.filter(
            status=LivreurPayment.Status.PENDING,
            created_at__date__gte=week_start_date,
            created_at__date__lte=week_end,
        ).select_related('livreur')

        livreurs_ids = pending_payments.values_list('livreur_id', flat=True).distinct()

        for livreur_id in livreurs_ids:
            payments = pending_payments.filter(livreur_id=livreur_id)
            fines    = LivreurFine.objects.filter(
                livreur_id=livreur_id,
                status=LivreurFine.Status.PENDING,
            )

            gross_gnf    = sum(p.net_gnf for p in payments)
            fines_gnf    = sum(f.amount_gnf for f in fines)
            net_gnf      = max(0, gross_gnf - fines_gnf)

            payout, created = cls.objects.get_or_create(
                livreur_id=livreur_id,
                week_start=week_start_date,
                defaults={
                    'week_end':         week_end,
                    'deliveries_count': payments.count(),
                    'gross_gnf':        gross_gnf,
                    'fines_gnf':        fines_gnf,
                    'net_gnf':          net_gnf,
                }
            )
            if not created:
                payout.deliveries_count = payments.count()
                payout.gross_gnf  = gross_gnf
                payout.fines_gnf  = fines_gnf
                payout.net_gnf    = net_gnf
                payout.save(update_fields=['deliveries_count', 'gross_gnf', 'fines_gnf', 'net_gnf', 'updated_at'])

        return livreurs_ids.count()


# ── Demandes de retour ─────────────────────────────────────────────────────────

class ReturnRequest(BaseModel):
    """Demande de retour d'une commande terminée, déposée par l'acheteur."""

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        APPROVED  = 'approved',  'Approuvé'
        REJECTED  = 'rejected',  'Refusé'
        COMPLETED = 'completed', 'Retour effectué'

    class Reason(models.TextChoices):
        DEFECTIVE        = 'defective',        'Article défectueux'
        NOT_AS_DESCRIBED = 'not_as_described',  'Ne correspond pas à la description'
        WRONG_ITEM       = 'wrong_item',        'Mauvais article reçu'
        CHANGED_MIND     = 'changed_mind',      "Changement d'avis"
        OTHER            = 'other',             'Autre'

    order       = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='return_request',
        help_text="La commande concernée (doit être terminée)"
    )
    reason      = models.CharField(max_length=20, choices=Reason.choices)
    description = models.TextField(blank=True, help_text="Détail optionnel de la demande")
    status      = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    admin_note  = models.TextField(blank=True, help_text="Note interne de l'admin lors du traitement")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name        = 'Demande de retour'
        verbose_name_plural = 'Demandes de retour'
        ordering            = ['-created_at']

    def __str__(self):
        return f"Retour #{str(self.order.id)[:8]} — {self.get_status_display()}"
