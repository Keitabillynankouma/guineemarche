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

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        # Filtre géographique optionnel — Haversine en Python
        try:
            lat  = float(self.request.query_params.get('near_lat', ''))
            lng  = float(self.request.query_params.get('near_lng', ''))
            r    = float(self.request.query_params.get('radius_km', '50'))
        except (TypeError, ValueError):
            return queryset
        # Ne filtre que les annonces avec lat/lng renseignés
        import math
        R = 6371.0
        def _in_radius(listing):
            if listing.latitude is None or listing.longitude is None:
                return False
            dlat = math.radians(listing.latitude - lat)
            dlng = math.radians(listing.longitude - lng)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(listing.latitude)) * math.sin(dlng/2)**2
            return R * 2 * math.asin(math.sqrt(a)) <= r
        ids = [l.id for l in queryset if _in_radius(l)]
        return queryset.filter(id__in=ids)

    def perform_create(self, serializer):
        from apps.accounts.models import Subscription, Badge
        from rest_framework.exceptions import PermissionDenied
        from core.site_settings import SiteSettings
        from .moderation import moderate_listing
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

        # 1. Sauvegarder en DRAFT (en attente de modération async)
        listing = serializer.save(seller=user, status=Listing.Status.DRAFT)

        # 2. Lancer la modération IA en arrière-plan (Celery) — ne bloque pas la réponse
        try:
            from .tasks import moderate_listing_task
            moderate_listing_task.delay(str(listing.id))
        except Exception:
            # Si Celery indisponible, modération synchrone de secours
            from .moderation import moderate_listing
            category_name = listing.category.name if listing.category else 'Non définie'
            mod = moderate_listing(listing.title, listing.description, listing.price_gnf, category_name)
            if mod['decision'] == 'reject':
                listing.status = Listing.Status.SUSPENDED
            elif mod['decision'] != 'review':
                listing.status = Listing.Status.ACTIVE
            listing.save(update_fields=['status'])

        # 3. Compteur abonnement + badge
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


class MySellerStatsView(APIView):
    """
    GET /listings/my/stats/
    Stats avancées du vendeur : portée, taux d'engagement, comparaison mois.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count, Avg, Q
        from datetime import datetime, timedelta
        import calendar

        user = request.user
        now  = timezone.now()

        # Périodes
        start_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start_last_month = (start_this_month - timedelta(days=1)).replace(day=1)
        end_last_month   = start_this_month

        listings = Listing.objects.filter(seller=user)

        # Stats globales
        agg = listings.aggregate(
            total_views=Sum('view_count'),
            total_listings=Count('id'),
            active_count=Count('id', filter=Q(status=Listing.Status.ACTIVE)),
            sold_count=Count('id', filter=Q(status=Listing.Status.SOLD)),
            avg_views=Avg('view_count'),
        )
        total_views    = agg['total_views']    or 0
        total_listings = agg['total_listings'] or 0
        active_count   = agg['active_count']   or 0
        sold_count     = agg['sold_count']     or 0
        avg_views      = round(agg['avg_views'] or 0, 1)

        # Total favoris sur toutes les annonces
        total_favorites = Favorite.objects.filter(listing__seller=user).count()

        # Taux engagement : favoris / vues (%)
        engagement_rate = round((total_favorites / total_views * 100) if total_views > 0 else 0, 1)

        # Annonces créées ce mois / mois dernier
        listings_this_month = listings.filter(created_at__gte=start_this_month).count()
        listings_last_month = listings.filter(
            created_at__gte=start_last_month, created_at__lt=end_last_month
        ).count()

        # Vues par annonce (top 5)
        top_listings = list(
            listings.filter(status=Listing.Status.ACTIVE)
            .order_by('-view_count')[:5]
            .values('id', 'title', 'view_count', 'is_boosted', 'price_gnf')
        )
        for l in top_listings:
            l['id'] = str(l['id'])
            fav_count = Favorite.objects.filter(listing_id=l['id']).count()
            l['favorites'] = fav_count
            l['listing_engagement'] = round(
                (fav_count / l['view_count'] * 100) if l['view_count'] > 0 else 0, 1
            )

        # Vues par mois (6 derniers mois) pour graphique tendance
        monthly_views = []
        for i in range(5, -1, -1):
            d = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Reculer i mois
            for _ in range(i):
                d = (d - timedelta(days=1)).replace(day=1)
            next_month = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
            views_in_month = listings.filter(
                created_at__gte=d, created_at__lt=next_month
            ).aggregate(v=Sum('view_count'))['v'] or 0
            monthly_views.append({
                'month': d.strftime('%b'),
                'views': views_in_month,
                'new_listings': listings.filter(created_at__gte=d, created_at__lt=next_month).count(),
            })

        return Response({
            # Portée
            'total_views':       total_views,
            'avg_views_per_listing': avg_views,
            # Engagement
            'total_favorites':   total_favorites,
            'engagement_rate':   engagement_rate,
            # Annonces
            'total_listings':    total_listings,
            'active_count':      active_count,
            'sold_count':        sold_count,
            # Comparaison mois
            'listings_this_month': listings_this_month,
            'listings_last_month': listings_last_month,
            # Tendance
            'monthly_views':     monthly_views,
            # Top annonces
            'top_listings':      top_listings,
        })


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


class FavoriteToggleView(APIView):
    """POST /listings/{id}/favorite/ — ajoute ou retire des favoris."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk)
        fav, created = Favorite.objects.get_or_create(user=request.user, listing=listing)
        if not created:
            fav.delete()
        return Response({'is_favorited': created, 'listing_id': str(pk)})


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

BOOST_PRICES = {3: 5_000, 7: 10_000, 14: 18_000, 30: 30_000}   # jours → GNF

class BoostListingView(APIView):
    """
    POST /listings/{id}/boost/
    Body: { days: 3|7|14|30, provider: 'orange_money'|'cash', phone: '...' }
    → Initie le paiement Orange Money, et si succès active le boost immédiatement.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from apps.orders.payment_service import initiate_orange_money
        from apps.orders.models import Payment

        listing = get_object_or_404(Listing, pk=pk, seller=request.user)
        days     = int(request.data.get('days', 7))
        provider = request.data.get('provider', Payment.Provider.CASH)
        phone    = request.data.get('phone', '')

        if days not in BOOST_PRICES:
            return Response({'error': 'Durée invalide. Choisissez 3, 7, 14 ou 30 jours.'}, status=400)

        amount = BOOST_PRICES[days]

        # Initier le paiement
        if provider == Payment.Provider.ORANGE_MONEY:
            result = initiate_orange_money(phone, amount, f'boost-{listing.id}')
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


class AdminListingApproveView(APIView):
    """Admin : approuver une annonce en draft (après révision manuelle)."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk)
        if listing.status not in (Listing.Status.DRAFT, Listing.Status.SUSPENDED):
            return Response({'error': 'Annonce déjà active ou vendue.'}, status=400)
        listing.status = Listing.Status.ACTIVE
        listing.save(update_fields=['status', 'updated_at'])

        # Notifier le vendeur
        try:
            from apps.notifications.models import Notification
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='✅ Annonce approuvée',
                body=f'Votre annonce "{listing.title}" a été approuvée et est maintenant visible.',
                data={'listing_id': str(listing.id)},
            )
        except Exception:
            pass

        return Response({'status': 'active'})


class AdminListingRejectView(APIView):
    """Admin : refuser une annonce avec une raison (notifie le vendeur)."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk)
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Une raison de refus est requise.'}, status=400)

        listing.status = Listing.Status.SUSPENDED
        listing.save(update_fields=['status', 'updated_at'])

        # Notifier le vendeur avec la raison
        try:
            from apps.notifications.models import Notification
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='❌ Annonce refusée',
                body=f'Votre annonce "{listing.title}" a été refusée par notre équipe. '
                     f'Raison : {reason}. Contactez le support si vous pensez qu\'il s\'agit d\'une erreur.',
                data={'listing_id': str(listing.id)},
            )
        except Exception:
            pass

        # SMS au vendeur
        try:
            from core.sms import send_sms
            send_sms(
                str(listing.seller.phone_number),
                f'Guimatrix : Votre annonce "{listing.title[:30]}" a été refusée. '
                f'Raison : {reason[:80]}. Contactez le support.'
            )
        except Exception:
            pass

        return Response({'status': 'suspended', 'reason': reason})


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