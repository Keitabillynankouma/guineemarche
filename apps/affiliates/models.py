"""
Système d'affiliation Guimatrix — 3 niveaux.

Quand une commande est libérée de l'escrow (release_escrow), on remonte
la chaîne referred_by de l'acheteur sur 3 niveaux et on crédite chaque
affiliate actif d'une commission proportionnelle.

    N1 (influenceur direct de l'acheteur) : 3 % de l'item_amount
    N2 (influenceur de N1)                : 1,5 %
    N3 (influenceur de N2)                : 0,5 %

Ces commissions sont prélevées sur la part Guimatrix (pas sur le vendeur).
"""

from django.db import models
from core.models import BaseModel
from apps.accounts.models import User


# ─────────────────────────────────────────────────────────────────────────────
# Taux de commission par niveau (en pourcentage de l'item_amount)
# ─────────────────────────────────────────────────────────────────────────────
AFFILIATE_RATES = {1: 3.0, 2: 1.5, 3: 0.5}


class AffiliateProfile(BaseModel):
    """
    Marque un utilisateur comme affilié/influenceur actif.
    Un utilisateur ordinaire peut devenir affilié (approbation admin ou auto).
    """

    class Status(models.TextChoices):
        PENDING  = 'pending',  'En attente'
        ACTIVE   = 'active',   'Actif'
        INACTIVE = 'inactive', 'Inactif'
        BANNED   = 'banned',   'Banni'

    user             = models.OneToOneField(User, on_delete=models.CASCADE, related_name='affiliate_profile')
    status           = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    display_name     = models.CharField(max_length=150, blank=True, help_text='Nom de scène / marque')
    bio              = models.TextField(blank=True)

    # Statistiques cumulées (dénormalisées pour performance)
    total_clicks        = models.PositiveIntegerField(default=0)
    total_conversions   = models.PositiveIntegerField(default=0, help_text='Nombre de commandes générées via ce code')
    total_earned_gnf    = models.BigIntegerField(default=0, help_text='Total commissions gagnées (toutes statuts)')
    balance_gnf         = models.BigIntegerField(default=0, help_text='Solde disponible pour retrait')

    # Coordonnées de retrait (Mobile Money)
    payout_phone    = models.CharField(max_length=20, blank=True)
    payout_provider = models.CharField(
        max_length=15,
        choices=User.PayoutProvider.choices,
        blank=True,
    )

    # Note interne admin
    admin_note = models.TextField(blank=True)

    class Meta:
        verbose_name        = 'Profil affilié'
        verbose_name_plural = 'Profils affiliés'
        ordering            = ['-total_earned_gnf']

    def __str__(self):
        return f'Affilié — {self.user.full_name} ({self.status}) · {self.balance_gnf:,} GNF'

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    @property
    def referral_code(self):
        """Réutilise le code de parrainage existant sur User."""
        return self.user.referral_code

    def credit(self, amount_gnf: int):
        """Ajoute un montant au solde et aux stats cumulées."""
        self.balance_gnf     += amount_gnf
        self.total_earned_gnf += amount_gnf
        self.total_conversions += 1
        self.save(update_fields=['balance_gnf', 'total_earned_gnf', 'total_conversions', 'updated_at'])

    def debit(self, amount_gnf: int):
        """Déduit un montant du solde (lors d'un retrait)."""
        self.balance_gnf = max(0, self.balance_gnf - amount_gnf)
        self.save(update_fields=['balance_gnf', 'updated_at'])


class AffiliateCommission(BaseModel):
    """
    Une ligne de commission gagnée par un affilié, liée à une commande.
    Créée automatiquement lors du release_escrow() de la commande.
    """

    class Status(models.TextChoices):
        PENDING  = 'pending',  'En attente'   # créée, pas encore comptabilisée
        CREDITED = 'credited', 'Créditée'     # ajoutée au solde de l'affilié
        REVERSED = 'reversed', 'Annulée'      # commande annulée/retournée après coup

    affiliate    = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='commissions')
    order        = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='affiliate_commissions')
    level        = models.PositiveSmallIntegerField(
        choices=[(1, 'Niveau 1 — 3%'), (2, 'Niveau 2 — 1,5%'), (3, 'Niveau 3 — 0,5%')],
        help_text='Niveau dans l\'arborescence de parrainage',
    )
    rate_pct     = models.DecimalField(max_digits=4, decimal_places=2, help_text='Taux appliqué (ex : 3.00)')
    base_amount_gnf  = models.BigIntegerField(help_text='Montant sur lequel la commission est calculée (item_amount)')
    commission_gnf   = models.BigIntegerField(help_text='Commission calculée = base × rate_pct / 100')
    status       = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    credited_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name        = 'Commission affilié'
        verbose_name_plural = 'Commissions affiliés'
        ordering            = ['-created_at']
        unique_together     = (('affiliate', 'order', 'level'),)

    def __str__(self):
        return (
            f'Commission N{self.level} — {self.affiliate.user.full_name} '
            f'{self.commission_gnf:,} GNF ({self.status})'
        )

    def credit(self):
        """Crédite la commission sur le solde de l'affilié."""
        if self.status != self.Status.PENDING:
            return
        from django.utils import timezone
        self.affiliate.credit(self.commission_gnf)
        self.status      = self.Status.CREDITED
        self.credited_at = timezone.now()
        self.save(update_fields=['status', 'credited_at', 'updated_at'])

    def reverse(self):
        """Annule la commission (ex. remboursement de commande)."""
        if self.status == self.Status.CREDITED:
            self.affiliate.debit(self.commission_gnf)
        self.status = self.Status.REVERSED
        self.save(update_fields=['status', 'updated_at'])


class AffiliateWithdrawal(BaseModel):
    """
    Demande de retrait d'un affilié (vers Orange Money / MTN).
    Traitée manuellement par l'admin comptabilité.
    """

    class Status(models.TextChoices):
        PENDING   = 'pending',   'En attente'
        APPROVED  = 'approved',  'Approuvée'
        PAID      = 'paid',      'Versée'
        REJECTED  = 'rejected',  'Rejetée'

    MINIMUM_GNF = 50_000  # Solde minimum pour demander un retrait

    affiliate      = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='withdrawals')
    amount_gnf     = models.BigIntegerField()
    payout_phone   = models.CharField(max_length=20)
    payout_provider = models.CharField(max_length=15, choices=User.PayoutProvider.choices)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    admin_note     = models.TextField(blank=True)
    paid_at        = models.DateTimeField(null=True, blank=True)
    payment_ref    = models.CharField(max_length=150, blank=True)

    class Meta:
        verbose_name        = 'Retrait affilié'
        verbose_name_plural = 'Retraits affiliés'
        ordering            = ['-created_at']

    def __str__(self):
        return f'Retrait {self.affiliate.user.full_name} — {self.amount_gnf:,} GNF ({self.status})'

    def approve_and_pay(self, ref: str = '', note: str = ''):
        from django.utils import timezone
        self.status      = self.Status.PAID
        self.payment_ref = ref
        self.admin_note  = note
        self.paid_at     = timezone.now()
        self.save(update_fields=['status', 'payment_ref', 'admin_note', 'paid_at', 'updated_at'])

    def reject(self, note: str = ''):
        """Rejette la demande et recrédite le solde."""
        if self.status == self.Status.PENDING:
            self.affiliate.credit(self.amount_gnf)
            # Annuler le débit préventif
            self.affiliate.total_conversions = max(0, self.affiliate.total_conversions - 1)
            self.affiliate.save(update_fields=['total_conversions'])
        self.status     = self.Status.REJECTED
        self.admin_note = note
        self.save(update_fields=['status', 'admin_note', 'updated_at'])


# ─────────────────────────────────────────────────────────────────────────────
# Logique principale : calculer et créditer les commissions pour une commande
# ─────────────────────────────────────────────────────────────────────────────

def process_affiliate_commissions(order):
    """
    Appelé juste après order.release_escrow().
    Remonte la chaîne referred_by de l'acheteur sur 3 niveaux
    et crée les AffiliateCommission correspondantes.

    Returns: nombre de commissions créées.
    """
    buyer = order.buyer
    item_amount = order.amount_gnf - (order.delivery_fee_gnf or 0)
    if item_amount <= 0:
        return 0

    created = 0
    current_user = buyer  # on part de l'acheteur

    for level in (1, 2, 3):
        referrer = getattr(current_user, 'referred_by', None)
        if referrer is None:
            break  # plus de parrain → on s'arrête

        try:
            affiliate = referrer.affiliate_profile
            if not affiliate.is_active:
                current_user = referrer
                continue
        except AffiliateProfile.DoesNotExist:
            current_user = referrer
            continue

        rate = AFFILIATE_RATES[level]
        commission_gnf = int(item_amount * rate / 100)
        if commission_gnf <= 0:
            current_user = referrer
            continue

        commission, was_created = AffiliateCommission.objects.get_or_create(
            affiliate=affiliate,
            order=order,
            level=level,
            defaults={
                'rate_pct':        rate,
                'base_amount_gnf': item_amount,
                'commission_gnf':  commission_gnf,
                'status':          AffiliateCommission.Status.PENDING,
            },
        )

        if was_created:
            commission.credit()
            created += 1

            # Notifier l'affilié
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=referrer,
                    type=Notification.Type.SYSTEM,
                    title=f'💰 Commission affiliation N{level} reçue !',
                    body=(
                        f'Vous avez gagné {commission_gnf:,} GNF grâce à une vente '
                        f'générée via votre code de parrainage. '
                        f'Solde disponible : {affiliate.balance_gnf:,} GNF.'
                    ),
                    data={'order_id': str(order.id), 'commission_gnf': commission_gnf, 'level': level},
                )
            except Exception:
                pass

        current_user = referrer

    return created
