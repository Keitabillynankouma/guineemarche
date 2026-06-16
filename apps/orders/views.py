from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)

from .models import Order, Payment, PickupPoint
from .serializers import OrderSerializer, CreatePaymentSerializer, PaymentSerializer, PickupPointSerializer
from .payment_service import initiate_orange_money
from core.permissions import IsAdmin


class PickupPointListView(generics.ListAPIView):
    """Public : liste les points de retrait actifs, filtrables par ville."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = PickupPointSerializer

    def get_queryset(self):
        qs   = PickupPoint.objects.filter(is_active=True)
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__iexact=city)
        return qs


class AdminPickupPointView(APIView):
    """Admin : CRUD complet sur les points de retrait."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = PickupPoint.objects.all().order_by('city', 'name')
        return Response(PickupPointSerializer(qs, many=True).data)

    def post(self, request):
        serializer = PickupPointSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class AdminPickupPointDetailView(APIView):
    """Admin : modifier ou supprimer un point de retrait."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        obj = get_object_or_404(PickupPoint, pk=pk)
        serializer = PickupPointSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = get_object_or_404(PickupPoint, pk=pk)
        obj.delete()
        return Response(status=204)


class OrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(buyer=user).select_related('listing', 'buyer', 'seller')

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        listing = serializer.validated_data.get('listing')
        user    = self.request.user
        if listing and listing.seller == user:
            raise PermissionDenied("Vous ne pouvez pas acheter votre propre annonce.")
        if listing and not listing.is_active:
            raise ValidationError("Cette annonce n'est plus disponible.")
        serializer.save(buyer=user)


class SellerOrdersView(generics.ListAPIView):
    """Liste des commandes reçues par le vendeur."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(seller=user).select_related('listing', 'buyer', 'seller')


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(buyer=user) | Order.objects.filter(seller=user)


class OrderUpdateStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        from apps.notifications.models import Notification
        order = get_object_or_404(Order, pk=pk)
        user  = request.user

        if action == 'confirm' and order.seller == user:
            order.confirm()
            Notification.send(
                user=order.buyer,
                type=Notification.Type.ORDER_UPDATE,
                title='Commande confirmée',
                body=f'Le vendeur a confirmé votre commande pour « {order.listing.title} ».',
                data={'order_id': str(order.id)},
            )
        elif action == 'complete' and order.buyer == user:
            order.complete()
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='Commande terminée',
                body=f'La commande pour « {order.listing.title} » a été marquée comme terminée.',
                data={'order_id': str(order.id)},
            )
        elif action == 'cancel' and user in [order.buyer, order.seller]:
            order.cancel()
            other = order.seller if user == order.buyer else order.buyer
            Notification.send(
                user=other,
                type=Notification.Type.ORDER_UPDATE,
                title='Commande annulée',
                body=f'La commande pour « {order.listing.title} » a été annulée.',
                data={'order_id': str(order.id)},
            )
        else:
            return Response({'error': 'Action non autorisée.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(OrderSerializer(order).data)


class ConfirmReceiptView(APIView):
    """L'acheteur confirme la réception → libère l'escrow + complète la commande."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status != Order.Status.CONFIRMED:
            return Response(
                {'error': 'La commande doit être confirmée par le vendeur avant de valider la réception.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.complete()
        if order.escrow_status == Order.EscrowStatus.HELD:
            order.release_escrow()

        from apps.notifications.models import Notification
        Notification.send(
            user=order.seller,
            type=Notification.Type.ORDER_UPDATE,
            title='Réception confirmée',
            body=f"L'acheteur a confirmé la réception pour « {order.listing.title} ». Les fonds sont libérés.",
            data={'order_id': str(order.id)},
        )

        return Response(OrderSerializer(order).data)


class DisputeView(APIView):
    """L'acheteur ouvre un litige — l'escrow reste bloqué jusqu'à résolution admin."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status not in [Order.Status.CONFIRMED, Order.Status.PENDING]:
            return Response(
                {'error': 'Impossible d\'ouvrir un litige sur cette commande.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = Order.Status.DISPUTED
        order.save(update_fields=['status', 'updated_at'])

        from apps.notifications.models import Notification
        Notification.send(
            user=order.seller,
            type=Notification.Type.ORDER_UPDATE,
            title='Litige ouvert',
            body=f"Un litige a été ouvert pour la commande « {order.listing.title} ».",
            data={'order_id': str(order.id)},
        )

        return Response(OrderSerializer(order).data)


class InitiatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status not in [Order.Status.PENDING, Order.Status.CONFIRMED]:
            return Response(
                {'error': 'Cette commande ne peut pas être payée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        provider     = serializer.validated_data['provider']
        phone_number = serializer.validated_data.get('phone_number', '')

        payment = Payment.objects.create(
            order=order, provider=provider,
            phone_number=phone_number,
            amount_gnf=order.amount_gnf,
            status=Payment.Status.PENDING,
        )

        if provider == Payment.Provider.ORANGE_MONEY:
            result = initiate_orange_money(phone_number, order.amount_gnf, str(order.id))
        else:
            result = type('R', (), {'success': True, 'reference': '', 'message': 'Paiement en espèces enregistré'})()

        if result.success:
            payment.status       = Payment.Status.SUCCESS
            payment.external_ref = getattr(result, 'reference', '')
            payment.save(update_fields=['status', 'external_ref'])
            order.confirm()
            # Planifier la libération escrow pour Orange Money (6h petits / 48h gros montants)
            if provider == Payment.Provider.ORANGE_MONEY:
                order.set_escrow_schedule()
        else:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response({'error': result.message}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'message':  result.message,
            'payment':  PaymentSerializer(payment).data,
            'escrow':   order.escrow_status,
        }, status=status.HTTP_201_CREATED)


def _verify_orange_signature(request):
    """Vérifie la signature HMAC-SHA256 d'Orange Money."""
    secret = getattr(settings, 'ORANGE_WEBHOOK_SECRET', '')
    if not secret:
        return True  # non configuré → laisser passer (log warning)
    sig_header = request.headers.get('X-Orange-Signature', '')
    body        = request.body
    expected    = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_header, expected)


@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, provider):
        data = request.data

        if provider == 'orange':
            if not _verify_orange_signature(request):
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
            ref     = data.get('pay_token', '')
            success = data.get('status', '') == 'SUCCESS'
        else:
            return Response({'error': 'Fournisseur inconnu'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.get(external_ref=ref) if ref else None
            if not payment:
                payment = Payment.objects.filter(order__id=ref, status=Payment.Status.PENDING).first()
            if payment:
                payment.status = Payment.Status.SUCCESS if success else Payment.Status.FAILED
                payment.save(update_fields=['status'])
                if success:
                    payment.order.confirm()
                    payment.order.set_escrow_schedule()
            else:
                logger.warning("[WEBHOOK] %s — paiement introuvable pour ref=%s", provider, ref)
        except Exception as exc:
            logger.error("[WEBHOOK] %s — erreur traitement paiement ref=%s : %s", provider, ref, exc, exc_info=True)

        return Response({'status': 'ok'})


# ── Admin ──────────────────────────────────────────────────────────────────────

class AdminEscrowHoldView(APIView):
    """Admin : bloquer ou débloquer manuellement la libération automatique d'un escrow."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        order  = get_object_or_404(Order, pk=pk)
        action = request.data.get('action')  # 'hold' ou 'release'

        if action == 'hold':
            order.escrow_admin_hold = True
            order.save(update_fields=['escrow_admin_hold', 'updated_at'])
            # Notifier le vendeur
            from apps.notifications.models import Notification
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='⚠️ Fonds temporairement bloqués',
                body=f'Les fonds de la commande « {order.listing.title} » ont été bloqués '
                     f'par l\'administration pour vérification. Contactez le support si nécessaire.',
                data={'order_id': str(order.id)},
            )
            return Response({'status': 'held', 'order_id': str(order.id)})

        elif action == 'release':
            order.escrow_admin_hold = False
            order.save(update_fields=['escrow_admin_hold', 'updated_at'])
            # Libérer immédiatement si la date est passée
            from django.utils import timezone
            if order.escrow_status == Order.EscrowStatus.HELD and (
                order.escrow_release_at is None or order.escrow_release_at <= timezone.now()
            ):
                order.release_escrow()
                from apps.notifications.models import Notification
                Notification.send(
                    user=order.seller,
                    type=Notification.Type.ORDER_UPDATE,
                    title='💰 Fonds libérés',
                    body=f'Les fonds ({order.seller_payout_gnf:,} GNF) pour « {order.listing.title} » sont maintenant disponibles.',
                    data={'order_id': str(order.id)},
                )
                return Response({'status': 'released', 'order_id': str(order.id)})
            return Response({'status': 'unblocked', 'order_id': str(order.id)})

        return Response({'error': "action doit être 'hold' ou 'release'."}, status=status.HTTP_400_BAD_REQUEST)


class AdminDisputeListView(generics.ListAPIView):
    """Admin : liste toutes les commandes en litige."""
    permission_classes = [IsAdmin]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(
            status=Order.Status.DISPUTED
        ).select_related('listing', 'buyer', 'seller').prefetch_related('payments')


class AdminDisputeResolveView(APIView):
    """Admin : résoudre un litige — libérer les fonds au vendeur ou rembourser l'acheteur."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        order  = get_object_or_404(Order, pk=pk, status=Order.Status.DISPUTED)
        action = request.data.get('action')  # 'release' ou 'refund'

        if action not in ('release', 'refund'):
            return Response(
                {'error': "action doit être 'release' ou 'refund'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.notifications.models import Notification

        if action == 'release':
            order.complete()
            if order.escrow_status == Order.EscrowStatus.HELD:
                order.release_escrow()
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu — fonds libérés',
                body=f'Le litige pour « {order.listing.title} » a été résolu en votre faveur. Les fonds vous sont versés.',
                data={'order_id': str(order.id)},
            )
            Notification.send(
                user=order.buyer,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu',
                body=f'Le litige pour « {order.listing.title} » a été résolu. Les fonds ont été versés au vendeur.',
                data={'order_id': str(order.id)},
            )
        else:  # refund
            order.refund_escrow()
            order.cancel()
            Notification.send(
                user=order.buyer,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu — remboursement',
                body=f'Le litige pour « {order.listing.title} » a été résolu en votre faveur. Vous serez remboursé.',
                data={'order_id': str(order.id)},
            )
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu',
                body=f'Le litige pour « {order.listing.title} » a été résolu en faveur de l\'acheteur.',
                data={'order_id': str(order.id)},
            )

        return Response(OrderSerializer(order).data)


class AdminStatsView(APIView):
    """Admin : statistiques globales de la plateforme."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.accounts.models import User
        from apps.listings.models import Listing
        from django.db.models import Sum

        return Response({
            'users':           User.objects.count(),
            'active_listings': Listing.objects.filter(status='active').count(),
            'orders_total':    Order.objects.count(),
            'orders_disputed': Order.objects.filter(status=Order.Status.DISPUTED).count(),
            'orders_completed':Order.objects.filter(status=Order.Status.COMPLETED).count(),
            'revenue_gnf':     Payment.objects.filter(
                                   status=Payment.Status.SUCCESS
                               ).aggregate(total=Sum('amount_gnf'))['total'] or 0,
        })


class AdminExportCSVView(APIView):
    """Admin : export CSV des commandes ou utilisateurs."""
    permission_classes = [IsAdmin]

    def get(self, request):
        import csv
        from django.http import HttpResponse
        from apps.accounts.models import User as AppUser

        export_type = request.query_params.get('type', 'orders')

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="{export_type}_export.csv"'

        writer = csv.writer(response)

        if export_type == 'users':
            writer.writerow(['ID', 'Nom', 'Téléphone', 'Email', 'Rôle', 'Vérifié', 'Ville', 'Créé le'])
            for u in AppUser.objects.all().order_by('-created_at'):
                writer.writerow([
                    str(u.id), u.full_name, str(u.phone_number),
                    u.email or '', u.role, u.is_verified, u.city,
                    u.created_at.strftime('%d/%m/%Y %H:%M'),
                ])
        else:
            writer.writerow([
                'ID', 'Annonce', 'Acheteur', 'Vendeur', 'Montant GNF',
                'Statut', 'Mode livraison', 'Créé le',
            ])
            for o in Order.objects.select_related('listing', 'buyer', 'seller').order_by('-created_at'):
                writer.writerow([
                    str(o.id), o.listing.title,
                    o.buyer.full_name, o.seller.full_name,
                    o.amount_gnf, o.status, o.delivery_mode,
                    o.created_at.strftime('%d/%m/%Y %H:%M'),
                ])

        return response
