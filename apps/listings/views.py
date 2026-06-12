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
    AdminBannerSerializer, AdminCategorySerializer, AdminListingSerializer,
)
from .filters import ListingFilter
from core.permissions import IsAdmin


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
        # Auto-expire silencieux : les annonces expirées n'apparaissent plus
        return Listing.objects.filter(
            status=Listing.Status.ACTIVE
        ).exclude(
            expires_at__isnull=False, expires_at__lt=timezone.now()
        ).select_related('seller', 'category').prefetch_related('media')

    def perform_create(self, serializer):
        from apps.accounts.models import Subscription, Badge
        from rest_framework.exceptions import PermissionDenied
        from core.site_settings import SiteSettings
        user = self.request.user
        site = SiteSettings.get()
        sub, _ = Subscription.objects.get_or_create(user=user)
        # Vérifier quotas seulement si abonnements actifs ET gratuites désactivées
        if not site.free_listings_enabled and site.subscriptions_enabled:
            limit = site.max_free_listings
            if not sub.can_post:
                raise PermissionDenied(
                    detail={
                        'code': 'subscription_required',
                        'message': f'Vous avez atteint la limite de {limit} annonces gratuites. '
                                   'Passez au plan Pro pour publier des annonces illimitées.',
                    }
                )
        serializer.save(seller=user, status=Listing.Status.ACTIVE)
        sub.listings_used += 1
        sub.save(update_fields=['listings_used'])
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
        instance.status = Listing.Status.SUSPENDED
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


# ── Boost automatique ────────────────────────────────────────────────────────

BOOST_PRICES = {3: 5_000, 7: 10_000}   # jours → GNF

class BoostListingView(APIView):
    """
    POST /listings/{id}/boost/
    Body: { days: 3|7, provider: 'orange_money'|'mtn_momo'|'cash', phone: '...' }
    → Initie le paiement, et si succès active le boost immédiatement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from apps.orders.payment_service import initiate_orange_money, initiate_mtn_momo
        from apps.orders.models import Payment

        listing = get_object_or_404(Listing, pk=pk, seller=request.user)
        days     = int(request.data.get('days', 7))
        provider = request.data.get('provider', Payment.Provider.CASH)
        phone    = request.data.get('phone', '')

        if days not in BOOST_PRICES:
            return Response({'error': 'Durée invalide. Choisissez 3 ou 7 jours.'}, status=400)

        amount = BOOST_PRICES[days]

        # Initier le paiement
        if provider == Payment.Provider.ORANGE_MONEY:
            result = initiate_orange_money(phone, amount, f'boost-{listing.id}')
        elif provider == Payment.Provider.MTN_MOMO:
            result = initiate_mtn_momo(phone, amount, f'boost-{listing.id}')
        else:
            result = type('R', (), {'success': True, 'reference': '', 'message': 'Boost activé (espèces)'})()

        if not result.success:
            return Response({'error': result.message}, status=502)

        # Activer le boost automatiquement
        listing.is_boosted = True
        now = timezone.now()
        # Si déjà boosted, prolonger
        base = listing.expires_at if (listing.expires_at and listing.expires_at > now) else now
        from datetime import timedelta
        listing.expires_at = base + timedelta(days=days)
        listing.save(update_fields=['is_boosted', 'expires_at', 'updated_at'])

        try:
            from apps.notifications.models import Notification
            Notification.send(
                user=request.user,
                type=Notification.Type.ORDER_UPDATE,
                title='⚡ Annonce boostée !',
                body=f'Votre annonce « {listing.title} » est maintenant mise en avant pour {days} jours.',
                data={'listing_id': str(listing.id)},
            )
        except Exception:
            pass

        return Response({
            'message':    f'Boost activé pour {days} jours.',
            'is_boosted': listing.is_boosted,
            'expires_at': listing.expires_at,
            'listing':    ListingSerializer(listing, context={'request': request}).data,
        })


# ── Vues Admin ────────────────────────────────────────────────────────────────

class AdminListingListView(generics.ListAPIView):
    """Admin : liste toutes les annonces (toutes statuts)."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminListingSerializer
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['title', 'city', 'seller__first_name', 'seller__last_name']
    ordering_fields    = ['created_at', 'price_gnf', 'view_count', 'status']
    ordering           = ['-created_at']

    def get_queryset(self):
        qs = Listing.objects.select_related('seller', 'category').prefetch_related('media')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminListingDetailView(generics.RetrieveDestroyAPIView):
    """Admin : détail et suspension d'une annonce."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminListingSerializer
    queryset           = Listing.objects.select_related('seller', 'category').prefetch_related('media')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.status = Listing.Status.SUSPENDED
        instance.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'suspended'}, status=status.HTTP_200_OK)


class AdminBannerListCreateView(generics.ListCreateAPIView):
    """Admin : liste et création de publicités."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminBannerSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = Banner.objects.all().order_by('sort_order', '-created_at')


class AdminBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin : détail, modification et suppression d'une publicité."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminBannerSerializer
    parser_classes     = [MultiPartParser, FormParser, JSONParser]
    queryset           = Banner.objects.all()


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    """Admin : liste et création de catégories / sous-catégories."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminCategorySerializer
    queryset           = Category.objects.all().order_by('parent', 'sort_order', 'name')

    def perform_create(self, serializer):
        from django.utils.text import slugify
        name = serializer.validated_data.get('name', '')
        base_slug = slugify(name)
        slug = base_slug
        n = 1
        while Category.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{n}"
            n += 1
        serializer.save(slug=slug)


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin : détail, modification et suppression d'une catégorie."""
    permission_classes = [IsAdmin]
    serializer_class   = AdminCategorySerializer
    queryset           = Category.objects.all()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Désactiver plutôt que supprimer (évite les FK cassées)
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        return Response({'status': 'deactivated'}, status=status.HTTP_200_OK)