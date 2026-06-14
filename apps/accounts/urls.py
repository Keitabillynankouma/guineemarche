from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/',    views.RegisterView.as_view(),    name='register'),
    path('verify-otp/',  views.VerifyOTPView.as_view(),   name='verify-otp'),
    path('login/',       views.LoginView.as_view(),        name='login'),
    path('logout/',      views.LogoutView.as_view(),       name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(),    name='token-refresh'),
    path('me/',          views.MeView.as_view(),           name='me'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('resend-otp/',    views.ResendOTPView.as_view(),    name='resend-otp'),
    path('subscription/',      views.SubscriptionView.as_view(),  name='subscription'),
    path('badges/',            views.BadgeListView.as_view(),     name='badges'),
    path('referral/',          views.ReferralStatsView.as_view(), name='referral-stats'),
    path('shop/',              views.MyShopView.as_view(),        name='my-shop'),
    path('shops/',             views.ShopListView.as_view(),      name='shop-list'),
    path('shops/<uuid:pk>/',   views.ShopDetailView.as_view(),    name='shop-detail'),

    # Admin
    path('admin/shops/',                    views.AdminShopListView.as_view(),    name='admin-shop-list'),
    path('admin/shops/<uuid:pk>/approve/',  views.AdminShopApproveView.as_view(), name='admin-shop-approve'),
    path('admin/shops/<uuid:pk>/',          views.AdminShopUpdateView.as_view(),  name='admin-shop-update'),
]