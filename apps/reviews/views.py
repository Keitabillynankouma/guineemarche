from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import Review
from .serializers import ReviewSerializer


class ReviewListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ReviewSerializer

    def get_queryset(self):
        return Review.objects.filter(
            reviewee=self.request.user
        ).select_related('reviewer', 'reviewee', 'order')

    def perform_create(self, serializer):
        from apps.orders.models import Order
        reviewer = self.request.user
        order    = serializer.validated_data.get('order')

        if not order:
            raise ValidationError("Une commande est requise pour laisser un avis.")

        # Vérifier que la commande est bien COMPLETED
        if order.status != Order.Status.COMPLETED:
            raise PermissionDenied("Vous ne pouvez laisser un avis qu'après la finalisation de la commande.")

        # Vérifier que le reviewer est bien acheteur ou vendeur de cette commande
        if reviewer not in (order.buyer, order.seller):
            raise PermissionDenied("Vous n'êtes pas partie prenante de cette commande.")

        # Déterminer le reviewee : l'autre partie
        reviewee = order.seller if reviewer == order.buyer else order.buyer

        # Vérifier l'unicité (unique_together couvre déjà DB, mais on renvoie un message clair)
        if Review.objects.filter(order=order, reviewer=reviewer).exists():
            raise ValidationError("Vous avez déjà laissé un avis pour cette commande.")

        serializer.save(reviewer=reviewer, reviewee=reviewee)


class UserReviewsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class   = ReviewSerializer

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return Review.objects.filter(
            reviewee__id=user_id
        ).select_related('reviewer')