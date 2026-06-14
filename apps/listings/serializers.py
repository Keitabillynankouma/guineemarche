from rest_framework import serializers
from django.db import transaction
from .models import Category, Listing, ListingMedia, Favorite, ListingReport, CategoryAttribute, Banner


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'icon_url', 'parent', 'children', 'sort_order')

    def get_children(self, obj):
        if obj.children.exists():
            return CategorySerializer(obj.children.filter(is_active=True), many=True).data
        return []


class ListingMediaSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model  = ListingMedia
        fields = ('id', 'file', 'media_type', 'sort_order', 'is_cover')

    def get_file(self, obj):
        if not obj.file:
            return None
        try:
            url = obj.file.url
            # Si l'URL est relative ou juste un nom de fichier, retourner None
            # pour éviter que le frontend affiche une URL cassée
            if url and url.startswith('http'):
                return url
            return None
        except Exception:
            return None


class ListingSerializer(serializers.ModelSerializer):
    media         = ListingMediaSerializer(many=True, read_only=True)
    seller_name   = serializers.CharField(source='seller.full_name', read_only=True)
    seller_phone  = serializers.CharField(source='seller.phone_number', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_favorited  = serializers.SerializerMethodField()
    uploaded_files = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False,
        allow_empty=True,
        default=list
    )

    class Meta:
        model  = Listing
        fields = (
            'id', 'title', 'description', 'price_gnf', 'price_type',
            'condition', 'status', 'city', 'quartier', 'latitude', 'longitude',
            'view_count', 'is_boosted', 'expires_at', 'created_at',
            'seller', 'seller_name', 'seller_phone', 'category', 'category_name',
            'attributes', 'media', 'uploaded_files', 'is_favorited',
        )
        read_only_fields = ('id', 'seller', 'seller_name', 'seller_phone', 'view_count', 'created_at', 'status', 'is_boosted', 'is_favorited')

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Favorite.objects.filter(user=request.user, listing=obj).exists()

    @transaction.atomic
    def create(self, validated_data):
        uploaded_files = validated_data.pop('uploaded_files', [])
        listing = Listing.objects.create(**validated_data)
        for index, file in enumerate(uploaded_files):
            ListingMedia.objects.create(
                listing=listing,
                file=file,
                sort_order=index,
                is_cover=(index == 0)
            )
        return listing


class ListingDetailSerializer(ListingSerializer):
    class Meta(ListingSerializer.Meta):
        fields = ListingSerializer.Meta.fields


class FavoriteSerializer(serializers.ModelSerializer):
    listing    = ListingSerializer(read_only=True)
    listing_id = serializers.UUIDField(write_only=True)

    class Meta:
        model  = Favorite
        fields = ('id', 'listing', 'listing_id', 'created_at')

    def create(self, validated_data):
        listing_id = validated_data.pop('listing_id')
        listing    = Listing.objects.get(id=listing_id)
        user       = self.context['request'].user
        favorite, _ = Favorite.objects.get_or_create(user=user, listing=listing)
        return favorite


class ListingReportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ListingReport
        fields = ('id', 'listing', 'reason', 'note', 'created_at')
        read_only_fields = ('id', 'created_at')


class CategoryAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CategoryAttribute
        fields = ('id', 'name', 'key', 'field_type', 'choices', 'is_required', 'sort_order')


class BannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model  = Banner
        fields = ('id', 'title', 'image', 'link_url', 'position', 'click_count')

    def get_image(self, obj):
        if not obj.image:
            return None
        try:
            url = obj.image.url
            return url if url.startswith('http') else None
        except Exception:
            return None


# ── Sérialiseurs Admin (lecture + écriture) ────────────────────────────────

class AdminBannerSerializer(serializers.ModelSerializer):
    """Sérialiseur complet pour la gestion admin des publicités."""
    image_url  = serializers.SerializerMethodField(read_only=True)
    image_file = serializers.ImageField(write_only=True, required=False, source='image')

    class Meta:
        model  = Banner
        fields = (
            'id', 'title', 'image_url', 'image_file', 'link_url',
            'position', 'is_active', 'start_date', 'end_date',
            'sort_order', 'click_count', 'created_at',
        )
        read_only_fields = ('id', 'click_count', 'created_at')

    def get_image_url(self, obj):
        if not obj.image:
            return None
        try:
            url = obj.image.url
            return url if url.startswith('http') else None
        except Exception:
            return None


class AdminCategorySerializer(serializers.ModelSerializer):
    """Sérialiseur pour la gestion admin des catégories et sous-catégories."""
    children_count = serializers.SerializerMethodField(read_only=True)
    parent_name    = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model  = Category
        fields = (
            'id', 'name', 'slug', 'icon_url', 'parent', 'parent_name',
            'is_active', 'sort_order', 'children_count',
        )
        read_only_fields = ('id', 'slug', 'children_count', 'parent_name')

    def get_children_count(self, obj):
        return obj.children.count()


class AdminListingSerializer(serializers.ModelSerializer):
    """Sérialiseur lecture pour la liste admin des annonces."""
    seller_name   = serializers.CharField(source='seller.full_name', read_only=True)
    seller_phone  = serializers.CharField(source='seller.phone_number', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    media         = ListingMediaSerializer(many=True, read_only=True)

    class Meta:
        model  = Listing
        fields = (
            'id', 'title', 'price_gnf', 'price_type', 'condition', 'status',
            'city', 'view_count', 'is_boosted', 'created_at',
            'seller', 'seller_name', 'seller_phone',
            'category', 'category_name', 'media',
        )
        read_only_fields = fields