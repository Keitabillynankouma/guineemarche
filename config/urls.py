"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.views.decorators.csrf import csrf_exempt
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def bad_request(request, exception):
    return JsonResponse({'error': 'Bad request'}, status=400)

def permission_denied(request, exception):
    return JsonResponse({'error': 'Permission denied'}, status=403)

def page_not_found(request, exception):
    return JsonResponse({'error': 'Not found'}, status=404)

handler400 = bad_request
handler403 = permission_denied
handler404 = page_not_found

import os

# URL admin secrète — configurable via DJANGO_ADMIN_URL (par défaut : URL aléatoire non devinable)
# ⚠️  Ne jamais laisser 'admin/' en production
_ADMIN_URL = os.environ.get('DJANGO_ADMIN_URL', 'gm-backoffice-9f3a2e/')

urlpatterns = [
    path(_ADMIN_URL, admin.site.urls),
    path('api/v1/', include('config.api_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
