from rest_framework import serializers
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.full_name', read_only=True)
    reviewee_name = serializers.CharField(source='reviewee.full_name', read_only=True)

    class Meta:
        model  = Review
        fields = ('id', 'order', 'reviewer', 'reviewer_name',
                  'reviewee', 'reviewee_name', 'rating', 'comment', 'created_at')
        read_only_fields = ('id', 'reviewer', 'created_at')

    def validate_order(self, value):
        user = self.context['request'].user
        if user not in [value.buyer, value.seller]:
            raise serializers.ValidationError("Vous n'êtes pas concerné par cette commande.")
        if not value.is_completed:
            raise serializers.ValidationError("La commande doit être terminée pour laisser un avis.")
        if Review.objects.filter(order=value, reviewer=user).exists():
            raise serializers.ValidationError("Vous avez déjà laissé un avis pour cette commande.")
        return value

    def create(self, validated_data):
        order    = validated_data['order']
        reviewer = self.context['request'].user
        reviewee = order.seller if reviewer == order.buyer else order.buyer
        return Review.objects.create(
            reviewer=reviewer,
            reviewee=reviewee,
            **validated_data
        )