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
        from apps.accounts.models import User

        reviewer = self.request.user
        order    = serializer.validated_data.get('order')

        if not order:
            raise ValidationError("Une commande est requise pour laisser un avis.")

        # ── Commande doit être terminée ───────────────────────────────────────
        from apps.orders.models import Order as _Order
        if order.status != _Order.Status.COMPLETED:
            raise ValidationError("Vous ne pouvez laisser un avis que sur une commande terminée.")

        # ── Parties prenantes de cette commande ──────────────────────────────
        parties = {order.buyer, order.seller}
        livreur = None
        try:
            livreur = order.delivery_assignment.livreur
            parties.add(livreur)
        except Exception:
            pass

        if reviewer not in parties:
            raise PermissionDenied("Vous n'êtes pas partie prenante de cette commande.")

        # ── Déterminer le reviewee ────────────────────────────────────────────
        reviewee_id = self.request.data.get('reviewee')
        if reviewee_id:
            try:
                reviewee = User.objects.get(pk=str(reviewee_id))
            except User.DoesNotExist:
                raise ValidationError("Destinataire introuvable.")
            if reviewee not in parties:
                raise PermissionDenied("Ce destinataire n'est pas partie prenante de cette commande.")
            if reviewee == reviewer:
                raise ValidationError("Vous ne pouvez pas vous noter vous-même.")
        else:
            # Comportement par défaut (sans livreur) : noter l'autre partie principale
            if reviewer == order.buyer:
                reviewee = order.seller
            elif reviewer == order.seller:
                reviewee = order.buyer
            else:
                # Le livreur doit préciser qui noter
                raise ValidationError("Précisez la personne à noter (champ 'reviewee').")

        # ── Unicité (order, reviewer, reviewee) ──────────────────────────────
        if Review.objects.filter(order=order, reviewer=reviewer, reviewee=reviewee).exists():
            raise ValidationError("Vous avez déjà noté cette personne pour cette commande.")

        serializer.save(reviewer=reviewer, reviewee=reviewee)


class UserReviewsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class   = ReviewSerializer

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return Review.objects.filter(
            reviewee__id=user_id
        ).select_related('reviewer')
