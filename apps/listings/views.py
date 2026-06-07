from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404

from django.utils import timezone
from django.db import models
from .models import Category, Listing, Favorite, ListingReport, CategoryAttribute, Banner
from .serializers import (
    CategorySerializer, ListingSerializer,
    ListingDetailSerializer, FavoriteSerializer, ListingReportSerializer,
    CategoryAttributeSerializer, BannerSerializer,
)
from .filters import ListingFilter


class CategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class   = CategorySerializer
    queryset           = Category.objects.filter(is_active=True, parent=None)


class ListingListCreateView(generics.ListCreateAPIView):
    serializer_class = ListingSerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class  = ListingFilter
    search_fields    = ['title', 'description', 'city', 'quartier']
    ordering_fields  = ['created_at', 'price_gnf', 'view_count']
    ordering         = ['-is_boosted', '-created_at']

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Listing.objects.filter(status=Listing.Status.ACTIVE).select_related(
            'seller', 'category'
        ).prefetch_related('media')

    def perform_create(self, serializer):
        from apps.accounts.models import Subscription, Badge
        from rest_framework.exceptions import PermissionDenied
        user = self.request.user
        sub, _ = Subscription.objects.get_or_create(user=user)
        if not sub.can_post:
            raise PermissionDenied(
                detail={
                    'code': 'subscription_required',
                    'message': f'Vous avez atteint la limite de {Subscription.FREE_LIMIT} annonces gratuites. '
                               'Passez au plan Pro pour publier des annonces illimitées.',
                }
            )
        serializer.save(seller=user, status=Listing.Status.ACTIVE)
        sub.listings_used += 1
        sub.save(update_fields=['listings_used'])
        # Premier badge si c'est la toute première annonce
        if sub.listings_used == 1:
            Badge.award(user, Badge.Type.FIRST_LISTING)


class ListingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ListingDetailSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Listing.objects.select_related('seller', 'category').prefetch_related('media')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_views()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.seller != request.user:
            return Response(
                {'error': 'Vous ne pouvez modifier que vos propres annonces.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.seller != request.user:
            return Response(
                {'error': 'Vous ne pouvez supprimer que vos propres annonces.'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance.status = Listing.Status.SOLD
        instance.save(update_fields=['status'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyListingsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ListingSerializer

    def get_queryset(self):
        return Listing.objects.filter(
            seller=self.request.user
        ).select_related('category').prefetch_related('media')


class FavoriteListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = FavoriteSerializer

    def get_queryset(self):
        return Favorite.objects.filter(
            user=self.request.user
        ).select_related('listing__seller', 'listing__category')


class FavoriteDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user)


class ListingReportView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ListingReportSerializer

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)


class CategoryAttributeListView(generics.ListAPIView):
    """Retourne les attributs dynamiques d'une catégorie (marque, année, etc.)."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = CategoryAttributeSerializer

    def get_queryset(self):
        category_id = self.kwargs.get('pk')
        return CategoryAttribute.objects.filter(category_id=category_id)


class BannerListView(generics.ListAPIView):
    """Retourne les panneaux publicitaires actifs."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = BannerSerializer

    def get_queryset(self):
        now = timezone.now()
        qs  = Banner.objects.filter(is_active=True)
        qs  = qs.filter(
            models.Q(start_date__isnull=True) | models.Q(start_date__lte=now)
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
        )
        position = self.request.query_params.get('position')
        if position:
            qs = qs.filter(position=position)
        return qs


class BannerClickView(APIView):
    """Incrémente le compteur de clics d'un banneau."""
    permission_classes = [permissions.AllowAny]

    def post(self, _request, pk):
        Banner.objects.filter(pk=pk).update(click_count=models.F('click_count') + 1)
        return Response({'status': 'ok'})