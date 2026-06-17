from rest_framework import serializers
from .models import Order, Payment, PickupPoint, MeetingZone


class PickupPointSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PickupPoint
        fields = ('id', 'name', 'address', 'city', 'commune', 'phone', 'is_active')


class MeetingZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MeetingZone
        fields = ('id', 'city', 'name', 'address', 'latitude', 'longitude', 'is_active')


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = ('id', 'provider', 'phone_number', 'amount_gnf', 'status', 'external_ref', 'created_at')
        read_only_fields = ('id', 'status', 'created_at')


class OrderSerializer(serializers.ModelSerializer):
    payments      = PaymentSerializer(many=True, read_only=True)
    listing_title = serializers.CharField(source='listing.title',     read_only=True)
    buyer_name    = serializers.CharField(source='buyer.full_name',   read_only=True)
    seller_name   = serializers.CharField(source='seller.full_name',  read_only=True)
    pickup_point_detail = PickupPointSerializer(source='pickup_point', read_only=True)

    class Meta:
        model  = Order
        fields = (
            'id', 'listing', 'listing_title',
            'buyer', 'buyer_name', 'seller', 'seller_name',
            'amount_gnf', 'status',
            'delivery_mode', 'pickup_point', 'pickup_point_detail',
            'meet_location', 'note',
            'escrow_status', 'escrow_released_at',
            'payments', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'buyer', 'seller', 'amount_gnf', 'status',
            'commission_gnf', 'seller_payout_gnf',
            'escrow_status', 'escrow_released_at',
            'created_at', 'updated_at',
        )

    def create(self, validated_data):
        listing = validated_data['listing']
        validated_data['seller']     = listing.seller
        validated_data['amount_gnf'] = listing.price_gnf
        return super().create(validated_data)


class CreatePaymentSerializer(serializers.Serializer):
    provider     = serializers.ChoiceField(choices=Payment.Provider.choices)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['provider'] != Payment.Provider.CASH and not attrs.get('phone_number'):
            raise serializers.ValidationError("Le numéro de téléphone est requis pour le paiement mobile.")
        return attrs
