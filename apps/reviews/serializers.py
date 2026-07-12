from rest_framework import serializers
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.full_name', read_only=True)
    reviewee_name = serializers.CharField(source='reviewee.full_name', read_only=True)

    class Meta:
        model  = Review
        fields = ('id', 'order', 'reviewer', 'reviewer_name',
                  'reviewee', 'reviewee_name', 'rating', 'comment', 'created_at')
        # reviewer et reviewee sont définis dans perform_create() de la vue
        read_only_fields = ('id', 'reviewer', 'reviewee', 'created_at')

    def validate_order(self, value):
        """Seule vérification au niveau sérialiseur : la commande doit être COMPLETED."""
        if not value.is_completed:
            raise serializers.ValidationError(
                "La commande doit être terminée pour laisser un avis."
            )
        return value
