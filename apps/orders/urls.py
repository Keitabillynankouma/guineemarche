from django.urls import path
from . import views

urlpatterns = [
    path('',
        views.OrderListCreateView.as_view(),
        name='order-list'),
    path('pickup-points/',
        views.PickupPointListView.as_view(),
        name='pickup-points'),
    path('webhook/<str:provider>/',
        views.PaymentWebhookView.as_view(),
        name='payment-webhook'),
    path('<uuid:pk>/',
        views.OrderDetailView.as_view(),
        name='order-detail'),
    path('<uuid:pk>/pay/',
        views.InitiatePaymentView.as_view(),
        name='order-pay'),
    path('<uuid:pk>/confirm-receipt/',
        views.ConfirmReceiptView.as_view(),
        name='order-confirm-receipt'),
    path('<uuid:pk>/dispute/',
        views.DisputeView.as_view(),
        name='order-dispute'),
    path('<uuid:pk>/<str:action>/',
        views.OrderUpdateStatusView.as_view(),
        name='order-status'),
]
