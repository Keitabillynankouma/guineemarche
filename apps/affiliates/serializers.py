from rest_framework import serializers
from .models import AffiliateProfile, AffiliateCommission, AffiliateWithdrawal, AFFILIATE_RATES


class AffiliateProfileSerializer(serializers.ModelSerializer):
    referral_code     = serializers.CharField(source='user.referral_code', read_only=True)
    full_name         = serializers.CharField(source='user.full_name', read_only=True)
    phone_number      = serializers.CharField(source='user.phone_number', read_only=True)
    referral_link     = serializers.SerializerMethodField()
    commission_rates  = serializers.SerializerMethodField()
    minimum_withdrawal = serializers.IntegerField(
        source='MINIMUM_GNF', read_only=True, default=AffiliateWithdrawal.MINIMUM_GNF
    )

    class Meta:
        model  = AffiliateProfile
        fields = [
            'id', 'full_name', 'phone_number', 'referral_code', 'referral_link',
            'status', 'display_name', 'bio',
            'total_clicks', 'total_conversions',
            'total_earned_gnf', 'balance_gnf',
            'payout_phone', 'payout_provider',
            'commission_rates', 'minimum_withdrawal',
            'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'referral_code', 'referral_link',
            'total_clicks', 'total_conversions', 'total_earned_gnf', 'balance_gnf',
            'created_at',
        ]

    def get_referral_link(self, obj):
        return f'https://guimatrix.com/?ref={obj.referral_code}'

    def get_commission_rates(self, obj):
        return {f'level_{k}': v for k, v in AFFILIATE_RATES.items()}


class AffiliateCommissionSerializer(serializers.ModelSerializer):
    order_id    = serializers.UUIDField(source='order.id', read_only=True)
    listing     = serializers.CharField(source='order.listing.title', read_only=True)

    class Meta:
        model  = AffiliateCommission
        fields = [
            'id', 'order_id', 'listing', 'level', 'rate_pct',
            'base_amount_gnf', 'commission_gnf', 'status', 'credited_at', 'created_at',
        ]


class AffiliateWithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AffiliateWithdrawal
        fields = [
            'id', 'amount_gnf', 'payout_phone', 'payout_provider',
            'status', 'payment_ref', 'admin_note', 'paid_at', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'payment_ref', 'admin_note', 'paid_at', 'created_at']


class WithdrawalRequestSerializer(serializers.Serializer):
    amount_gnf      = serializers.IntegerField(min_value=1)
    payout_phone    = serializers.CharField(max_length=20)
    payout_provider = serializers.ChoiceField(choices=[
        'orange_money', 'mtn_momo', 'paycard', 'kulu', 'soutra_money', 'akiba',
    ])

    def validate(self, data):
        affiliate = self.context['affiliate']
        if data['amount_gnf'] < AffiliateWithdrawal.MINIMUM_GNF:
            raise serializers.ValidationError(
                f"Montant minimum de retrait : {AffiliateWithdrawal.MINIMUM_GNF:,} GNF"
            )
        if data['amount_gnf'] > affiliate.balance_gnf:
            raise serializers.ValidationError(
                f"Solde insuffisant. Disponible : {affiliate.balance_gnf:,} GNF"
            )
        return data


class AffiliateRegisterSerializer(serializers.Serializer):
    display_name    = serializers.CharField(max_length=150, required=False, allow_blank=True)
    bio             = serializers.CharField(required=False, allow_blank=True)
    payout_phone    = serializers.CharField(max_length=20, required=False, allow_blank=True)
    payout_provider = serializers.ChoiceField(
        choices=['orange_money', 'mtn_momo', 'paycard', 'kulu', 'soutra_money', 'akiba'],
        required=False, allow_blank=True
    )
