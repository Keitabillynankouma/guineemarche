from django.urls import path, include

urlpatterns = [
    path('accounts/',      include('apps.accounts.urls')),
    path('listings/',      include('apps.listings.urls')),
    path('messaging/',     include('apps.messaging.urls')),
    path('orders/',        include('apps.orders.urls')),
    path('reviews/',       include('apps.reviews.urls')),
    path('notifications/', include('apps.notifications.urls')),
    path('core/',          include('core.urls')),
]