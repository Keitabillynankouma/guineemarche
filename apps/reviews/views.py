from rest_framework import generics, permissions
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
        serializer.save(reviewer=self.request.user)


class UserReviewsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class   = ReviewSerializer

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        return Review.objects.filter(
            reviewee__id=user_id
        ).select_related('reviewer')