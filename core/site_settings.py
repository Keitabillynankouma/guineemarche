"""
SiteSettings — modèle singleton pour les paramètres globaux de GuinéeMarché.
Un seul enregistrement (pk=1) créé automatiquement au premier accès.
"""
from django.db import models


class SiteSettings(models.Model):

    # ── Monétisation ──────────────────────────────────────────────────────────
    free_listings_enabled = models.BooleanField(
        default=True,
        verbose_name="Publications gratuites illimitées",
        help_text="Si activé, tous les utilisateurs publient sans limite (ignore les abonnements).",
    )
    subscriptions_enabled = models.BooleanField(
        default=False,
        verbose_name="Abonnements actifs",
        help_text="Affiche la page Tarifs et active les vérifications de plan.",
    )
    max_free_listings = models.PositiveSmallIntegerField(
        default=5,
        verbose_name="Limite annonces gratuites",
        help_text="Nombre d'annonces autorisées sur le plan gratuit (si abonnements actifs).",
    )
    commission_pct = models.PositiveSmallIntegerField(
        default=4,
        verbose_name="Commission escrow (%)",
        help_text="Pourcentage prélevé sur les transactions Mobile Money en escrow.",
    )

    # ── Fonctionnalités ───────────────────────────────────────────────────────
    escrow_enabled = models.BooleanField(
        default=True,
        verbose_name="Paiement escrow activé",
        help_text="Active le flux de paiement sécurisé via Mobile Money.",
    )
    shop_approval_required = models.BooleanField(
        default=True,
        verbose_name="Validation boutique par admin",
        help_text="Les nouvelles boutiques doivent être approuvées avant d'être visibles.",
    )

    # ── Contact ───────────────────────────────────────────────────────────────
    whatsapp_contact = models.CharField(
        max_length=30, blank=True, default='',
        verbose_name="WhatsApp support",
        help_text="Numéro WhatsApp support visible sur le site (ex: 224XXXXXXXXX).",
    )
    support_email = models.EmailField(
        blank=True, default='',
        verbose_name="Email support",
        help_text="Adresse email de support visible sur le site.",
    )
    site_name = models.CharField(max_length=100, default='GuinéeMarché')
    tagline    = models.CharField(max_length=200, blank=True, default='Le marché en ligne de la Guinée')

    # ── Maintenance ──────────────────────────────────────────────────────────
    maintenance_mode = models.BooleanField(
        default=False,
        verbose_name="Mode maintenance",
        help_text="Affiche une bannière de maintenance sur toutes les pages.",
    )
    maintenance_message = models.TextField(
        blank=True, default='',
        verbose_name="Message de maintenance",
    )

    class Meta:
        verbose_name = 'Paramètres du site'

    def __str__(self):
        return 'Paramètres GuinéeMarché'

    def save(self, *args, **kwargs):
        # Forcer pk=1 (singleton)
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass  # Indestructible

    @classmethod
    def get(cls):
        """Retourne l'instance unique, la crée si inexistante."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @classmethod
    def flag(cls, name, default=None):
        """Raccourci pour lire un flag sans exception."""
        try:
            return getattr(cls.get(), name, default)
        except Exception:
            return default
