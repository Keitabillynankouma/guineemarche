from rest_framework import serializers
from .models import Order, Payment
from apps.listings.serializers import ListingSerializer


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = ('id', 'provider', 'phone_number', 'amount_gnf', 'status', 'external_ref', 'created_at')
        read_only_fields = ('id', 'status', 'created_at')


class OrderSerializer(serializers.ModelSerializer):
    payments     = PaymentSerializer(many=True, read_only=True)
    listing_title = serializers.CharField(source='listing.title', read_only=True)
    buyer_name   = serializers.CharField(source='buyer.full_name', read_only=True)
    seller_name  = serializers.CharField(source='seller.full_name', read_only=True)

    class Meta:
        model  = Order
        fields = (
            'id', 'listing', 'listing_title', 'buyer', 'buyer_name',
            'seller', 'seller_name', 'amount_gnf', 'status',
            'meet_location', 'note', 'payments', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'buyer', 'seller', 'status', 'created_at', 'updated_at')

    def create(self, validated_data):
        listing = validated_data['listing']
        validated_data['seller'] = listing.seller
        validated_data['amount_gnf'] = listing.price_gnf
        return super().create(validated_data)


class CreatePaymentSerializer(serializers.Serializer):
    provider     = serializers.ChoiceField(choices=Payment.Provider.choices)
    phone_number = serializers.CharField(required=False)

    def validate(self, attrs):
        if attrs['provider'] != Payment.Provider.CASH and not attrs.get('phone_number'):
            raise serializers.ValidationError("Le numéro de téléphone est requis pour le paiement mobile.")
        return attrs