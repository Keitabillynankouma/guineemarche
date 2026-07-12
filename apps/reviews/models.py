from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from core.models import BaseModel
from apps.accounts.models import User
from apps.orders.models import Order


class Review(BaseModel):
    order    = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_received')
    rating   = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment  = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Avis'
        verbose_name_plural = 'Avis'
        ordering = ['-created_at']
        unique_together = ('order', 'reviewer', 'reviewee')

    def __str__(self):
        return f"{self.reviewer.full_name} → {self.reviewee.full_name} : {self.rating}/5"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self._update_profile_rating()

    def _update_profile_rating(self):
        from apps.accounts.models import UserProfile
        profile = UserProfile.objects.get(user=self.reviewee)
        reviews = Review.objects.filter(reviewee=self.reviewee)
        profile.rating_avg   = reviews.aggregate(
            avg=models.Avg('rating')
        )['avg'] or 0.0
        profile.total_ratings = reviews.count()
        profile.save(update_fields=['rating_avg', 'total_ratings'])