from django.urls import path
from . import views

urlpatterns = [
    path('settings/',     views.SiteSettingsView.as_view(),  name='site-settings'),
    path('support-chat/', views.SupportChatView.as_view(),   name='support-chat'),
]
