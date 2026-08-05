from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/',          views.RegisterView.as_view(),       name='register'),
    path('register/email/',    views.EmailRegisterView.as_view(),  name='register-email'),
    path('verify-otp/',        views.VerifyOTPView.as_view(),      name='verify-otp'),
    path('verify-otp/email/',  views.VerifyEmailOTPView.as_view(), name='verify-otp-email'),
    path('login/',       views.LoginView.as_view(),        name='login'),
    path('logout/',      views.LogoutView.as_view(),       name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(),    name='token-refresh'),
    path('me/',          views.MeView.as_view(),           name='me'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('resend-otp/',      views.ResendOTPView.as_view(),      name='resend-otp'),
    path('forgot-password/', views.ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/',  views.ResetPasswordView.as_view(),  name='reset-password'),
    path('subscription/',      views.SubscriptionView.as_view(),  name='subscription'),
    path('badges/',            views.BadgeListView.as_view(),     name='badges'),
    path('referral/',          views.ReferralStatsView.as_view(), name='referral-stats'),
    path('shop/',              views.MyShopView.as_view(),        name='my-shop'),
    path('shops/',             views.ShopListView.as_view(),      name='shop-list'),
    path('shops/<uuid:pk>/',   views.ShopDetailView.as_view(),    name='shop-detail'),

    # Push notifications FCM
    path('me/fcm-token/', views.RegisterFCMTokenView.as_view(), name='register-fcm-token'),

    # Livreur
    path('livreur/toggle-availability/', views.LivreurToggleAvailabilityView.as_view(), name='livreur-toggle-availability'),

    # Admin
    path('admin/shops/',                    views.AdminShopListView.as_view(),    name='admin-shop-list'),
    path('admin/shops/<uuid:pk>/approve/',  views.AdminShopApproveView.as_view(), name='admin-shop-approve'),
    path('admin/shops/<uuid:pk>/',          views.AdminShopUpdateView.as_view(),  name='admin-shop-update'),
    path('admin/users/',                    views.AdminUserListView.as_view(),    name='admin-user-list'),
    path('admin/users/<uuid:pk>/',          views.AdminUserUpdateView.as_view(),  name='admin-user-update'),
    path('admin/users/<uuid:pk>/subscription/', views.AdminActivateSubscriptionView.as_view(), name='admin-user-subscription'),

    # Suppression de compte
    path('delete/',                         views.DeleteAccountView.as_view(),    name='delete-account'),
]