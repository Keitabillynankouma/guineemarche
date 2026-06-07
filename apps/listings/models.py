from django.db import models
from django.utils.text import slugify
from core.models import BaseModel
from apps.accounts.models import User


class Category(BaseModel):
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='children'
    )
    name       = models.CharField(max_length=100)
    slug       = models.SlugField(unique=True, max_length=120)
    icon_url   = models.CharField(max_length=255, blank=True)
    is_active  = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Catégorie'
        verbose_name_plural = 'Catégories'
        ordering = ['sort_order', 'name']

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} › {self.name}"
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Listing(BaseModel):

    class PriceType(models.TextChoices):
        FIXED      = 'fixed',      'Prix fixe'
        NEGOTIABLE = 'negotiable', 'À débattre'
        FREE       = 'free',       'Gratuit / Don'

    class Condition(models.TextChoices):
        NEW      = 'new',      'Neuf'
        LIKE_NEW = 'like_new', 'Comme neuf'
        GOOD     = 'good',     'Bon état'
        FAIR     = 'fair',     'État correct'
        POOR     = 'poor',     'Très usé'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Brouillon'
        ACTIVE    = 'active',    'Active'
        SOLD      = 'sold',      'Vendue'
        EXPIRED   = 'expired',   'Expirée'
        SUSPENDED = 'suspended', 'Suspendue'

    seller      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listings')
    category    = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='listings')

    title       = models.CharField(max_length=200)
    description = models.TextField()
    price_gnf   = models.BigIntegerField(default=0)
    price_type  = models.CharField(max_length=12, choices=PriceType.choices, default=PriceType.FIXED)
    condition   = models.CharField(max_length=10, choices=Condition.choices, default=Condition.GOOD)
    status      = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, db_index=True)

    # Localisation guinéenne
    city        = models.CharField(max_length=100, default='Conakry', db_index=True)
    quartier    = models.CharField(max_length=100, blank=True)
    latitude    = models.FloatField(null=True, blank=True)
    longitude   = models.FloatField(null=True, blank=True)

    # Attributs dynamiques selon catégorie (ex: {"brand":"Toyota","year":"2020"})
    attributes  = models.JSONField(default=dict, blank=True)

    # Stats & boost
    view_count  = models.PositiveIntegerField(default=0)
    is_boosted  = models.BooleanField(default=False, db_index=True)
    expires_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Annonce'
        verbose_name_plural = 'Annonces'
        ordering = ['-is_boosted', '-created_at']
        indexes = [
            models.Index(fields=['status', 'city'],       name='listing_status_city_idx'),
            models.Index(fields=['status', 'is_boosted'], name='listing_status_boosted_idx'),
            models.Index(fields=['seller', 'status'],     name='listing_seller_status_idx'),
            models.Index(fields=['-created_at'],          name='listing_created_at_idx'),
        ]

    def __str__(self):
        return f"{self.title} — {self.seller.full_name}"

    @property
    def is_free(self):
        return self.price_type == self.PriceType.FREE

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE

    def increment_views(self):
        Listing.objects.filter(pk=self.pk).update(view_count=models.F('view_count') + 1)
        self.refresh_from_db(fields=['view_count'])


class ListingMedia(BaseModel):

    class MediaType(models.TextChoices):
        IMAGE = 'image', 'Image'
        VIDEO = 'video', 'Vidéo'

    listing    = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='media')
    file       = models.ImageField(upload_to='listings/%Y/%m/')
    media_type = models.CharField(max_length=10, choices=MediaType.choices, default=MediaType.IMAGE)
    sort_order = models.PositiveIntegerField(default=0)
    is_cover   = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Média'
        verbose_name_plural = 'Médias'
        ordering = ['sort_order']

    def __str__(self):
        return f"Média {self.sort_order} — {self.listing.title}"

    def save(self, *args, **kwargs):
        # Si c'est le premier média, il devient la couverture
        if not self.pk and not ListingMedia.objects.filter(listing=self.listing).exists():
            self.is_cover = True
        super().save(*args, **kwargs)


class CategoryAttribute(BaseModel):
    """Champs spécifiques à saisir selon la catégorie d'annonce."""

    class FieldType(models.TextChoices):
        TEXT    = 'text',    'Texte libre'
        NUMBER  = 'number',  'Nombre'
        SELECT  = 'select',  'Liste de choix'
        YEAR    = 'year',    'Année'
        BOOLEAN = 'boolean', 'Oui / Non'

    category    = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='attributes')
    name        = models.CharField(max_length=100)
    key         = models.CharField(max_length=50)
    field_type  = models.CharField(max_length=10, choices=FieldType.choices, default=FieldType.TEXT)
    choices     = models.JSONField(default=list, blank=True)
    is_required = models.BooleanField(default=False)
    sort_order  = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name        = 'Attribut de catégorie'
        verbose_name_plural = 'Attributs de catégorie'
        ordering            = ['sort_order', 'name']
        unique_together     = ('category', 'key')

    def __str__(self):
        return f"{self.category.name} → {self.name}"


class Banner(BaseModel):
    """Panneau publicitaire affiché sur la homepage."""

    class Position(models.TextChoices):
        HERO   = 'hero',   'Bandeau principal (haut)'
        INLINE = 'inline', 'Entre les annonces'

    title       = models.CharField(max_length=200)
    image       = models.ImageField(upload_to='banners/')
    link_url    = models.CharField(max_length=500, blank=True)
    position    = models.CharField(max_length=10, choices=Position.choices, default=Position.HERO)
    is_active   = models.BooleanField(default=True)
    start_date  = models.DateTimeField(null=True, blank=True)
    end_date    = models.DateTimeField(null=True, blank=True)
    click_count = models.PositiveIntegerField(default=0)
    sort_order  = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name        = 'Panneau publicitaire'
        verbose_name_plural = 'Panneaux publicitaires'
        ordering            = ['sort_order', '-created_at']

    def __str__(self):
        return self.title

    def is_currently_active(self):
        from django.utils import timezone
        now = timezone.now()
        if not self.is_active:
            return False
        if self.start_date and now < self.start_date:
            return False
        if self.end_date and now > self.end_date:
            return False
        return True


class Favorite(BaseModel):
    user    = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='favorites')

    class Meta:
        verbose_name = 'Favori'
        verbose_name_plural = 'Favoris'
        unique_together = ('user', 'listing')

    def __str__(self):
        return f"{self.user.full_name} — {self.listing.title}"


class ListingReport(BaseModel):

    class Reason(models.TextChoices):
        FRAUD      = 'fraud',      'Arnaque / Fraude'
        DUPLICATE  = 'duplicate',  'Annonce en double'
        PROHIBITED = 'prohibited', 'Contenu interdit'
        WRONG_CAT  = 'wrong_cat',  'Mauvaise catégorie'
        OTHER      = 'other',      'Autre'

    class ReportStatus(models.TextChoices):
        PENDING  = 'pending',  'En attente'
        REVIEWED = 'reviewed', 'Examiné'
        RESOLVED = 'resolved', 'Résolu'

    listing  = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='reports')
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_sent')
    reason   = models.CharField(max_length=15, choices=Reason.choices)
    status   = models.CharField(max_length=10, choices=ReportStatus.choices, default=ReportStatus.PENDING)
    note     = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Signalement'
        verbose_name_plural = 'Signalements'
        unique_together = ('listing', 'reporter')

    def __str__(self):
        return f"Signalement — {self.listing.title} par {self.reporter.full_name}"