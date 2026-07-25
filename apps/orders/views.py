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

from .models import Order, Payment, PickupPoint, MeetingZone, DeliveryZone, DeliveryAssignment, IntraCityZoneRate, ReturnRequest, LivreurPayment
from .serializers import OrderSerializer, CreatePaymentSerializer, PaymentSerializer, PickupPointSerializer, MeetingZoneSerializer, DeliveryZoneSerializer, DeliveryAssignmentSerializer, IntraCityZoneRateSerializer
from .payment_service import initiate_orange_money, initiate_paycard, initiate_paycard_card, initiate_chachap
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


class MeetingZoneListView(generics.ListAPIView):
    """Public : liste les zones de rencontre actives, filtrables par ville."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = MeetingZoneSerializer

    def get_queryset(self):
        qs   = MeetingZone.objects.filter(is_active=True)
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


class AdminMeetingZoneView(APIView):
    """Admin : CRUD complet sur les zones de rencontre."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = MeetingZone.objects.all().order_by('city', 'name')
        return Response(MeetingZoneSerializer(qs, many=True).data)

    def post(self, request):
        serializer = MeetingZoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class AdminMeetingZoneDetailView(APIView):
    """Admin : modifier ou supprimer une zone de rencontre."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        obj = get_object_or_404(MeetingZone, pk=pk)
        serializer = MeetingZoneSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = get_object_or_404(MeetingZone, pk=pk)
        obj.delete()
        return Response(status=204)


class DeliveryZoneListView(generics.ListAPIView):
    """Public : liste les zones de livraison actives, filtrables par ville."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = DeliveryZoneSerializer

    def get_queryset(self):
        qs   = DeliveryZone.objects.filter(is_active=True)
        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__iexact=city)
        return qs


class AdminDeliveryZoneView(APIView):
    """Admin : CRUD complet sur les zones de livraison."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = DeliveryZone.objects.all().order_by('city')
        return Response(DeliveryZoneSerializer(qs, many=True).data)

    def post(self, request):
        serializer = DeliveryZoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=201)


class IntraCityZoneRateListView(generics.ListAPIView):
    """Public : tarifs inter-communes pour une ville donnée."""
    permission_classes = [permissions.AllowAny]
    serializer_class   = IntraCityZoneRateSerializer

    def get_queryset(self):
        city = self.request.query_params.get('city', '')
        return IntraCityZoneRate.objects.filter(city__iexact=city, is_active=True)


class AdminIntraCityZoneRateView(APIView):
    """Admin : CRUD sur les tarifs inter-communes."""
    permission_classes = [IsAdmin]

    def get(self, request):
        city = request.query_params.get('city', '')
        qs   = IntraCityZoneRate.objects.all()
        if city:
            qs = qs.filter(city__iexact=city)
        return Response(IntraCityZoneRateSerializer(qs, many=True).data)

    def post(self, request):
        s = IntraCityZoneRateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=201)


class AdminIntraCityZoneRateDetailView(APIView):
    """Admin : modifier ou supprimer un tarif inter-commune."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        obj = get_object_or_404(IntraCityZoneRate, pk=pk)
        s   = IntraCityZoneRateSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        get_object_or_404(IntraCityZoneRate, pk=pk).delete()
        return Response(status=204)


class DeliveryFeeEstimateView(APIView):
    """
    POST /orders/delivery-fee/
    Body: { city, distance_km, weight_kg }
    Retourne le tarif calculé selon la grille de la zone.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        city           = (request.data.get('city')           or '').strip()
        from_commune   = (request.data.get('from_commune')   or '').strip()
        to_commune     = (request.data.get('to_commune')     or '').strip()
        distance_km    = request.data.get('distance_km', 0)
        weight_kg      = request.data.get('weight_kg', 0)

        if not city:
            return Response({'error': 'Le champ city est obligatoire.'}, status=400)

        # Priorité 1 : tarif inter-commune
        if from_commune and to_commune:
            try:
                rate = IntraCityZoneRate.objects.get(
                    city__iexact=city,
                    from_commune__iexact=from_commune,
                    to_commune__iexact=to_commune,
                    is_active=True,
                )
                return Response({
                    'fee_gnf':         rate.fee_gnf,
                    'base_fee_gnf':    rate.fee_gnf,
                    'distance_charge': 0,
                    'weight_charge':   0,
                    'source':          'commune',
                    'city':            city,
                    'estimated_hours': rate.estimated_hours,
                })
            except IntraCityZoneRate.DoesNotExist:
                pass

        # Priorité 2 : calcul distance + poids
        try:
            zone = DeliveryZone.objects.get(city__iexact=city, is_active=True)
        except DeliveryZone.DoesNotExist:
            return Response({'error': f'Aucune zone de livraison active pour : {city}'}, status=404)

        breakdown = zone.calculate_fee(distance_km, weight_kg)
        return Response({
            **breakdown,
            'source':         'distance',
            'city':           zone.city,
            'estimated_days': zone.estimated_days,
        })


class AdminDeliveryZoneDetailView(APIView):
    """Admin : modifier ou supprimer une zone de livraison."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        obj = get_object_or_404(DeliveryZone, pk=pk)
        serializer = DeliveryZoneSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = get_object_or_404(DeliveryZone, pk=pk)
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
        order = serializer.save(buyer=user)
        # Email vendeur — nouvelle commande reçue
        try:
            from core.email_notifications import send_new_order_seller
            send_new_order_seller(order)
        except Exception:
            pass
        # SMS vendeur + acheteur
        try:
            from core.sms import send_order_sms_seller, send_order_sms_buyer
            send_order_sms_seller(order)
            send_order_sms_buyer(order)
        except Exception:
            pass
        # Auto-assign livreur pour les livraisons à domicile
        if order.delivery_mode == Order.DeliveryMode.HOME_DELIVERY:
            try:
                _auto_assign_livreur(order)
            except Exception:
                pass


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
            try:
                from core.email_notifications import send_order_confirmed_buyer
                send_order_confirmed_buyer(order)
            except Exception:
                pass
        elif action == 'complete' and order.buyer == user:
            order.complete()
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='Commande terminée',
                body=f'La commande pour « {order.listing.title} » a été marquée comme terminée.',
                data={'order_id': str(order.id)},
            )
            try:
                from core.email_notifications import send_escrow_released
                send_escrow_released(order)
            except Exception:
                pass
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
            try:
                from core.email_notifications import send_order_cancelled
                send_order_cancelled(order, user)
            except Exception:
                pass
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
        try:
            from core.email_notifications import send_escrow_released
            send_escrow_released(order)
        except Exception:
            pass

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
        try:
            from core.email_notifications import send_dispute_opened
            send_dispute_opened(order)
        except Exception:
            pass

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

        if provider == Payment.Provider.CHACHAP:
            # ── ChaChap Pay (agrégateur) ──────────────────────────────────────
            result = initiate_chachap(amount=order.amount_gnf, order_id=str(order.id))
            if result.success and result.payment_url:
                payment.external_ref = result.reference
                payment.save(update_fields=['external_ref'])
                return Response({
                    'message':     result.message,
                    'payment':     PaymentSerializer(payment).data,
                    'payment_url': result.payment_url,
                    'chachap':     True,
                }, status=status.HTTP_201_CREATED)
            else:
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=['status'])
                return Response({'error': result.message}, status=status.HTTP_502_BAD_GATEWAY)

        elif provider == Payment.Provider.ORANGE_MONEY:
            # Paycard si configuré, sinon fallback direct Orange Money
            if getattr(settings, 'PAYCARD_API_KEY', ''):
                result = initiate_paycard(phone_number, order.amount_gnf, str(order.id), 'ORANGE_GN')
            else:
                result = initiate_orange_money(phone_number, order.amount_gnf, str(order.id))
        elif provider == Payment.Provider.MTN_MOMO:
            # Paycard si configuré, sinon fallback direct MTN MoMo
            if getattr(settings, 'PAYCARD_API_KEY', ''):
                result = initiate_paycard(phone_number, order.amount_gnf, str(order.id), 'MTN_GN')
            else:
                from .payment_service import initiate_mtn_momo
                result = initiate_mtn_momo(phone_number, order.amount_gnf, str(order.id))
        elif provider == Payment.Provider.CARD:
            # Paiement par carte Visa/Mastercard via Paycard
            result = initiate_paycard_card(
                amount=order.amount_gnf,
                order_id=str(order.id),
                customer_email=getattr(request.user, 'email', ''),
                customer_name=getattr(request.user, 'full_name', ''),
            )
            if result.success and result.payment_url:
                # Pour les cartes : commande reste PENDING jusqu'au webhook Paycard
                payment.external_ref = result.reference
                payment.save(update_fields=['external_ref'])
                return Response({
                    'message':     result.message,
                    'payment':     PaymentSerializer(payment).data,
                    'payment_url': result.payment_url,   # Frontend redirige ici
                    'card':        True,
                }, status=status.HTTP_201_CREATED)
            else:
                payment.status = Payment.Status.FAILED
                payment.save(update_fields=['status'])
                return Response({'error': result.message}, status=status.HTTP_502_BAD_GATEWAY)
        else:
            result = type('R', (), {'success': True, 'reference': '', 'message': 'Paiement en espèces enregistré'})()

        if result.success:
            payment.status       = Payment.Status.SUCCESS
            payment.external_ref = getattr(result, 'reference', '')
            payment.save(update_fields=['status', 'external_ref'])
            order.confirm()
            # Planifier la libération escrow pour paiements mobiles
            if provider in (Payment.Provider.ORANGE_MONEY, Payment.Provider.MTN_MOMO):
                order.set_escrow_schedule()
            # Email confirmation paiement (acheteur + vendeur)
            try:
                from core.email_notifications import send_payment_received
                send_payment_received(order, payment)
            except Exception:
                pass
        else:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response({'error': result.message}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({
            'message':  result.message,
            'payment':  PaymentSerializer(payment).data,
            'escrow':   order.escrow_status,
        }, status=status.HTTP_201_CREATED)


def _verify_chachap_signature(request):
    """
    Vérifie la signature HMAC des webhooks ChaChap Pay.
    ChaChap utilise DEUX clés séparées :
      - CHACHAP_API_KEY  : pour les appels API (initier un paiement)
      - CHACHAP_HMAC_KEY : pour signer les webhooks entrants
    Header: CCP-Signature (HMAC-SHA256 du body avec CHACHAP_HMAC_KEY)
    """
    # Accepte CHACHAP_HMAC_KEY ou CHACHAP_WEBHOOK_SECRET (noms Railway variés)
    hmac_key = (getattr(settings, 'CHACHAP_HMAC_KEY', '')
                or getattr(settings, 'CHACHAP_WEBHOOK_SECRET', '')
                or getattr(settings, 'CHACHAP_API_KEY', ''))
    if not hmac_key:
        logger.error(
            "[CHACHAP] CHACHAP_HMAC_KEY non configuré — webhook rejeté (fail-closed). "
            "Configurez CHACHAP_HMAC_KEY dans Railway / .env"
        )
        return False
    sig_header = request.headers.get('CCP-Signature', '')
    if not sig_header:
        logger.warning("[CHACHAP] Webhook sans header CCP-Signature")
        return False
    body     = request.body
    expected = hmac.new(hmac_key.encode(), body, hashlib.sha256).hexdigest()
    ok = hmac.compare_digest(sig_header, expected)
    if not ok:
        logger.warning("[CHACHAP] Signature invalide — reçue=%s attendue=%s", sig_header[:16], expected[:16])
    return ok


def _verify_orange_signature(request):
    """Vérifie la signature HMAC-SHA256 d'Orange Money."""
    secret = getattr(settings, 'ORANGE_WEBHOOK_SECRET', '')
    if not secret:
        logger.error(
            "[WEBHOOK ORANGE] ORANGE_WEBHOOK_SECRET non configuré — requête rejetée (faille sécurité). "
            "Configurez cette variable dans Railway."
        )
        return False  # SÉCURITÉ : rejeter si secret non configuré
    sig_header = request.headers.get('X-Orange-Signature', '')
    body        = request.body
    expected    = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_header, expected)


def _verify_paycard_signature(request):
    """
    Vérifie la signature HMAC-SHA256 des webhooks Paycard Guinée.
    Paycard signe avec : HMAC-SHA256(timestamp + '.' + body, SECRET_KEY)
    Headers attendus: X-Paycard-Timestamp, X-Paycard-Signature

    TODO : adapter les noms de headers selon la doc Paycard officielle.
    """
    secret_key = getattr(settings, 'PAYCARD_SECRET_KEY', '')
    if not secret_key:
        logger.error(
            "[PAYCARD] PAYCARD_SECRET_KEY non configuré — webhook rejeté (fail-closed). "
            "Configurez cette variable dans Railway."
        )
        return False  # SÉCURITÉ : rejeter si clé non configurée

    timestamp  = request.headers.get('X-Paycard-Timestamp', '')
    sig_header = request.headers.get('X-Paycard-Signature', '')

    if not timestamp or not sig_header:
        logger.warning("[PAYCARD] Webhook sans headers de signature — potentielle attaque")
        return False

    # Vérifier que le timestamp n'est pas trop vieux (protection replay attack)
    try:
        import time
        ts = int(timestamp)
        if abs(time.time() - ts) > 300:  # 5 minutes max
            logger.warning("[PAYCARD] Webhook trop ancien (replay attack?) ts=%s", timestamp)
            return False
    except (ValueError, TypeError):
        return False

    body = request.body
    message = f"{timestamp}.{body.decode('utf-8', errors='replace')}".encode()
    expected = hmac.new(secret_key.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_header, expected)


@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, provider):
        # IMPORTANT: lire request.body AVANT request.data
        # DRF peut consommer le stream HTTP ce qui rend request.body inaccessible
        # ensuite (RawPostDataException). Le lire ici force Django à le cacher dans _body.
        try:
            _ = request.body  # noqa — force le cache Django
        except Exception:
            pass
        data = request.data

        if provider == 'chachap':
            if not _verify_chachap_signature(request):
                logger.warning("[CHACHAP] Webhook rejeté — signature invalide")
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
            operation_id = data.get('operation_id', data.get('order_id', ''))
            success      = data.get('status', '').lower() == 'success'
            ref          = operation_id
            logger.info("[CHACHAP] Webhook reçu — operation_id=%s status=%s method=%s",
                        operation_id, data.get('status'), data.get('payment_method', ''))

        elif provider == 'orange':
            if not _verify_orange_signature(request):
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
            ref     = data.get('pay_token', '')
            success = data.get('status', '') == 'SUCCESS'
        elif provider in ('paycard', 'paycard_payment', 'paycard_card'):
            # Webhook Paycard — paiement Mobile Money OU carte Visa
            # TODO : vérifier les champs exacts dans la doc Paycard
            if not _verify_paycard_signature(request):
                logger.warning("[PAYCARD] Webhook rejeté — signature invalide")
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
            ref     = data.get('transaction_id', data.get('reference', ''))
            success = data.get('status', '').upper() in ('SUCCESS', 'COMPLETED', 'PAID')
            is_card = provider == 'paycard_card' or data.get('payment_method') == 'card'
            logger.info("[PAYCARD%s] Webhook reçu — ref=%s status=%s",
                        ' CARD' if is_card else '', ref, data.get('status', ''))
        elif provider == 'paycard_refund':
            # Webhook Paycard — remboursement
            if not _verify_paycard_signature(request):
                logger.warning("[PAYCARD] Webhook refund rejeté — signature invalide")
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)
            ref     = data.get('transaction_id', data.get('refund_id', ''))
            success = data.get('status', '').upper() in ('SUCCESS', 'COMPLETED')
            try:
                payment = Payment.objects.filter(external_ref=ref).first()
                if payment and success:
                    payment.order.escrow_status = Order.EscrowStatus.REFUNDED
                    payment.order.save(update_fields=['escrow_status', 'updated_at'])
                    logger.info("[PAYCARD REFUND] Commande %s remboursée.", payment.order.id)
            except Exception as exc:
                logger.error("[PAYCARD REFUND] Erreur: %s", exc)
            return Response({'status': 'ok'})
        else:
            return Response({'error': 'Fournisseur inconnu'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.filter(external_ref=ref).first() if ref else None
            if not payment and ref:
                payment = Payment.objects.filter(order__id=ref, status=Payment.Status.PENDING).first()
            if payment:
                # Idempotence : ne pas re-traiter si déjà SUCCESS (webhook retry)
                if payment.status == Payment.Status.SUCCESS and success:
                    logger.info("[WEBHOOK] %s — paiement %s déjà confirmé (idempotent)", provider, ref)
                    return Response({'status': 'ok'})
                payment.status = Payment.Status.SUCCESS if success else Payment.Status.FAILED
                payment.save(update_fields=['status'])
                if success and payment.order.status == Order.Status.PENDING:
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

        # Email litige résolu — acheteur + vendeur
        try:
            from core.email_notifications import send_dispute_resolved
            winner = 'seller' if action == 'release' else 'buyer'
            send_dispute_resolved(order, winner)
        except Exception:
            pass

        return Response(OrderSerializer(order).data)


class AdminStatsView(APIView):
    """Admin : statistiques globales de la plateforme."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.accounts.models import User
        from apps.listings.models import Listing
        from django.db.models import Sum
        from django.utils import timezone

        today = timezone.now().date()

        return Response({
            'users':                User.objects.count(),
            'users_sellers':        User.objects.filter(role='seller').count(),
            'users_livreurs':       User.objects.filter(role='livreur').count(),
            'livreurs_available':   User.objects.filter(role='livreur', is_available=True, is_active=True).count(),
            'active_listings':      Listing.objects.filter(status='active').count(),
            'orders_total':         Order.objects.count(),
            'orders_disputed':      Order.objects.filter(status=Order.Status.DISPUTED).count(),
            'orders_completed':     Order.objects.filter(status=Order.Status.COMPLETED).count(),
            'orders_today':         Order.objects.filter(created_at__date=today).count(),
            'deliveries_total':     DeliveryAssignment.objects.count(),
            'deliveries_en_route':  DeliveryAssignment.objects.filter(status='en_route').count(),
            'deliveries_assigned':  DeliveryAssignment.objects.filter(status='assigned').count(),
            'deliveries_today':     DeliveryAssignment.objects.filter(delivered_at__date=today).count(),
            'revenue_gnf':          Payment.objects.filter(
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
            # Pre-fetch existing listings to avoid INNER JOIN filtering out
            # orders whose listing was deleted (orphaned FK)
            from apps.listings.models import Listing
            listing_ids = Order.objects.values_list('listing_id', flat=True)
            listings_map = {
                str(l.id): l.title
                for l in Listing.objects.filter(id__in=listing_ids)
            }
            for o in Order.objects.select_related('buyer', 'seller').order_by('-created_at'):
                listing_title = listings_map.get(str(o.listing_id), 'Annonce supprimée')
                writer.writerow([
                    str(o.id), listing_title,
                    o.buyer.full_name, o.seller.full_name,
                    o.amount_gnf, o.status, o.delivery_mode,
                    o.created_at.strftime('%d/%m/%Y %H:%M'),
                ])

        return response


# ── Livreur ────────────────────────────────────────────────────────────────────

def _auto_assign_livreur(order):
    """
    Algorithme d'affectation intelligent — Option B + filtre jour même.

    Priorités (dans l'ordre) :
      1. Même ville que l'acheteur (si possible)
      2. Parmi ceux en service aujourd'hui (≥1 livraison ce jour) → le moins chargé
      3. Sinon (première commande de la journée) → le moins chargé parmi tous
      4. En cas d'égalité → le premier par ordre alphabétique (stable, pas aléatoire)

    "Chargé" = nombre de livraisons ASSIGNED ou EN_ROUTE en ce moment.
    """
    from django.utils import timezone
    from django.db.models import Count, Q
    from apps.accounts.models import User as AppUser
    from apps.notifications.models import Notification

    today = timezone.now().date()

    # Base : livreurs actifs ET disponibles, annotés avec leur charge
    livreurs = AppUser.objects.filter(
        role='livreur', is_active=True, is_available=True,
    ).annotate(
        # Livraisons en cours (charge immédiate)
        active_count=Count(
            'delivery_assignments',
            filter=Q(delivery_assignments__status__in=['assigned', 'en_route'])
        ),
        # Livraisons assignées aujourd'hui (indique qu'il est en service ce jour)
        today_count=Count(
            'delivery_assignments',
            filter=Q(delivery_assignments__assigned_at__date=today)
        ),
    )

    if not livreurs.exists():
        return  # Aucun livreur dans le système

    # Filtre ville (priorité géographique)
    buyer_city = getattr(order.buyer, 'city', '') or ''
    if buyer_city:
        city_match = livreurs.filter(city__iexact=buyer_city)
        if city_match.exists():
            livreurs = city_match

    # Priorité 1 : livreurs déjà en service aujourd'hui, triés par charge croissante
    working_today = livreurs.filter(today_count__gt=0).order_by('active_count', 'full_name')
    if working_today.exists():
        livreur = working_today.first()
    else:
        # Priorité 2 : première commande de la journée → le moins chargé parmi tous
        livreur = livreurs.order_by('active_count', 'full_name').first()

    if not livreur:
        return

    # 3. Créer l'affectation (évite les doublons)
    assignment, created = DeliveryAssignment.objects.get_or_create(
        order=order,
        defaults={'livreur': livreur},
    )
    if not created:
        return  # Déjà assignée

    # 4. Notifier le livreur
    Notification.send(
        user=livreur,
        type=Notification.Type.ORDER_UPDATE,
        title='📦 Nouvelle livraison assignée',
        body=(
            f'Article : « {order.listing.title} »\n'
            f'Adresse : {order.delivery_address}\n'
            f'Code retrait (montrez au vendeur) : {assignment.pickup_code}\n'
            f'Code livraison (acheteur vous le donne) : {assignment.verification_code}'
        ),
        data={'assignment_id': str(assignment.id)},
    )
    try:
        from core.sms import send_sms
        send_sms(
            str(livreur.phone_number),
            f'[Guimatrix] Nouvelle livraison !\n'
            f'Article : {order.listing.title}\n'
            f'Adresse : {order.delivery_address}\n'
            f'Acheteur : {order.buyer.full_name} - {order.buyer.phone_number}\n'
            f'Code retrait vendeur : {assignment.pickup_code}\n'
            f'Code confirm. acheteur : {assignment.verification_code}',
        )
    except Exception:
        pass

    # 5. Notifier le vendeur avec pickup_code
    Notification.send(
        user=order.seller,
        type=Notification.Type.ORDER_UPDATE,
        title='🚗 Un livreur va récupérer votre colis',
        body=(
            f'Article : « {order.listing.title} »\n'
            f'Code de retrait : {assignment.pickup_code}\n'
            f'Le livreur vous montrera ce code — vérifiez-le avant de remettre le colis.'
        ),
        data={'order_id': str(order.id), 'pickup_code': assignment.pickup_code},
    )
    try:
        from core.sms import send_sms
        send_sms(
            str(order.seller.phone_number),
            f'[Guimatrix] Un livreur va récupérer « {order.listing.title} ».\n'
            f'Code de retrait : {assignment.pickup_code}\n'
            f'Vérifiez ce code avant de remettre le colis au livreur.',
        )
    except Exception:
        pass

    # 6. Notifier l'acheteur avec verification_code
    Notification.send(
        user=order.buyer,
        type=Notification.Type.ORDER_UPDATE,
        title='🚗 Un livreur va vous livrer',
        body=(
            f'Votre code de vérification : {assignment.verification_code}\n'
            f'Donnez ce code au livreur UNIQUEMENT après réception de votre colis.'
        ),
        data={'order_id': str(order.id), 'verification_code': assignment.verification_code},
    )
    try:
        from core.sms import send_sms
        send_sms(
            str(order.buyer.phone_number),
            f'[Guimatrix] Un livreur va livrer « {order.listing.title} ».\n'
            f'Votre code de vérification : {assignment.verification_code}\n'
            f'Donnez ce code au livreur UNIQUEMENT à la réception de votre colis.',
        )
    except Exception:
        pass


class IsLivreur(permissions.BasePermission):
    """Accès réservé aux utilisateurs avec le rôle livreur."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'livreur'


class LivreurOrderListView(generics.ListAPIView):
    """Livreur : liste ses livraisons assignées."""
    permission_classes   = [IsLivreur]
    serializer_class     = DeliveryAssignmentSerializer
    pagination_class     = None   # Pas de pagination — tableau direct

    def get_queryset(self):
        # Inclut DELIVERED pour permettre la notation après livraison
        return DeliveryAssignment.objects.filter(
            livreur=self.request.user
        ).select_related('order', 'order__listing', 'order__buyer', 'order__seller', 'livreur')


class LivreurStartDeliveryView(APIView):
    """Livreur : marquer une livraison 'en route'."""
    permission_classes = [IsLivreur]

    def post(self, request, pk):
        assignment = get_object_or_404(DeliveryAssignment, pk=pk, livreur=request.user)
        if assignment.status != DeliveryAssignment.Status.ASSIGNED:
            return Response({'error': 'Cette livraison ne peut pas être mise en route.'}, status=400)
        assignment.status = DeliveryAssignment.Status.EN_ROUTE
        assignment.save(update_fields=['status', 'updated_at'])
        # Notifier l'acheteur
        from apps.notifications.models import Notification
        Notification.send(
            user=assignment.order.buyer,
            type=Notification.Type.ORDER_UPDATE,
            title='🚗 Votre colis est en route !',
            body=f'Le livreur est en chemin pour « {assignment.order.listing.title} ». '
                 f'Préparez votre code de vérification.',
            data={'order_id': str(assignment.order.id)},
        )
        return Response(DeliveryAssignmentSerializer(assignment).data)


class LivreurConfirmDeliveryView(APIView):
    """Livreur : confirme la livraison via le code de vérification fourni par l'acheteur."""
    permission_classes = [IsLivreur]

    def post(self, request, pk):
        from django.utils import timezone
        assignment = get_object_or_404(DeliveryAssignment, pk=pk, livreur=request.user)

        if assignment.status == DeliveryAssignment.Status.DELIVERED:
            return Response({'error': 'Cette livraison a déjà été confirmée.'}, status=400)

        # Machine d'état : la livraison doit être EN_ROUTE avant d'être confirmée
        if assignment.status != DeliveryAssignment.Status.EN_ROUTE:
            return Response(
                {'error': 'Vous devez d\'abord démarrer la livraison avant de la confirmer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = str(request.data.get('verification_code', '')).strip()
        if code != assignment.verification_code:
            return Response({'error': 'Code de vérification incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        assignment.status       = DeliveryAssignment.Status.DELIVERED
        assignment.delivered_at = timezone.now()
        assignment.save(update_fields=['status', 'delivered_at', 'updated_at'])

        # Compléter la commande + libérer l'escrow
        order = assignment.order
        order.complete()
        if order.escrow_status == Order.EscrowStatus.HELD:
            order.release_escrow()

        # Créer automatiquement le paiement livreur
        try:
            from .models import LivreurPayment
            LivreurPayment.create_for_assignment(assignment)
        except Exception:
            pass

        from apps.notifications.models import Notification
        Notification.send(
            user=order.buyer,
            type=Notification.Type.ORDER_UPDATE,
            title='✅ Livraison confirmée',
            body=f'Votre commande « {order.listing.title} » a été livrée avec succès.',
            data={'order_id': str(order.id)},
        )
        Notification.send(
            user=order.seller,
            type=Notification.Type.ORDER_UPDATE,
            title='💰 Commande livrée — paiement libéré',
            body=f'La livraison pour « {order.listing.title} » a été confirmée.',
            data={'order_id': str(order.id)},
        )

        return Response(DeliveryAssignmentSerializer(assignment).data)


class AdminAssignLivreurView(APIView):
    """Admin : affecter un livreur à une commande home_delivery."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from apps.accounts.models import User as AppUser
        order      = get_object_or_404(Order, pk=pk, delivery_mode=Order.DeliveryMode.HOME_DELIVERY)
        livreur_id = request.data.get('livreur_id')

        if not livreur_id:
            return Response({'error': 'livreur_id requis.'}, status=400)

        livreur = get_object_or_404(AppUser, pk=livreur_id, role='livreur')

        # Créer ou mettre à jour l'affectation
        assignment, created = DeliveryAssignment.objects.update_or_create(
            order=order,
            defaults={'livreur': livreur, 'status': DeliveryAssignment.Status.ASSIGNED},
        )

        from apps.notifications.models import Notification

        # Notifier le livreur
        Notification.send(
            user=livreur,
            type=Notification.Type.ORDER_UPDATE,
            title='📦 Nouvelle livraison assignée',
            body=(
                f'Article : « {order.listing.title} » → {order.delivery_address}\n'
                f'Code retrait (montrez au vendeur) : {assignment.pickup_code}\n'
                f'Code confirm. (acheteur vous le donne) : {assignment.verification_code}'
            ),
            data={'assignment_id': str(assignment.id)},
        )
        try:
            from core.sms import send_sms
            send_sms(
                str(livreur.phone_number),
                f'[Guimatrix] Nouvelle livraison !\n'
                f'Article : {order.listing.title}\n'
                f'Adresse : {order.delivery_address}\n'
                f'Acheteur : {order.buyer.full_name} - {order.buyer.phone_number}\n'
                f'Code retrait vendeur : {assignment.pickup_code}\n'
                f'Code confirm. acheteur : {assignment.verification_code}',
            )
        except Exception:
            pass

        # Notifier le vendeur avec pickup_code
        Notification.send(
            user=order.seller,
            type=Notification.Type.ORDER_UPDATE,
            title='🚗 Un livreur va récupérer votre colis',
            body=(
                f'Article : « {order.listing.title} »\n'
                f'Code de retrait : {assignment.pickup_code}\n'
                f'Vérifiez ce code avant de remettre le colis au livreur.'
            ),
            data={'order_id': str(order.id), 'pickup_code': assignment.pickup_code},
        )
        try:
            from core.sms import send_sms
            send_sms(
                str(order.seller.phone_number),
                f'[Guimatrix] Un livreur va récupérer « {order.listing.title} ».\n'
                f'Code de retrait : {assignment.pickup_code}\n'
                f'Vérifiez ce code avant de remettre le colis.',
            )
        except Exception:
            pass

        # Notifier l'acheteur avec verification_code
        Notification.send(
            user=order.buyer,
            type=Notification.Type.ORDER_UPDATE,
            title='🚗 Un livreur va vous livrer',
            body=(
                f'Votre code de vérification : {assignment.verification_code}\n'
                f'Donnez-le au livreur UNIQUEMENT à la réception de votre colis.'
            ),
            data={'order_id': str(order.id), 'verification_code': assignment.verification_code},
        )
        try:
            from core.sms import send_sms
            send_sms(
                str(order.buyer.phone_number),
                f'[Guimatrix] Un livreur va livrer « {order.listing.title} ».\n'
                f'Votre code de vérification : {assignment.verification_code}\n'
                f'Donnez ce code au livreur UNIQUEMENT à la réception.',
            )
        except Exception:
            pass

        return Response(DeliveryAssignmentSerializer(assignment).data, status=201 if created else 200)


class AdminLivreurListView(generics.ListAPIView):
    """Admin : liste tous les livreurs avec disponibilité."""
    permission_classes = [IsAdmin]
    serializer_class   = DeliveryAssignmentSerializer  # dummy — on va override

    def list(self, request):
        from apps.accounts.models import User as AppUser
        livreurs = AppUser.objects.filter(role='livreur').values(
            'id', 'full_name', 'phone_number', 'city', 'is_active', 'is_available',
        )
        return Response(list(livreurs))


class AdminDeliveryAssignmentListView(generics.ListAPIView):
    """Admin : liste toutes les affectations livreurs."""
    permission_classes = [IsAdmin]
    serializer_class   = DeliveryAssignmentSerializer
    pagination_class   = None   # Pas de pagination — tableau direct

    def get_queryset(self):
        qs = DeliveryAssignment.objects.select_related(
            'order', 'order__listing', 'order__buyer', 'livreur'
        ).order_by('-assigned_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminDeliveryReassignView(APIView):
    """Admin : réassigner un livreur à une affectation de livraison."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            assignment = DeliveryAssignment.objects.select_related('livreur').get(pk=pk)
        except DeliveryAssignment.DoesNotExist:
            return Response({'error': 'Affectation introuvable'}, status=404)

        if assignment.status == 'delivered':
            return Response({'error': 'Impossible de réassigner une livraison déjà effectuée'}, status=400)

        livreur_id = request.data.get('livreur_id')
        if not livreur_id:
            return Response({'error': 'livreur_id requis'}, status=400)

        from apps.accounts.models import User as AppUser
        try:
            livreur = AppUser.objects.get(id=livreur_id, role='livreur', is_active=True)
        except AppUser.DoesNotExist:
            return Response({'error': 'Livreur introuvable ou inactif'}, status=404)

        old_name = assignment.livreur.full_name
        assignment.livreur = livreur
        assignment.save(update_fields=['livreur'])
        return Response({'message': f'Livreur réassigné : {old_name} → {livreur.full_name}'})


class AdminOrderListView(APIView):
    """Admin : liste toutes les commandes avec filtres."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Q
        qs = Order.objects.select_related('listing', 'buyer', 'seller').order_by('-created_at')

        status_filter = request.query_params.get('status')
        mode_filter   = request.query_params.get('mode')
        search        = request.query_params.get('search')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if mode_filter:
            qs = qs.filter(delivery_mode=mode_filter)
        if search:
            qs = qs.filter(
                Q(listing__title__icontains=search) |
                Q(buyer__full_name__icontains=search) |
                Q(seller__full_name__icontains=search)
            )

        data = [{
            'id':               str(o.id),
            'listing_title':    o.listing.title if o.listing else '—',
            'buyer_name':       o.buyer.full_name,
            'buyer_phone':      str(o.buyer.phone_number or ''),
            'seller_name':      o.seller.full_name,
            'seller_phone':     str(o.seller.phone_number or ''),
            'amount_gnf':       o.amount_gnf,
            'status':           o.status,
            'delivery_mode':    o.delivery_mode,
            'delivery_address': o.delivery_address or '',
            'created_at':       o.created_at.isoformat(),
        } for o in qs[:300]]

        return Response(data)


# ── Retours ────────────────────────────────────────────────────────────────────

class CreateReturnView(APIView):
    """
    POST /orders/<pk>/return/
    L'acheteur dépose une demande de retour sur une commande terminée.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status != Order.Status.COMPLETED:
            return Response({'error': "Seules les commandes terminées peuvent faire l'objet d'un retour."}, status=400)

        if hasattr(order, 'return_request'):
            return Response({'error': 'Une demande de retour existe déjà pour cette commande.'}, status=400)

        reason      = request.data.get('reason', '').strip()
        description = request.data.get('description', '').strip()

        valid_reasons = [r[0] for r in ReturnRequest.Reason.choices]
        if reason not in valid_reasons:
            return Response({'error': f"Raison invalide. Choisir parmi : {', '.join(valid_reasons)}"}, status=400)

        rr = ReturnRequest.objects.create(order=order, reason=reason, description=description)

        # Notifier le vendeur
        try:
            from apps.notifications.models import Notification
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='↩️ Demande de retour',
                body=f'L\'acheteur demande un retour pour « {order.listing.title} ».',
                data={'order_id': str(order.id)},
            )
        except Exception:
            pass

        return Response({
            'id':          str(rr.id),
            'status':      rr.status,
            'reason':      rr.reason,
            'description': rr.description,
            'created_at':  rr.created_at.isoformat(),
        }, status=201)


class AdminReturnListView(APIView):
    """Admin : liste toutes les demandes de retour."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Q
        qs = ReturnRequest.objects.select_related(
            'order', 'order__listing', 'order__buyer', 'order__seller'
        ).order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(order__listing__title__icontains=search) |
                Q(order__buyer__full_name__icontains=search)
            )

        data = [{
            'id':             str(r.id),
            'order_id':       str(r.order.id),
            'listing_title':  r.order.listing.title if r.order.listing else '—',
            'buyer_name':     r.order.buyer.full_name,
            'buyer_phone':    str(r.order.buyer.phone_number or ''),
            'seller_name':    r.order.seller.full_name,
            'amount_gnf':     r.order.amount_gnf,
            'reason':         r.reason,
            'description':    r.description,
            'status':         r.status,
            'admin_note':     r.admin_note,
            'created_at':     r.created_at.isoformat(),
            'resolved_at':    r.resolved_at.isoformat() if r.resolved_at else None,
        } for r in qs[:300]]

        return Response(data)


class AdminReturnUpdateView(APIView):
    """Admin : approuver, refuser ou marquer comme complété un retour."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        from django.utils import timezone
        rr         = get_object_or_404(ReturnRequest, pk=pk)
        new_status = request.data.get('status', '').strip()
        admin_note = request.data.get('admin_note', '').strip()

        valid = [s[0] for s in ReturnRequest.Status.choices]
        if new_status not in valid:
            return Response({'error': f"Statut invalide. Choisir parmi : {', '.join(valid)}"}, status=400)

        rr.status = new_status
        if admin_note:
            rr.admin_note = admin_note
        if new_status in ('approved', 'rejected', 'completed'):
            rr.resolved_at = timezone.now()
        rr.save(update_fields=['status', 'admin_note', 'resolved_at', 'updated_at'])

        # Notifier l'acheteur
        try:
            from apps.notifications.models import Notification
            labels = {'approved': 'Retour approuvé ✅', 'rejected': 'Retour refusé ❌', 'completed': 'Retour effectué 📦'}
            Notification.send(
                user=rr.order.buyer,
                type=Notification.Type.ORDER_UPDATE,
                title=labels.get(new_status, 'Mise à jour retour'),
                body=admin_note or f'Votre demande de retour pour « {rr.order.listing.title} » a été mise à jour.',
                data={'order_id': str(rr.order.id)},
            )
        except Exception:
            pass

        return Response({
            'id':          str(rr.id),
            'status':      rr.status,
            'admin_note':  rr.admin_note,
            'resolved_at': rr.resolved_at.isoformat() if rr.resolved_at else None,
        })


# ── COMPTABILITÉ ──────────────────────────────────────────────────────────────

class AdminAccountingSummaryView(APIView):
    """
    Résumé financier de la plateforme.
    Accessible : admin, super_admin, admin_accounting
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Sum, Count
        from django.utils import timezone
        from datetime import timedelta
        from core.permissions import IsAdminAccounting

        # Vérifier permission comptabilité
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé à l\'admin comptable.'}, status=403)

        now   = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        year_start  = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

        orders_qs = Order.objects.filter(status=Order.Status.COMPLETED)

        def agg(qs):
            return qs.aggregate(
                total_revenue   = Sum('amount_gnf'),
                total_commission= Sum('commission_gnf'),
                total_payout    = Sum('seller_payout_gnf'),
                total_delivery  = Sum('delivery_fee_gnf'),
                count           = Count('id'),
            )

        month = agg(orders_qs.filter(updated_at__gte=month_start))
        year  = agg(orders_qs.filter(updated_at__gte=year_start))
        total = agg(orders_qs)

        # Gains livreurs non payés
        pending_livreur = LivreurPayment.objects.filter(status='pending').aggregate(
            total=Sum('net_gnf'), count=Count('id')
        )

        # Frais livraison plateforme (non reversés aux livreurs)
        platform_delivery = LivreurPayment.objects.filter(status='pending').aggregate(
            total=Sum('platform_cut_gnf')
        )

        return Response({
            'month': {
                'revenue':    month['total_revenue']    or 0,
                'commission': month['total_commission'] or 0,
                'delivery':   month['total_delivery']   or 0,
                'orders':     month['count']            or 0,
            },
            'year': {
                'revenue':    year['total_revenue']    or 0,
                'commission': year['total_commission'] or 0,
                'delivery':   year['total_delivery']   or 0,
                'orders':     year['count']            or 0,
            },
            'all_time': {
                'revenue':    total['total_revenue']    or 0,
                'commission': total['total_commission'] or 0,
                'delivery':   total['total_delivery']   or 0,
                'orders':     total['count']            or 0,
            },
            'livreurs_pending': {
                'amount': pending_livreur['total'] or 0,
                'count':  pending_livreur['count'] or 0,
            },
            'platform_delivery_cut': platform_delivery['total'] or 0,
        })


class AdminLivreurEarningsView(APIView):
    """
    Liste des gains par livreur — avec solde en attente.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Sum, Count, Q
        from apps.accounts.models import User as AppUser

        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé à l\'admin comptable.'}, status=403)

        livreurs = AppUser.objects.filter(role='livreur').prefetch_related('livreur_payments')
        result = []
        for lv in livreurs:
            payments = lv.livreur_payments.all()
            agg = payments.aggregate(
                total_gross   = Sum('gross_gnf'),
                total_net     = Sum('net_gnf'),
                total_pending = Sum('net_gnf', filter=Q(status='pending')),
                total_paid    = Sum('net_gnf', filter=Q(status='paid')),
                deliveries    = Count('id'),
            )
            result.append({
                'id':             str(lv.id),
                'full_name':      lv.full_name,
                'phone_number':   str(lv.phone_number or ''),
                'deliveries':     agg['deliveries']    or 0,
                'total_gross':    agg['total_gross']   or 0,
                'total_net':      agg['total_net']     or 0,
                'pending_amount': agg['total_pending'] or 0,
                'paid_amount':    agg['total_paid']    or 0,
            })

        result.sort(key=lambda x: x['pending_amount'], reverse=True)
        return Response(result)


class AdminLivreurPaymentListView(APIView):
    """
    Détail des paiements d'un livreur (par livreur_id).
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé à l\'admin comptable.'}, status=403)

        livreur_id = request.query_params.get('livreur_id')
        status_f   = request.query_params.get('status')
        qs = LivreurPayment.objects.select_related('livreur', 'assignment__order__listing')
        if livreur_id:
            qs = qs.filter(livreur_id=livreur_id)
        if status_f:
            qs = qs.filter(status=status_f)

        data = [{
            'id':           str(p.id),
            'livreur_id':   str(p.livreur.id),
            'livreur_name': p.livreur.full_name,
            'order_id':     str(p.assignment.order.id),
            'listing_title':p.assignment.order.listing.title,
            'gross_gnf':    p.gross_gnf,
            'platform_cut': p.platform_cut_gnf,
            'net_gnf':      p.net_gnf,
            'status':       p.status,
            'paid_at':      p.paid_at.isoformat() if p.paid_at else None,
            'payment_ref':  p.payment_ref,
            'created_at':   p.created_at.isoformat(),
        } for p in qs[:200]]
        return Response(data)


class AdminMarkLivreurPaidView(APIView):
    """
    Marquer un ou plusieurs paiements livreur comme payés.
    Body: { payment_ids: [...], payment_ref: "OM-XXXXX", note: "..." }
    Ou:   { livreur_id: "uuid" }  → marque tous les pending de ce livreur
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        from django.utils import timezone

        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé à l\'admin comptable.'}, status=403)

        payment_ids = request.data.get('payment_ids', [])
        livreur_id  = request.data.get('livreur_id', '')
        payment_ref = request.data.get('payment_ref', '').strip()
        note        = request.data.get('note', '').strip()
        now         = timezone.now()

        qs = LivreurPayment.objects.filter(status='pending')
        if payment_ids:
            qs = qs.filter(id__in=payment_ids)
        elif livreur_id:
            qs = qs.filter(livreur_id=livreur_id)
        else:
            return Response({'error': 'Fournissez payment_ids ou livreur_id.'}, status=400)

        count = qs.update(status='paid', paid_at=now, payment_ref=payment_ref, note=note)
        return Response({'paid': count, 'payment_ref': payment_ref})


class AdminAccountingExportView(APIView):
    """Export CSV comptabilité (commissions + paiements livreurs)."""
    permission_classes = [IsAdmin]

    def get(self, request):
        import csv
        from django.http import HttpResponse
        from django.utils import timezone

        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé à l\'admin comptable.'}, status=403)

        export_type = request.query_params.get('type', 'commissions')
        response    = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{export_type}_{timezone.now().date()}.csv"'
        writer = csv.writer(response)

        if export_type == 'livreurs':
            writer.writerow(['Livreur', 'Téléphone', 'Date', 'Commande', 'Brut GNF', 'Part plateforme GNF', 'Net livreur GNF', 'Statut', 'Référence paiement'])
            for p in LivreurPayment.objects.select_related('livreur', 'assignment__order').order_by('-created_at'):
                writer.writerow([
                    p.livreur.full_name,
                    str(p.livreur.phone_number or ''),
                    p.created_at.strftime('%Y-%m-%d'),
                    str(p.assignment.order.id)[:8],
                    p.gross_gnf,
                    p.platform_cut_gnf,
                    p.net_gnf,
                    p.get_status_display(),
                    p.payment_ref,
                ])
        else:  # commissions
            writer.writerow(['Date', 'Commande', 'Vendeur', 'Acheteur', 'Montant GNF', 'Commission GNF', 'Payout vendeur GNF', 'Frais livraison GNF'])
            for o in Order.objects.filter(status=Order.Status.COMPLETED).select_related('seller', 'buyer', 'listing').order_by('-updated_at'):
                writer.writerow([
                    o.updated_at.strftime('%Y-%m-%d'),
                    str(o.id)[:8],
                    o.seller.full_name,
                    o.buyer.full_name,
                    o.amount_gnf,
                    o.commission_gnf,
                    o.seller_payout_gnf,
                    o.delivery_fee_gnf,
                ])

        return response


# ── Amendes & virements hebdomadaires livreurs ────────────────────────────────

class AdminLivreurFineListView(APIView):
    """GET /orders/admin/accounting/fines/ — liste toutes les amendes."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import LivreurFine
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        qs = LivreurFine.objects.select_related('livreur', 'order').order_by('-created_at')
        livreur_id = request.query_params.get('livreur_id')
        status_f   = request.query_params.get('status')
        if livreur_id: qs = qs.filter(livreur_id=livreur_id)
        if status_f:   qs = qs.filter(status=status_f)

        data = [{
            'id':          str(f.id),
            'livreur_id':  str(f.livreur.id),
            'livreur':     f.livreur.full_name,
            'amount_gnf':  f.amount_gnf,
            'reason':      f.reason,
            'description': f.description,
            'status':      f.status,
            'order_id':    str(f.order.id) if f.order else None,
            'created_at':  f.created_at.isoformat(),
            'deducted_at': f.deducted_at.isoformat() if f.deducted_at else None,
        } for f in qs[:200]]
        return Response(data)


class AdminCreateLivreurFineView(APIView):
    """POST /orders/admin/accounting/fines/create/ — infliger une amende."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .models import LivreurFine
        from django.contrib.auth import get_user_model
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        User        = get_user_model()
        livreur_id  = request.data.get('livreur_id', '')
        amount_gnf  = request.data.get('amount_gnf', 0)
        reason      = request.data.get('reason', LivreurFine.Reason.OTHER)
        description = request.data.get('description', '')
        order_id    = request.data.get('order_id')

        if not livreur_id or not amount_gnf:
            return Response({'error': 'livreur_id et amount_gnf requis.'}, status=400)

        livreur = get_object_or_404(User, pk=livreur_id, role='livreur')
        fine = LivreurFine.objects.create(
            livreur=livreur,
            amount_gnf=int(amount_gnf),
            reason=reason,
            description=description,
            order_id=order_id or None,
        )
        return Response({
            'id':         str(fine.id),
            'livreur':    livreur.full_name,
            'amount_gnf': fine.amount_gnf,
            'reason':     fine.reason,
            'status':     fine.status,
        }, status=201)


class AdminUpdateLivreurFineView(APIView):
    """PATCH /orders/admin/accounting/fines/<pk>/ — annuler ou marquer déduite."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        from .models import LivreurFine
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        fine   = get_object_or_404(LivreurFine, pk=pk)
        status = request.data.get('status', '').strip()
        if status not in ['pending', 'deducted', 'waived']:
            return Response({'error': 'Statut invalide.'}, status=400)
        fine.status = status
        if status == 'deducted':
            from django.utils import timezone as tz
            fine.deducted_at = tz.now()
        fine.admin_note = request.data.get('admin_note', fine.admin_note)
        fine.save()
        return Response({'id': str(fine.id), 'status': fine.status})


class AdminWeeklyPayoutsView(APIView):
    """GET /orders/admin/accounting/weekly-payouts/ — virements hebdomadaires."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import LivreurWeeklyPayout
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        qs = LivreurWeeklyPayout.objects.select_related('livreur').order_by('-week_start')
        status_f   = request.query_params.get('status')
        livreur_id = request.query_params.get('livreur_id')
        if status_f:   qs = qs.filter(status=status_f)
        if livreur_id: qs = qs.filter(livreur_id=livreur_id)

        data = [{
            'id':               str(p.id),
            'livreur_id':       str(p.livreur.id),
            'livreur':          p.livreur.full_name,
            'livreur_phone':    str(p.livreur.phone_number or ''),
            'week_start':       str(p.week_start),
            'week_end':         str(p.week_end),
            'deliveries_count': p.deliveries_count,
            'gross_gnf':        p.gross_gnf,
            'fines_gnf':        p.fines_gnf,
            'net_gnf':          p.net_gnf,
            'status':           p.status,
            'paid_at':          p.paid_at.isoformat() if p.paid_at else None,
            'payment_ref':      p.payment_ref,
            'payment_method':   p.payment_method,
        } for p in qs[:200]]
        return Response(data)


class AdminMarkWeeklyPayoutPaidView(APIView):
    """POST /orders/admin/accounting/weekly-payouts/mark-paid/ — marquer payé."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .models import LivreurWeeklyPayout
        from django.utils import timezone
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        payout_ids     = request.data.get('payout_ids', [])
        payment_ref    = request.data.get('payment_ref', '').strip()
        payment_method = request.data.get('payment_method', '').strip()
        note           = request.data.get('note', '').strip()

        if not payout_ids:
            return Response({'error': 'payout_ids requis.'}, status=400)

        qs    = LivreurWeeklyPayout.objects.filter(id__in=payout_ids, status='pending')
        count = qs.update(
            status='paid', paid_at=timezone.now(),
            payment_ref=payment_ref,
            payment_method=payment_method,
            note=note,
        )
        return Response({'paid': count, 'payment_ref': payment_ref})


class AdminGenerateWeeklyPayoutsView(APIView):
    """POST /orders/admin/accounting/weekly-payouts/generate/ — générer manuellement."""
    permission_classes = [IsAdmin]

    def post(self, request):
        from .models import LivreurWeeklyPayout
        from datetime import date, timedelta
        if not (request.user.is_super_admin or request.user.can_manage_accounting):
            return Response({'error': 'Accès réservé.'}, status=403)

        week_start_str = request.data.get('week_start')
        if week_start_str:
            week_start = date.fromisoformat(week_start_str)
        else:
            today      = date.today()
            week_start = today - timedelta(days=today.weekday())

        count = LivreurWeeklyPayout.generate_for_week(week_start)
        return Response({'generated': count, 'week_start': str(week_start)})
