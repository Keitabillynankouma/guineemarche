from django.urls import path
from . import views

urlpatterns = [
    path('',
        views.ReviewListCreateView.as_view(),
        name='review-list'),
    path('user/<uuid:user_id>/',
        views.UserReviewsView.as_view(),
        name='user-reviews'),
]