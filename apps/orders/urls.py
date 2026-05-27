from django.urls import path
from . import views

urlpatterns = [
    path('',
        views.OrderListCreateView.as_view(),
        name='order-list'),
    path('<uuid:pk>/',
        views.OrderDetailView.as_view(),
        name='order-detail'),
    path('<uuid:pk>/<str:action>/',
        views.OrderUpdateStatusView.as_view(),
        name='order-status'),
    path('<uuid:pk>/pay/',
        views.InitiatePaymentView.as_view(),
        name='order-pay'),
]