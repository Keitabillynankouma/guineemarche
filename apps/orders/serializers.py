from rest_framework import serializers
from .models import Order, Payment, PickupPoint, MeetingZone, DeliveryZone, DeliveryAssignment, IntraCityZoneRate, ReturnRequest


class PickupPointSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PickupPoint
        fields = ('id', 'name', 'address', 'city', 'commune', 'phone', 'is_active')


class MeetingZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MeetingZone
        fields = ('id', 'city', 'name', 'address', 'latitude', 'longitude', 'is_active')


class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DeliveryZone
        fields = (
            'id', 'city', 'fee_gnf', 'estimated_days', 'is_active',
            'free_km_radius', 'price_per_km_gnf',
            'free_weight_kg', 'price_per_kg_gnf',
        )


class IntraCityZoneRateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = IntraCityZoneRate
        fields = ('id', 'city', 'from_commune', 'to_commune', 'fee_gnf', 'estimated_hours', 'is_active')


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = ('id', 'provider', 'phone_number', 'amount_gnf', 'status', 'external_ref', 'created_at')
        read_only_fields = ('id', 'status', 'created_at')


class ReturnRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ReturnRequest
        fields = ('id', 'reason', 'description', 'status', 'admin_note', 'resolved_at', 'created_at')


class OrderSerializer(serializers.ModelSerializer):
    payments      = PaymentSerializer(many=True, read_only=True)
    listing_title = serializers.CharField(source='listing.title',     read_only=True)
    buyer_name    = serializers.CharField(source='buyer.full_name',   read_only=True)
    seller_name   = serializers.CharField(source='seller.full_name',  read_only=True)
    pickup_point_detail = PickupPointSerializer(source='pickup_point', read_only=True)
    delivery_assignment_detail = serializers.SerializerMethodField()
    return_request = ReturnRequestSerializer(read_only=True)

    class Meta:
        model  = Order
        fields = (
            'id', 'listing', 'listing_title',
            'buyer', 'buyer_name', 'seller', 'seller_name',
            'amount_gnf', 'commission_gnf', 'seller_payout_gnf', 'status',
            'delivery_mode', 'pickup_point', 'pickup_point_detail',
            'meet_location', 'delivery_address', 'delivery_fee_gnf',
            'delivery_distance_km', 'delivery_weight_kg', 'delivery_buyer_commune',
            'note',
            'escrow_status', 'escrow_release_at', 'escrow_released_at', 'escrow_admin_hold',
            'payments', 'delivery_assignment_detail', 'return_request',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'buyer', 'seller', 'amount_gnf', 'status',
            'commission_gnf', 'seller_payout_gnf',
            'escrow_status', 'escrow_release_at', 'escrow_released_at', 'escrow_admin_hold',
            'created_at', 'updated_at',
        )

    def get_delivery_assignment_detail(self, obj):
        try:
            da = obj.delivery_assignment
            return {
                'id':                str(da.id),
                'status':            da.status,
                'livreur_id':        str(da.livreur.id),
                'livreur_name':      da.livreur.full_name,
                'livreur_phone':     str(da.livreur.phone_number or ''),
                'pickup_code':       da.pickup_code,        # vendeur le vérifie quand livreur arrive
                'verification_code': da.verification_code,  # acheteur le donne au livreur à la réception
            }
        except Exception:
            return None

    def create(self, validated_data):
        listing = validated_data['listing']
        validated_data['seller'] = listing.seller

        # Calcul du montant total : prix annonce + frais de livraison à domicile
        delivery_mode = validated_data.get('delivery_mode', Order.DeliveryMode.MEETING_POINT)
        delivery_fee  = 0
        if delivery_mode == Order.DeliveryMode.HOME_DELIVERY:
            city           = listing.city
            buyer_commune  = (validated_data.get('delivery_buyer_commune') or '').strip()
            seller_commune = (listing.quartier or '').strip()

            # ── Priorité 1 : tarif inter-commune ─────────────────────────────
            if buyer_commune and seller_commune:
                try:
                    rate = IntraCityZoneRate.objects.get(
                        city__iexact=city,
                        from_commune__iexact=seller_commune,
                        to_commune__iexact=buyer_commune,
                        is_active=True,
                    )
                    delivery_fee = rate.fee_gnf
                    validated_data['delivery_fee_gnf'] = delivery_fee
                except IntraCityZoneRate.DoesNotExist:
                    pass

            # ── Priorité 2 : calcul distance + poids ─────────────────────────
            if delivery_fee == 0:
                try:
                    zone         = DeliveryZone.objects.get(city__iexact=city, is_active=True)
                    distance_km  = validated_data.get('delivery_distance_km', 0) or 0
                    weight_kg    = validated_data.get('delivery_weight_kg', 0) or 0
                    delivery_fee = zone.calculate_fee(distance_km, weight_kg)['fee_gnf']
                except DeliveryZone.DoesNotExist:
                    pass
                validated_data['delivery_fee_gnf'] = delivery_fee

        validated_data['amount_gnf'] = listing.price_gnf + delivery_fee
        return super().create(validated_data)


class DeliveryAssignmentSerializer(serializers.ModelSerializer):
    livreur_name = serializers.CharField(source='livreur.full_name', read_only=True)
    livreur_phone = serializers.CharField(source='livreur.phone_number', read_only=True)
    order_detail  = serializers.SerializerMethodField()

    class Meta:
        model  = DeliveryAssignment
        fields = (
            'id', 'order', 'order_detail',
            'livreur', 'livreur_name', 'livreur_phone',
            'status', 'pickup_code', 'verification_code',
            'assigned_at', 'delivered_at', 'notes',
        )
        read_only_fields = ('id', 'pickup_code', 'verification_code', 'assigned_at', 'delivered_at')

    def get_order_detail(self, obj):
        o = obj.order
        return {
            'id':               str(o.id),
            'listing_title':    o.listing.title,
            'buyer_id':         str(o.buyer.id),
            'buyer_name':       o.buyer.full_name,
            'buyer_phone':      str(o.buyer.phone_number or ''),
            'seller_id':        str(o.seller.id),
            'seller_name':      o.seller.full_name,
            'delivery_address': o.delivery_address,
            'amount_gnf':       o.amount_gnf,
        }


class CreatePaymentSerializer(serializers.Serializer):
    provider     = serializers.ChoiceField(choices=Payment.Provider.choices)
    phone_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        # ChaChap Pay et espèces ne nécessitent pas de numéro de téléphone
        no_phone_providers = (Payment.Provider.CASH, Payment.Provider.CHACHAP)
        if attrs['provider'] not in no_phone_providers and not attrs.get('phone_number'):
            raise serializers.ValidationError("Le numéro de téléphone est requis pour ce mode de paiement.")
        return attrs
