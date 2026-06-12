from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from core.permissions import IsAdmin
from core.site_settings import SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = '__all__'


class SiteSettingsView(APIView):
    """
    GET  /api/v1/core/settings/  — lecture publique (frontend)
    PATCH /api/v1/core/settings/ — modification admin uniquement
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdmin()]

    def get(self, request):
        obj = SiteSettings.get()
        return Response(SiteSettingsSerializer(obj).data)

    def patch(self, request):
        obj = SiteSettings.get()
        serializer = SiteSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
