from django.urls import path
from . import views

urlpatterns = [
    # Espace affilié personnel
    path('register/',     views.AffiliateRegisterView.as_view(),   name='affiliate-register'),
    path('me/',           views.AffiliateMeView.as_view(),         name='affiliate-me'),
    path('commissions/',  views.AffiliateCommissionsView.as_view(), name='affiliate-commissions'),
    path('withdraw/',     views.AffiliateWithdrawView.as_view(),    name='affiliate-withdraw'),

    # Admin
    path('admin/list/',                          views.AdminAffiliateListView.as_view(),    name='admin-affiliate-list'),
    path('admin/<uuid:pk>/',                     views.AdminAffiliateDetailView.as_view(),  name='admin-affiliate-detail'),
    path('admin/withdrawals/',                   views.AdminWithdrawalListView.as_view(),   name='admin-withdrawal-list'),
    path('admin/withdrawals/<uuid:pk>/action/',  views.AdminWithdrawalActionView.as_view(), name='admin-withdrawal-action'),
]
