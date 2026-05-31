from rest_framework import serializers
from .models import Category, Listing, ListingMedia, Favorite, ListingReport


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
    class Meta:
        model  = ListingMedia
        fields = ('id', 'file', 'media_type', 'sort_order', 'is_cover')


class ListingSerializer(serializers.ModelSerializer):
    media         = ListingMediaSerializer(many=True, read_only=True)
    seller_name   = serializers.CharField(source='seller.full_name', read_only=True)
    seller_phone  = serializers.CharField(source='seller.phone_number', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
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
            'seller_name', 'seller_phone', 'category', 'category_name',
            'media', 'uploaded_files'
        )
        read_only_fields = ('id', 'seller_name', 'seller_phone', 'view_count', 'created_at', 'status', 'is_boosted')

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