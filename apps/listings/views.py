from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.http import HttpResponse

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
        import logging
        logger = logging.getLogger(__name__)
        from apps.accounts.models import Subscription, Badge
        from rest_framework.exceptions import PermissionDenied, ValidationError
        from core.site_settings import SiteSettings
        user = self.request.user
        try:
            site = SiteSettings.get()
        except Exception as e:
            logger.error("SiteSettings.get() failed: %s", e, exc_info=True)
            site = None

        sub, _ = Subscription.objects.get_or_create(user=user)
        # Vérifier quotas dès que "Publications gratuites illimitées" est désactivé.
        # NB : le toggle "Activer les abonnements payants" est indépendant — il
        #      sert uniquement à afficher la page Tarifs. La limite s'applique
        #      sans qu'il soit nécessaire d'activer les abonnements payants.
        if site and not site.free_listings_enabled:
            limit = site.max_free_listings  # valeur définie dans Paramètres admin
            # Pro → illimité | Gratuit → vérifier le compteur contre la limite du site
            if not sub.is_pro and sub.listings_used >= limit:
                raise PermissionDenied(
                    detail={
                        'code': 'subscription_required',
                        'message': (
                            f'Vous avez atteint la limite de {limit} annonce{"s" if limit != 1 else ""} gratuite{"s" if limit != 1 else ""}. '
                            'Passez au plan Pro pour publier des annonces illimitées.'
                            if limit > 0 else
                            'La publication d\'annonces est réservée aux abonnés. '
                            'Contactez l\'administrateur pour obtenir un accès Pro.'
                        ),
                    }
                )

        # 1. Sauvegarder en DRAFT (en attente de modération async)
        try:
            listing = serializer.save(seller=user, status=Listing.Status.DRAFT)
        except Exception as e:
            logger.error("serializer.save() failed: %s", e, exc_info=True)
            raise ValidationError({'detail': f'Erreur lors de la création de l\'annonce: {str(e)}'})

        # 2. Lancer la modération IA en arrière-plan (Celery) — ne bloque pas la réponse
        try:
            from .tasks import moderate_listing_task
            moderate_listing_task.delay(str(listing.id))
        except Exception as celery_err:
            logger.warning("Celery indisponible (%s), modération synchrone", celery_err)
            # Si Celery indisponible, modération synchrone de secours
            try:
                from .moderation import moderate_listing
                category_name = listing.category.name if listing.category else 'Non définie'
                mod = moderate_listing(listing.title, listing.description, listing.price_gnf, category_name)
                auto = SiteSettings.flag('auto_approve_listings', default=True) if site else True
                if mod['decision'] == 'reject':
                    listing.status = Listing.Status.SUSPENDED
                elif mod['decision'] == 'review' and not auto:
                    listing.status = Listing.Status.DRAFT  # en attente admin
                else:
                    listing.status = Listing.Status.ACTIVE  # approve OU review auto
                listing.save(update_fields=['status'])
            except Exception as mod_err:
                logger.error("Modération synchrone échouée: %s", mod_err, exc_info=True)
                listing.status = Listing.Status.ACTIVE
                listing.save(update_fields=['status'])

        # 3. Compteur abonnement + badge
        try:
            sub.listings_used += 1
            sub.save(update_fields=['listings_used'])
            if sub.listings_used == 1:
                Badge.award(user, Badge.Type.FIRST_LISTING)
        except Exception as e:
            logger.error("Badge/subscription update failed: %s", e, exc_info=True)


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
        import logging
        logger = logging.getLogger(__name__)
        instance = self.get_object()
        if instance.seller != request.user:
            return Response(
                {'error': 'Vous ne pouvez modifier que vos propres annonces.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ── Cas spécial : réapprovisionnement de stock ────────────────────────
        # Si l'annonce est expirée pour rupture de stock ET que le vendeur
        # envoie un stock_qty > 0 → réactiver sans re-modération (le contenu n'a pas changé)
        new_stock = request.data.get('stock_qty')
        stock_reactivation = (
            instance.status == Listing.Status.EXPIRED
            and instance.stock_qty == 0
            and new_stock is not None
            and str(new_stock).isdigit()
            and int(new_stock) > 0
        )

        # Détecter si le contenu textuel change → re-modération obligatoire
        content_changed = (
            'title'       in request.data and request.data['title']       != instance.title or
            'description' in request.data and request.data['description'] != instance.description
        )

        response = super().update(request, *args, **kwargs)

        instance.refresh_from_db()

        if stock_reactivation and not content_changed:
            # Réactiver directement — le produit était déjà approuvé avant
            instance.status = Listing.Status.ACTIVE
            instance.save(update_fields=['status'])
        elif content_changed:
            # Repasser en DRAFT le temps de la re-modération
            instance.status = Listing.Status.DRAFT
            instance.save(update_fields=['status'])
            try:
                from .tasks import moderate_listing_task
                moderate_listing_task.delay(str(instance.id))
            except Exception as e:
                logger.warning("Re-modération Celery indisponible: %s — activation directe", e)
                instance.status = Listing.Status.ACTIVE
                instance.save(update_fields=['status'])
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.seller != request.user:
            return Response(
                {'error': 'Vous ne pouvez supprimer que vos propres annonces.'},
                status=status.HTTP_403_FORBIDDEN
            )


class UpdateStockView(APIView):
    """
    PATCH /api/v1/listings/<pk>/stock/
    Body: { "stock_qty": <int> }

    Permet au vendeur de mettre à jour uniquement le stock d'un produit.
    - stock_qty = null  → stock illimité (comportement annonce classique)
    - stock_qty = 0     → rupture, annonce dépubliée
    - stock_qty > 0     → si l'annonce était expirée pour rupture → réactivée automatiquement
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        listing = get_object_or_404(Listing, pk=pk)
        if listing.seller != request.user:
            return Response({'error': 'Action non autorisée.'}, status=status.HTTP_403_FORBIDDEN)

        raw = request.data.get('stock_qty')
        # None ou "" → stock illimité
        if raw is None or raw == '':
            listing.stock_qty = None
            listing.save(update_fields=['stock_qty'])
            return Response({'stock_qty': None, 'status': listing.status})

        try:
            new_qty = int(raw)
            if new_qty < 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'stock_qty doit être un entier ≥ 0.'}, status=status.HTTP_400_BAD_REQUEST)

        was_out_of_stock = (listing.stock_qty == 0 and listing.status == Listing.Status.EXPIRED)

        listing.stock_qty = new_qty
        if new_qty == 0 and listing.status == Listing.Status.ACTIVE:
            listing.status = Listing.Status.EXPIRED
        elif new_qty > 0 and was_out_of_stock:
            # Réapprovisionnement → réactiver l'annonce
            listing.status = Listing.Status.ACTIVE
        listing.save(update_fields=['stock_qty', 'status'])

        return Response({'stock_qty': listing.stock_qty, 'status': listing.status})
        # Soft-delete : suspendre l'annonce
        was_active = instance.status == Listing.Status.ACTIVE
        instance.status = Listing.Status.SUSPENDED
        instance.save(update_fields=['status'])

        # Décrémenter le compteur d'annonces de l'abonnement si l'annonce était active
        if was_active:
            try:
                from apps.accounts.models import Subscription
                sub = Subscription.objects.filter(user=request.user).first()
                if sub and sub.listings_used > 0:
                    sub.listings_used -= 1
                    sub.save(update_fields=['listings_used'])
            except Exception:
                pass

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
        from rest_framework.exceptions import ValidationError as DRFValidationError
        listing = serializer.validated_data.get('listing')
        if ListingReport.objects.filter(reporter=self.request.user, listing=listing).exists():
            raise DRFValidationError({'detail': 'Vous avez déjà signalé cette annonce.'})
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

def _apply_boost(listing, days):
    """
    Active le boost sur l'annonce (prolonge si déjà en cours).

    IMPORTANT : n'écrase PAS expires_at des annonces permanentes (expires_at=None).
    On utilise boost_expires_at (champ dédié) pour la durée du boost.
    expires_at est réservé aux annonces payantes avec expiration explicite.
    """
    from datetime import timedelta
    listing.is_boosted = True
    now = timezone.now()
    # Calculer la date de fin de boost (prolonge si déjà en cours)
    if hasattr(listing, 'boost_expires_at') and listing.boost_expires_at and listing.boost_expires_at > now:
        listing.boost_expires_at = listing.boost_expires_at + timedelta(days=days)
    else:
        listing.boost_expires_at = now + timedelta(days=days)
    # Ne jamais toucher à expires_at si l'annonce était permanente (None)
    # Cela évite qu'un boost fasse expirer définitivement une annonce sans date.
    update_fields = ['is_boosted', 'boost_expires_at', 'updated_at']
    listing.save(update_fields=update_fields)


class BoostListingView(APIView):
    """
    POST /listings/{id}/boost/
    Body: { days: 3|7|14|30 }

    Tous les boosts passent par ChaChap Pay.
    Retourne un payment_url → frontend redirige l'utilisateur.
    ChaChap Pay envoie le webhook qui active le boost.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from apps.orders.payment_service import initiate_chachap
        from apps.orders.models import Payment
        from .models import BoostPayment

        listing = get_object_or_404(Listing, pk=pk, seller=request.user)

        # Interdire le boost sur une annonce non active (évite de facturer pour rien)
        if listing.status != Listing.Status.ACTIVE:
            return Response(
                {'error': 'Seules les annonces actives peuvent être boostées.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            days = int(request.data.get('days', 7))
        except (TypeError, ValueError):
            return Response({'error': 'Le champ days doit être un entier.'}, status=400)

        if days not in BOOST_PRICES:
            return Response(
                {'error': f'Durée invalide. Choisissez parmi : {list(BOOST_PRICES)}.'},
                status=400,
            )

        amount = BOOST_PRICES[days]

        # ── Initier le paiement via ChaChap Pay ──────────────────────────────
        result = initiate_chachap(amount=amount, order_id=f'boost-{listing.id}')
        if not result.success or not result.payment_url:
            return Response(
                {'error': result.message or 'Erreur ChaChap Pay.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Créer BoostPayment en attente — activé par le webhook ChaChap
        bp = BoostPayment.objects.create(
            listing=listing, days=days, amount=amount,
            provider=Payment.Provider.CHACHAP,
            status=BoostPayment.Status.PENDING,
            ext_ref=result.reference or '',
        )

        return Response({
            'message':          f'Redirigez vers ChaChap Pay pour finaliser le boost {days} jours.',
            'pending':          True,
            'boost_payment_id': str(bp.id),
            'payment_url':      result.payment_url,
            'amount':           amount,
            'is_boosted':       False,
        }, status=status.HTTP_201_CREATED)


class AdminBoostPaymentListView(APIView):
    """Admin : liste les demandes de boost (en attente ou toutes)."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import BoostPayment
        qs = BoostPayment.objects.select_related('listing__seller')
        status_filter = request.query_params.get('status', 'pending')
        if status_filter != 'all':
            qs = qs.filter(status=status_filter)
        items = [
            {
                'id':            str(bp.id),
                'listing_id':    str(bp.listing_id),
                'listing_title': bp.listing.title,
                'seller':        bp.listing.seller.full_name,
                'days':          bp.days,
                'amount':        bp.amount,
                'provider':      bp.provider,
                'status':        bp.status,
                'created_at':    bp.created_at,
            }
            for bp in qs
        ]
        return Response(items)


class AdminBoostPaymentApproveView(APIView):
    """Admin : approuver une demande de boost espèces → active le boost."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .models import BoostPayment
        from apps.notifications.models import Notification
        bp = get_object_or_404(BoostPayment, pk=pk, status=BoostPayment.Status.PENDING)

        _apply_boost(bp.listing, bp.days)
        bp.status     = BoostPayment.Status.APPROVED
        bp.admin_note = request.data.get('note', '')
        bp.save(update_fields=['status', 'admin_note', 'updated_at'])

        try:
            Notification.send(
                user=bp.listing.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='⚡ Boost activé !',
                body=f'Votre paiement de {bp.amount:,} GNF a été confirmé. '
                     f'« {bp.listing.title} » est boostée pour {bp.days} jours.',
                data={'listing_id': str(bp.listing_id)},
            )
        except Exception:
            pass

        return Response({
            'message':    f'Boost activé pour {bp.days} jours.',
            'is_boosted': True,
            'expires_at': bp.listing.expires_at,
        })


class AdminBoostPaymentRejectView(APIView):
    """Admin : rejeter une demande de boost espèces."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .models import BoostPayment
        from apps.notifications.models import Notification
        bp = get_object_or_404(BoostPayment, pk=pk, status=BoostPayment.Status.PENDING)

        bp.status     = BoostPayment.Status.REJECTED
        bp.admin_note = request.data.get('reason', '')
        bp.save(update_fields=['status', 'admin_note', 'updated_at'])

        try:
            Notification.send(
                user=bp.listing.seller,
                type=Notification.Type.SYSTEM,
                title='❌ Demande de boost rejetée',
                body=f'Votre demande de boost pour « {bp.listing.title} » a été rejetée. '
                     + (f'Motif : {bp.admin_note}' if bp.admin_note else ''),
                data={'listing_id': str(bp.listing_id)},
            )
        except Exception:
            pass

        return Response({'message': 'Demande de boost rejetée.'})


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


# ── Page de partage social (Open Graph) ───────────────────────────────────────

class ListingShareView(APIView):
    """
    GET /share/listing/<uuid:listing_id>/

    Page HTML minimale pour le partage sur les réseaux sociaux (Facebook, WhatsApp,
    Twitter/X, LinkedIn, Telegram…).

    Les crawlers (bots) lisent les balises Open Graph et Twitter Card dans le <head>.
    Les vrais utilisateurs sont redirigés en JavaScript vers l'app React
    (https://guimatrix.com/listing/<id>).

    Cette vue n'est PAS sous /api/v1/ — elle est enregistrée directement
    dans config/urls.py pour être accessible à la racine du domaine.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, listing_id):
        from django.conf import settings as _s
        import html as _html

        # Autoriser ACTIVE et DRAFT (modération en cours) — les bots FB scrapent avant la mise en ligne
        listing = get_object_or_404(
            Listing.objects.select_related('seller', 'category').prefetch_related('media'),
            id=listing_id,
            status__in=[Listing.Status.ACTIVE, Listing.Status.DRAFT],
        )

        # ── Données ──────────────────────────────────────────────────────────
        frontend_url = getattr(_s, 'FRONTEND_URL', 'https://guimatrix.com')
        api_url      = getattr(_s, 'API_BASE_URL',  'https://api.guimatrix.com')

        listing_url  = f"{frontend_url}/listing/{listing.id}"
        share_url    = f"{api_url}/share/listing/{listing.id}/"

        title = _html.escape(listing.title)

        price_str = (
            'Gratuit' if listing.price_type == 'free'
            else f"{listing.price_gnf:,} GNF".replace(',', ' ')
        )
        if listing.price_type == 'negotiable':
            price_str += ' (à débattre)'

        # Description courte pour OG (160 chars max)
        raw_desc = listing.description or ''
        desc_short = _html.escape(
            (raw_desc[:155] + '…') if len(raw_desc) > 157 else raw_desc
        )
        og_description = f"{price_str} · {listing.city} · {desc_short}"

        # Image principale
        first_media = listing.media.first()
        og_image = (
            first_media.file.url
            if first_media and hasattr(first_media.file, 'url')
            else f"{frontend_url}/og-default.png"
        )
        # Cloudinary : forcer HTTPS et transformer en 1200×630 (ratio Facebook)
        if 'cloudinary.com' in og_image and og_image.startswith('http://'):
            og_image = og_image.replace('http://', 'https://', 1)
        if 'cloudinary.com' in og_image:
            # Insérer transformation si absente
            if '/upload/' in og_image and 'w_1200' not in og_image:
                og_image = og_image.replace('/upload/', '/upload/w_1200,h_630,c_fill,f_auto,q_auto/', 1)

        condition_labels = {
            'new':      'Neuf',
            'like_new': 'Comme neuf',
            'good':     'Bon état',
            'fair':     'État correct',
            'poor':     'Très usé',
        }
        condition = condition_labels.get(listing.condition, listing.condition)
        category  = listing.category.name if listing.category else ''
        seller    = _html.escape(listing.seller.full_name or '')

        # WhatsApp message pré-rempli
        import urllib.parse
        wa_text = urllib.parse.quote(
            f"🛍️ {listing.title}\n"
            f"💰 {price_str}\n"
            f"📍 {listing.city}\n"
            f"👉 {share_url}"
        )

        # ── HTML ─────────────────────────────────────────────────────────────
        html = f"""<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — {price_str} | Guimatrix</title>

  <!-- ── SEO basique ───────────────────────────────────────── -->
  <meta name="description" content="{og_description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{share_url}">

  <!-- ── Open Graph (Facebook, WhatsApp, LinkedIn, Telegram) ── -->
  <meta property="og:type"        content="product">
  <meta property="og:site_name"   content="Guimatrix">
  <meta property="og:url"         content="{share_url}">
  <meta property="og:title"       content="{title} — {price_str}">
  <meta property="og:description" content="{og_description}">
  <meta property="og:image"       content="{og_image}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt"    content="{title}">
  <meta property="og:locale"       content="fr_GN">

  <!-- Open Graph product (Facebook Catalog) -->
  <meta property="product:price:amount"   content="{listing.price_gnf}">
  <meta property="product:price:currency" content="GNF">
  <meta property="product:condition"      content="{condition}">
  <meta property="product:availability"   content="in stock">

  <!-- ── Twitter Card ──────────────────────────────────────── -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:site"        content="@Guimatrix_GN">
  <meta name="twitter:title"       content="{title} — {price_str}">
  <meta name="twitter:description" content="{og_description}">
  <meta name="twitter:image"       content="{og_image}">
  <meta name="twitter:image:alt"   content="{title}">

  <!-- ── Schema.org Product (Google, Pinterest) ────────────── -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "{title}",
    "description": "{desc_short}",
    "image": "{og_image}",
    "url": "{share_url}",
    "category": "{category}",
    "itemCondition": "https://schema.org/{'NewCondition' if listing.condition == 'new' else 'UsedCondition'}",
    "offers": {{
      "@type": "Offer",
      "priceCurrency": "GNF",
      "price": "{listing.price_gnf}",
      "availability": "https://schema.org/InStock",
      "seller": {{
        "@type": "Person",
        "name": "{seller}"
      }}
    }}
  }}
  </script>

  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f9fafb; color: #1f2937;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 1rem;
    }}
    .card {{
      background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.1);
      max-width: 440px; width: 100%; overflow: hidden;
    }}
    .img-wrap {{ position: relative; height: 220px; background: #e5e7eb; overflow: hidden; }}
    .img-wrap img {{ width: 100%; height: 100%; object-fit: cover; }}
    .badge {{
      position: absolute; top: 10px; left: 10px;
      background: #16a34a; color: white;
      font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px;
    }}
    .body {{ padding: 1.25rem; }}
    h1 {{ font-size: 1.1rem; font-weight: 700; line-height: 1.4; margin-bottom: .5rem; }}
    .price {{ font-size: 1.4rem; font-weight: 800; color: #16a34a; margin-bottom: .5rem; }}
    .meta {{ font-size: .82rem; color: #6b7280; margin-bottom: 1rem; display: flex; gap: .75rem; flex-wrap: wrap; }}
    .cta {{
      display: block; text-align: center;
      background: #16a34a; color: white;
      padding: .75rem; border-radius: 10px;
      font-weight: 700; font-size: .95rem;
      text-decoration: none; margin-bottom: .75rem;
    }}
    .cta:hover {{ background: #15803d; }}
    .wa {{
      display: flex; align-items: center; justify-content: center; gap: .5rem;
      background: #25D366; color: white;
      padding: .65rem; border-radius: 10px;
      font-weight: 600; font-size: .9rem;
      text-decoration: none;
    }}
    .footer {{ font-size: .72rem; text-align: center; color: #9ca3af; margin-top: .75rem; }}
    .spinner {{
      text-align: center; padding: 2rem;
      font-size: .9rem; color: #6b7280;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="img-wrap">
      <img src="{og_image}" alt="{title}" onerror="this.style.display='none'">
      <span class="badge">Guimatrix</span>
    </div>
    <div class="body">
      <h1>{title}</h1>
      <div class="price">{price_str}</div>
      <div class="meta">
        <span>📍 {listing.city}</span>
        {"<span>🏷️ " + category + "</span>" if category else ""}
        {"<span>✨ " + condition + "</span>" if condition else ""}
      </div>
      <a href="{listing_url}" class="cta">Voir l'annonce complète →</a>
      <a href="https://wa.me/?text={wa_text}" class="wa" target="_blank" rel="noopener">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Partager sur WhatsApp
      </a>
      <div class="footer">Guimatrix — Le marché intelligent de la Guinée 🇬🇳</div>
    </div>
  </div>

  <!-- Redirection automatique vers l'app React pour les vrais utilisateurs -->
  <script>
    // Les crawlers n'exécutent pas JavaScript — ils lisent les meta tags ci-dessus.
    // Les vrais utilisateurs sont redirigés immédiatement vers l'app React.
    window.location.replace("{listing_url}");
  </script>
</body>
</html>"""

        return HttpResponse(html, content_type='text/html; charset=utf-8')