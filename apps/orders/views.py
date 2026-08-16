from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
import hashlib
import hmac
import logging


class WebhookRateThrottle(AnonRateThrottle):
    """Max 60 appels/minute par IP sur les webhooks (protection bruteforce)."""
    scope = 'webhook'
    rate  = '60/minute'

logger = logging.getLogger(__name__)

from .models import Order, Payment, PickupPoint, MeetingZone, DeliveryZone, DeliveryAssignment, IntraCityZoneRate, ReturnRequest, LivreurPayment
from apps.listings.models import Listing
from .serializers import OrderSerializer, CreatePaymentSerializer, PaymentSerializer, PickupPointSerializer, MeetingZoneSerializer, DeliveryZoneSerializer, DeliveryAssignmentSerializer, IntraCityZoneRateSerializer
from .payment_service import initiate_chachap
from core.permissions import IsAdmin
from rest_framework.permissions import IsAuthenticated


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
        from django.db import transaction
        listing = serializer.validated_data.get('listing')
        user    = self.request.user
        if listing and listing.seller == user:
            raise PermissionDenied("Vous ne pouvez pas acheter votre propre annonce.")

        # ── Protection race condition double-achat ────────────────────────────
        # select_for_update() pose un verrou DB jusqu'à la fin de la transaction,
        # empêchant deux acheteurs simultanés de créer deux commandes pour le même article.
        if listing:
            with transaction.atomic():
                locked = Listing.objects.select_for_update().get(pk=listing.pk)
                if not locked.is_active:
                    raise ValidationError("Cette annonce n'est plus disponible.")
                # ── Détection vrai doublon (pas les commandes abandonnées) ────
                # CONFIRMED / DISPUTED → toujours bloquants
                # PENDING → bloquant seulement si un paiement actif existe
                #           ET la commande a moins de 20 min (protection race condition)
                from django.utils import timezone as _tz2
                from datetime import timedelta as _td
                _cutoff = _tz2.now() - _td(minutes=20)

                # Commandes fermes (payées ou en litige)
                _firm = Order.objects.filter(
                    listing=locked,
                    status__in=[Order.Status.CONFIRMED, Order.Status.DISPUTED],
                ).exists()
                # Commandes PENDING récentes avec paiement en attente (ChapChap initié)
                _active_pending = Order.objects.filter(
                    listing=locked,
                    status=Order.Status.PENDING,
                    created_at__gte=_cutoff,
                    payments__status=Payment.Status.PENDING,
                ).exists()

                if _firm or _active_pending:
                    raise ValidationError(
                        "Cette annonce est déjà en cours d'achat. Réessayez dans quelques instants."
                    )
                order = serializer.save(buyer=user)
        else:
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
        # ── Créer automatiquement la conversation vendeur↔acheteur ──────────────
        try:
            from apps.messaging.models import Conversation, Message
            convo, _ = Conversation.objects.get_or_create(
                listing=order.listing,
                buyer=order.buyer,
                seller=order.seller,
            )
            # Message système d'ouverture de commande
            # (guard anti-doublon : si un msg pour cet order_ref existe déjà, on skip)
            order_ref = str(order.id)[:8].upper()
            _msg_marker = f"📦 Commande #{order_ref}"
            if not convo.messages.filter(content__startswith=_msg_marker).exists():
                Message.objects.create(
                    conversation=convo,
                    sender=order.buyer,
                    content=(
                        f"📦 Commande #{order_ref} passée.\n"
                        f"Bonjour, je viens de commander « {order.listing.title} ». "
                        f"N'hésitez pas à me contacter ici pour coordonner la livraison."
                    ),
                    msg_type=Message.MsgType.TEXT,
                )
            from django.utils import timezone as _tz
            convo.last_message_at = _tz.now()
            convo.save(update_fields=['last_message_at'])
            # Notifier le vendeur qu'un message l'attend
            from apps.notifications.models import Notification as _Notif
            _Notif.send(
                user=order.seller,
                type=_Notif.Type.NEW_MESSAGE,
                title=f'💬 Nouveau message — {order.buyer.full_name}',
                body=f'Commande #{order_ref} : « {order.listing.title} » — L\'acheteur vous a envoyé un message.',
                data={'conversation_id': str(convo.id), 'order_id': str(order.id)},
            )
        except Exception as _ce:
            logger.warning("[ORDER CREATE] Création conversation échouée: %s", _ce)

        # Auto-assign livreur pour les livraisons à domicile
        if order.delivery_mode == Order.DeliveryMode.HOME_DELIVERY:
            try:
                _auto_assign_livreur(order)
            except Exception as _ae:
                logger.error("[AUTO ASSIGN] Échec affectation livreur commande %s: %s", order.id, _ae)
                # Notifier les admins delivery
                try:
                    from apps.notifications.models import Notification as _Notif
                    from django.contrib.auth import get_user_model as _gu
                    for _adm in _gu().objects.filter(role__in=['admin', 'super_admin', 'admin_delivery'], is_active=True):
                        _Notif.send(
                            user=_adm,
                            type=_Notif.Type.SYSTEM,
                            title='⚠️ Livreur non assigné',
                            body=f'Commande {str(order.id)[:8].upper()} ({order.listing.title}) — aucun livreur disponible.',
                            data={'order_id': str(order.id)},
                        )
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
            # Bloquer l'annulation si escrow actif (fonds sécurisés) — doit passer par un litige
            if order.escrow_status == Order.EscrowStatus.HELD:
                return Response(
                    {'error': "Impossible d'annuler : des fonds sont en escrow. Ouvrez un litige."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
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

        return Response(OrderSerializer(order, context={'request': request}).data)


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

        # ── Virement automatique immédiat au vendeur ──────────────────────────
        try:
            from apps.orders.models import SellerPayout
            from apps.orders.payment_service import disburse_to_seller
            payout = SellerPayout.objects.filter(
                order=order, status=SellerPayout.Status.PENDING
            ).first()
            if payout:
                disburse_to_seller(str(payout.id))
        except Exception as _exc:
            logger.warning("[CONFIRM RECEIPT] Auto-virement échoué pour commande %s: %s", order.id, _exc)

        return Response(OrderSerializer(order, context={'request': request}).data)


class DisputeView(APIView):
    """L'acheteur ouvre un litige — l'escrow reste bloqué jusqu'à résolution admin."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        # SÉCURITÉ : bloquer les litiges sur commandes non payées (PENDING sans escrow).
        # Sans escrow, un litige ne sert à rien (aucun fonds à bloquer) et laisse la
        # commande bloquée en DISPUTED, impossible à annuler sans intervention admin.
        if order.status != Order.Status.CONFIRMED:
            return Response(
                {'error': 'Un litige ne peut être ouvert que sur une commande confirmée par le vendeur.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.escrow_status != Order.EscrowStatus.HELD:
            return Response(
                {'error': 'Un litige ne peut être ouvert que si des fonds sont sécurisés en escrow.'},
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

        return Response(OrderSerializer(order, context={'request': request}).data)


class InitiatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status not in [Order.Status.PENDING, Order.Status.CONFIRMED]:
            return Response(
                {'error': 'Cette commande ne peut pas être payée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = request.data.get('provider', Payment.Provider.CHACHAP)

        # ── Paiement en espèces ──────────────────────────────────────────────────
        CASH_PROVIDERS = {'cash', 'especes', 'espèces'}
        if provider in CASH_PROVIDERS:
            payment = Payment.objects.create(
                order=order,
                provider=Payment.Provider.CASH,
                amount_gnf=order.amount_gnf,
                status=Payment.Status.PENDING,
            )
            order.confirm()
            # Récompense parrainage : première commande confirmée du filleul
            try:
                from apps.accounts.models import Referral
                referral = Referral.objects.filter(referred=request.user).first()
                if referral:
                    referral.give_reward()
            except Exception as _ref_exc:
                logger.warning("[CASH] Récompense parrainage : %s", _ref_exc)
            # Notifier le vendeur : paiement espèces à la livraison
            try:
                from apps.notifications.models import Notification as _Notif
                _order_ref = str(order.id)[:8].upper()
                _Notif.send(
                    user=order.seller,
                    type=_Notif.Type.ORDER_UPDATE,
                    title='💵 Commande — paiement en espèces',
                    body=(f'Commande #{_order_ref} · {order.buyer.full_name} '
                          f'a choisi de payer {order.amount_gnf:,} GNF en espèces à la livraison '
                          f'pour « {order.listing.title} ».'),
                    data={'order_id': str(order.id)},
                )
            except Exception as _sn:
                logger.warning("[CASH] Notif vendeur : %s", _sn)
            return Response({
                'message': 'Commande confirmée. Le paiement en espèces sera effectué à la livraison.',
                'payment': PaymentSerializer(payment).data,
                'cash': True,
            }, status=status.HTTP_201_CREATED)

        # ── Paiement via ChaChap Pay (Orange Money, MTN MoMo, PayCard…) ─────────
        payment = Payment.objects.create(
            order=order, provider=Payment.Provider.CHACHAP,
            amount_gnf=order.amount_gnf,
            status=Payment.Status.PENDING,
        )

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
            return Response({'error': result.message or 'Erreur ChaChap Pay.'}, status=status.HTTP_502_BAD_GATEWAY)


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
    # ChaChap utilise Ccp-Hmac-Signature (ou CCP-Signature selon la version)
    sig_header = (request.headers.get('Ccp-Hmac-Signature')
                  or request.headers.get('CCP-Hmac-Signature')
                  or request.headers.get('CCP-Signature')
                  or '')
    if not sig_header:
        logger.warning("[CHACHAP] Webhook sans header de signature (Ccp-Hmac-Signature / CCP-Signature)")
        return False

    # ── Protection replay attack : vérifier le timestamp ChaChap ─────────────
    # ChaChap envoie optionnellement Ccp-Timestamp (Unix epoch secondes).
    # Si présent, rejeter les webhooks vieux de plus de 5 minutes.
    ts_header = (request.headers.get('Ccp-Timestamp')
                 or request.headers.get('CCP-Timestamp')
                 or '')
    if ts_header:
        try:
            import time as _time
            ts = int(ts_header)
            if abs(_time.time() - ts) > 300:
                logger.warning("[CHACHAP] Webhook trop ancien (replay attack?) ts=%s", ts_header)
                return False
        except (ValueError, TypeError):
            logger.warning("[CHACHAP] Ccp-Timestamp invalide : %s", ts_header)

    body = request.body
    # ChapChap envoie parfois le body double-encodé : la payload JSON est
    # sérialisée en string JSON (body = b'"{\\"key\\":\\"val\\"}"').
    # ChapChap signe le JSON intérieur, pas l'enveloppe string.
    # → Si le body commence par '"', on décode d'abord.
    import json as _json_
    body_for_hmac = body
    if body.startswith(b'"'):
        try:
            inner = _json_.loads(body)
            if isinstance(inner, str):
                body_for_hmac = inner.encode()
                logger.debug("[CHACHAP] Body double-encodé détecté — HMAC calculé sur le JSON intérieur (%d octets)", len(body_for_hmac))
        except Exception as _je:
            logger.debug("[CHACHAP] Tentative décodage double-encode échouée: %s — utilisation du body brut", _je)

    expected = hmac.new(hmac_key.encode(), body_for_hmac, hashlib.sha256).hexdigest()
    ok = hmac.compare_digest(sig_header, expected)
    if not ok:
        logger.warning("[CHACHAP] Signature invalide — reçue=%s attendue=%s (body_len=%d body_for_hmac_len=%d)",
                       sig_header[:16], expected[:16], len(body), len(body_for_hmac))
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
    permission_classes  = [permissions.AllowAny]
    throttle_classes    = [WebhookRateThrottle]

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
            # Log complet pour diagnostiquer
            logger.info("[CHACHAP] Webhook POST reçu — headers=%s body=%s",
                        dict(request.headers), request.body[:500])
            sig_ok = _verify_chachap_signature(request)
            if not sig_ok:
                logger.warning("[CHACHAP] Webhook signature invalide — requête rejetée")
                return Response({'error': 'Signature invalide'}, status=status.HTTP_401_UNAUTHORIZED)

            # ChaChap envoie parfois la body comme une STRING JSON (double-encodée).
            # DRF la parse alors en str, pas en dict → on dé-encode manuellement.
            if isinstance(data, str):
                import json as _json
                try:
                    data = _json.loads(data)
                except (ValueError, TypeError):
                    logger.error("[CHACHAP] Webhook body non-parsable : %r", data[:200])
                    return Response({'error': 'body invalide'}, status=status.HTTP_400_BAD_REQUEST)

            operation_id = data.get('operation_id') or data.get('order_id') or ''
            # status peut être une string ('success') OU un dict {'code': 'success', 'description': '...'}
            raw_status = data.get('status', '')
            if isinstance(raw_status, dict):
                success = raw_status.get('code', '').lower() == 'success'
            else:
                success = str(raw_status).lower() == 'success'
            ref = operation_id
            logger.info("[CHACHAP] Webhook — operation_id=%s success=%s method=%s sig_ok=%s",
                        operation_id, success, data.get('transaction', {}).get('payment_method', ''), sig_ok)

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
            import uuid as _uuid
            payment = Payment.objects.filter(external_ref=ref).first() if ref else None
            if not payment and ref:
                # order__id est un UUID — ne passer que si ref est un UUID valide
                # (les refs boost comme "CCP-BOOST-xxx" ne sont pas des UUIDs)
                try:
                    _uuid.UUID(str(ref))
                    payment = Payment.objects.filter(order__id=ref, status=Payment.Status.PENDING).first()
                except (ValueError, AttributeError):
                    pass  # ref non-UUID → ce sera un boost ref, géré dans le bloc else
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
                    # Récompense parrainage : première commande payée du filleul
                    try:
                        from apps.accounts.models import Referral
                        referral = getattr(payment.order.buyer, 'referral_received', None)
                        if referral is None:
                            referral = Referral.objects.filter(referred=payment.order.buyer).first()
                        if referral:
                            referral.give_reward()
                    except Exception as _ref_exc:
                        logger.warning("[WEBHOOK] Récompense parrainage : %s", _ref_exc)
                    # Emails transactionnels : commande confirmée + paiement reçu
                    try:
                        from core.email_notifications import (
                            send_order_confirmed_buyer,
                            send_payment_received,
                        )
                        send_order_confirmed_buyer(payment.order)
                        send_payment_received(payment.order, payment)
                    except Exception as _email_exc:
                        logger.warning("[WEBHOOK] Email post-paiement : %s", _email_exc)
                    # Notification in-app acheteur
                    try:
                        from apps.notifications.models import Notification as _NotifWH
                        _NotifWH.send(
                            user=payment.order.buyer,
                            type=_NotifWH.Type.ORDER_UPDATE,
                            title='✅ Paiement confirmé',
                            body=f'Votre paiement pour « {payment.order.listing.title} » a été reçu.',
                            data={'order_id': str(payment.order.id)},
                        )
                    except Exception:
                        pass

                    # ── Notification vendeur : moyen de paiement + message conversation ─
                    try:
                        _PM_LABELS = {
                            'orange_money':   '🟠 Orange Money',
                            'mtn_momo':       '🟡 MTN MoMo',
                            'mtn':            '🟡 MTN MoMo',
                            'paycard':        '💳 PayCard',
                            'cc':             '💳 Carte bancaire',
                            'carte_bancaire': '💳 Carte bancaire',
                            'kulu':           '🔵 Kulu',
                            'soutra_money':   '🔷 Soutra Money',
                            'akiba':          '🟢 Akiba',
                            'chachap':        '💰 ChaChap Pay',
                            'orange':         '🟠 Orange Money',
                            'cash':           '💵 Espèces',
                        }
                        _pm_raw = ''
                        if provider == 'chachap' and isinstance(data, dict):
                            _pm_raw = (data.get('transaction') or {}).get('payment_method', '')
                        if not _pm_raw:
                            _pm_raw = provider
                        _pm_label  = _PM_LABELS.get(_pm_raw, _pm_raw.replace('_', ' ').title())
                        _order_ref = str(payment.order.id)[:8].upper()

                        # Chercher la conversation buyer↔seller et y ajouter
                        # un message de confirmation de paiement (visible des deux côtés)
                        _conv_id_str = ''
                        try:
                            from apps.messaging.models import (
                                Conversation as _Conv, Message as _Msg
                            )
                            from django.utils import timezone as _tz_m
                            _convo = _Conv.objects.filter(
                                listing=payment.order.listing,
                                buyer=payment.order.buyer,
                                seller=payment.order.seller,
                            ).first()
                            if _convo:
                                _conv_id_str = str(_convo.id)
                                _Msg.objects.create(
                                    conversation=_convo,
                                    sender=payment.order.buyer,
                                    content=(
                                        f'✅ Paiement confirmé — {_pm_label}\n'
                                        f'Montant : {payment.amount_gnf:,} GNF\n'
                                        f'Commande #{_order_ref} — '
                                        f'Coordonnez maintenant la remise ou la livraison.'
                                    ),
                                    msg_type=_Msg.MsgType.TEXT,
                                )
                                _convo.last_message_at = _tz_m.now()
                                _convo.save(update_fields=['last_message_at'])
                        except Exception as _cm_exc:
                            logger.warning("[WEBHOOK] Msg conversation paiement : %s", _cm_exc)

                        from apps.notifications.models import Notification as _NotifSeller
                        _NotifSeller.send(
                            user=payment.order.seller,
                            type=_NotifSeller.Type.ORDER_UPDATE,
                            title=f'💰 Paiement reçu — {_pm_label}',
                            body=(f'Commande #{_order_ref} · {payment.order.buyer.full_name} '
                                  f'a payé {payment.amount_gnf:,} GNF via {_pm_label} '
                                  f'pour « {payment.order.listing.title} ». '
                                  f'Ouvrez la conversation pour coordonner.'),
                            data={
                                'order_id': str(payment.order.id),
                                'conversation_id': _conv_id_str,
                            },
                        )
                    except Exception as _sn_exc:
                        logger.warning("[WEBHOOK] Notif vendeur paiement : %s", _sn_exc)
            else:
                # ── Boost payment ? ──────────────────────────────────────────
                if ref and provider == 'chachap':
                    try:
                        from apps.listings.models import BoostPayment
                        from apps.listings.views import _apply_boost
                        boost = BoostPayment.objects.filter(
                            ext_ref=ref, status=BoostPayment.Status.PENDING
                        ).first()
                        if boost:
                            if success:
                                boost.status = BoostPayment.Status.APPROVED
                                boost.save(update_fields=['status'])
                                _apply_boost(boost.listing, boost.days)
                                logger.info("[CHACHAP] Boost %s activé — listing %s", boost.id, boost.listing.id)
                                try:
                                    from apps.notifications.models import Notification as _NotifBoost
                                    _NotifBoost.send(
                                        user=boost.listing.seller,
                                        type=_NotifBoost.Type.ORDER_UPDATE,
                                        title='⚡ Annonce boostée !',
                                        body=f'Votre annonce « {boost.listing.title} » '
                                             f'est mise en avant pour {boost.days} jours.',
                                        data={'listing_id': str(boost.listing.id)},
                                    )
                                except Exception:
                                    pass
                                try:
                                    from core.email_notifications import send_boost_activated
                                    boost.refresh_from_db()
                                    send_boost_activated(boost)
                                except Exception as _be:
                                    logger.warning("[WEBHOOK] Email boost: %s", _be)
                            else:
                                boost.status = BoostPayment.Status.REJECTED
                                boost.admin_note = 'Paiement ChaChap échoué.'
                                boost.save(update_fields=['status', 'admin_note'])
                                logger.info("[CHACHAP] Boost %s rejeté — paiement échoué.", boost.id)
                        else:
                            logger.warning("[WEBHOOK] %s — paiement introuvable pour ref=%s", provider, ref)
                    except Exception as exc:
                        logger.error("[WEBHOOK] Boost activation error ref=%s : %s", ref, exc, exc_info=True)
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
            # cancel() n'accepte pas le statut DISPUTED — mettre à jour directement
            order.status = Order.Status.CANCELLED
            order.save(update_fields=['status', 'updated_at'])
            Notification.send(
                user=order.buyer,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu — remboursement en cours',
                body=f'Le litige pour « {order.listing.title} » a été résolu en votre faveur. '
                     f'Le remboursement de {order.amount_gnf:,} GNF sera effectué sous 24–48h.',
                data={'order_id': str(order.id)},
            )
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='Litige résolu',
                body=f'Le litige pour « {order.listing.title} » a été résolu en faveur de l\'acheteur.',
                data={'order_id': str(order.id)},
            )
            # Notifier les admins comptables pour le remboursement manuel
            from django.contrib.auth import get_user_model as _get_user_model
            _User = _get_user_model()
            _admins = _User.objects.filter(role__in=['admin', 'super_admin', 'admin_accounting'], is_active=True)
            _refund_note = (
                f"REMBOURSEMENT REQUIS — Litige #{str(order.id)[:8].upper()}\n"
                f"Acheteur : {order.buyer.full_name} ({order.buyer.phone_number})\n"
                f"Montant : {order.amount_gnf:,} GNF\n"
                f"Article : {order.listing.title}"
            )
            for _admin in _admins:
                Notification.send(
                    user=_admin,
                    type=Notification.Type.SYSTEM,
                    title='💸 Remboursement acheteur requis',
                    body=_refund_note,
                    data={'order_id': str(order.id), 'action': 'refund'},
                )

        # Email litige résolu — acheteur + vendeur
        try:
            from core.email_notifications import send_dispute_resolved
            winner = 'seller' if action == 'release' else 'buyer'
            send_dispute_resolved(order, winner)
        except Exception:
            pass

        return Response(OrderSerializer(order, context={'request': request}).data)


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
    Algorithme d'affectation intelligent — priorité proximité vendeur.

    Priorités (dans l'ordre) :
      1. Même ville que le VENDEUR (le livreur doit d'abord aller chercher le colis)
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

    # Priorité géographique : ville du VENDEUR (le livreur récupère le colis chez lui)
    seller_city = getattr(order.seller, 'city', '') or ''
    if seller_city:
        city_match = livreurs.filter(city__iexact=seller_city)
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
    # SÉCURITÉ : ne PAS envoyer le verification_code au livreur.
    # Ce code est donné par l'ACHETEUR à la réception pour prouver la livraison.
    # Si le livreur le reçoit à l'avance, il peut confirmer sans se déplacer.
    Notification.send(
        user=livreur,
        type=Notification.Type.ORDER_UPDATE,
        title='📦 Nouvelle livraison assignée',
        body=(
            f'Article : « {order.listing.title} »\n'
            f'Adresse : {order.delivery_address}\n'
            f'Code retrait (montrez au vendeur) : {assignment.pickup_code}\n'
            f'L\'acheteur vous donnera son code de confirmation à la livraison.'
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
            f'L\'acheteur vous donnera son code de confirmation a la livraison.',
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


class DeliveryCodeThrottle(SimpleRateThrottle):
    """
    Anti brute-force : max 5 tentatives par heure par livreur sur la confirmation de livraison.
    Empêche un livreur de deviner le code à 6 chiffres de ses propres assignations.
    """
    scope = 'delivery_confirm'
    rate  = '20/hour'

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': str(request.user.id)}


class LivreurConfirmDeliveryView(APIView):
    """Livreur : confirme la livraison via le code de vérification fourni par l'acheteur."""
    permission_classes = [IsLivreur]
    throttle_classes   = [DeliveryCodeThrottle]

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


class LivreurUpdatePositionView(APIView):
    """
    PATCH livreur/assignments/<pk>/position/
    Livreur met à jour sa position GPS en temps réel.
    - Enregistre lat/lng sur l'assignation (position courante)
    - Ajoute une entrée dans DeliveryPositionHistory (itinéraire complet)
    - Élagage automatique : conserve les 500 dernières positions
    """
    permission_classes = [IsLivreur]

    def patch(self, request, pk):
        from django.utils import timezone
        from .models import DeliveryPositionHistory
        assignment = get_object_or_404(
            DeliveryAssignment, pk=pk, livreur=request.user,
            status__in=[DeliveryAssignment.Status.ASSIGNED, DeliveryAssignment.Status.EN_ROUTE],
        )
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        if lat is None or lng is None:
            return Response({'error': 'lat et lng sont requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            lat = float(lat)
            lng = float(lng)
        except (TypeError, ValueError):
            return Response({'error': 'lat et lng doivent être des nombres.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response({'error': 'Coordonnées GPS invalides.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mettre à jour la position courante
        assignment.current_lat         = lat
        assignment.current_lng         = lng
        assignment.position_updated_at = timezone.now()
        assignment.save(update_fields=['current_lat', 'current_lng', 'position_updated_at', 'updated_at'])

        # Enregistrer dans l'historique
        DeliveryPositionHistory.objects.create(assignment=assignment, lat=lat, lng=lng)

        # Élaguer : garder seulement les 500 dernières positions
        history_ids = list(
            DeliveryPositionHistory.objects.filter(assignment=assignment)
            .order_by('-recorded_at')
            .values_list('id', flat=True)[500:]
        )
        if history_ids:
            DeliveryPositionHistory.objects.filter(id__in=history_ids).delete()

        return Response({
            'lat': lat,
            'lng': lng,
            'updated_at': assignment.position_updated_at.isoformat(),
            'assignment_id': str(assignment.id),
            'order_id': str(assignment.order_id),
        })


class DeliveryTrackingView(APIView):
    """
    GET orders/<uuid:pk>/tracking/
    Acheteur / vendeur / admin : suivre la position du livreur en temps réel.
    Retourne la position courante + les 50 derniers points de l'itinéraire.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from .models import DeliveryPositionHistory
        order = get_object_or_404(Order, pk=pk)
        user  = request.user

        # Autoriser : acheteur, vendeur, ou admin
        is_admin = hasattr(user, 'is_super_admin') and (user.is_super_admin or user.role in ('admin', 'super_admin', 'admin_delivery'))
        if order.buyer != user and order.seller != user and not is_admin:
            return Response({'error': 'Accès interdit.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            assignment = order.delivery_assignment
        except DeliveryAssignment.DoesNotExist:
            return Response({'error': 'Pas de livraison à domicile pour cette commande.'}, status=status.HTTP_404_NOT_FOUND)

        # 50 derniers points de l'itinéraire
        history = DeliveryPositionHistory.objects.filter(assignment=assignment).order_by('-recorded_at')[:50]
        route   = [{'lat': float(p.lat), 'lng': float(p.lng), 'at': p.recorded_at.isoformat()} for p in reversed(list(history))]

        # SÉCURITÉ : verification_code visible uniquement par l'acheteur (et admin).
        # Le vendeur ne doit PAS voir ce code — sinon il peut le transmettre au livreur
        # pour déclencher une libération d'escrow sans livraison réelle.
        data = {
            'order_id':        str(order.id),
            'assignment_id':   str(assignment.id),
            'livreur':         assignment.livreur.full_name,
            'livreur_phone':   str(assignment.livreur.phone_number),
            'status':          assignment.status,
            'current_position': {
                'lat': float(assignment.current_lat)  if assignment.current_lat  else None,
                'lng': float(assignment.current_lng)  if assignment.current_lng  else None,
                'updated_at': assignment.position_updated_at.isoformat() if assignment.position_updated_at else None,
            },
            'route': route,
        }
        if order.buyer == user or is_admin:
            data['verification_code'] = assignment.verification_code
        return Response(data)


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
        # SÉCURITÉ : ne PAS envoyer le verification_code au livreur.
        Notification.send(
            user=livreur,
            type=Notification.Type.ORDER_UPDATE,
            title='📦 Nouvelle livraison assignée',
            body=(
                f'Article : « {order.listing.title} » → {order.delivery_address}\n'
                f'Code retrait (montrez au vendeur) : {assignment.pickup_code}\n'
                f'L\'acheteur vous donnera son code de confirmation à la livraison.'
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
                f'L\'acheteur vous donnera son code de confirmation a la livraison.',
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
        qs = AppUser.objects.filter(role='livreur').values(
            'id', 'full_name', 'phone_number', 'city', 'is_active', 'is_available',
        )
        # UUID et PhoneNumber ne sont pas JSON-sérialisables nativement → conversion explicite
        livreurs = [
            {
                'id':           str(u['id']),
                'full_name':    u['full_name'],
                'phone_number': str(u['phone_number']) if u['phone_number'] else '',
                'city':         u['city'] or '',
                'is_active':    u['is_active'],
                'is_available': u['is_available'],
            }
            for u in qs
        ]
        return Response(livreurs)


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

        # Pagination : page + page_size (max 200 par page)
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(200, max(1, int(request.query_params.get('page_size', 50))))
        except (ValueError, TypeError):
            page, page_size = 1, 50

        total  = qs.count()
        offset = (page - 1) * page_size
        orders = qs[offset: offset + page_size]

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
        } for o in orders]

        return Response({
            'count':     total,
            'page':      page,
            'page_size': page_size,
            'pages':     (total + page_size - 1) // page_size,
            'results':   data,
        })


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

        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 50))))
        except (ValueError, TypeError):
            page, page_size = 1, 50

        total   = qs.count()
        offset  = (page - 1) * page_size
        returns = qs[offset: offset + page_size]

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
        } for r in returns]

        return Response({
            'count':     total,
            'page':      page,
            'page_size': page_size,
            'pages':     (total + page_size - 1) // page_size,
            'results':   data,
        })


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
    """
    POST /orders/admin/accounting/weekly-payouts/mark-paid/
    Marque les virements comme payés.
    Si auto_disburse=true (défaut), tente le virement ChaChaP B2C pour chaque livreur
    qui a configuré son numéro mobile money.
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        from .models import LivreurWeeklyPayout
        from .payment_service import disburse_to_livreur
        from django.utils import timezone
        if not (request.user.can_manage_accounting or request.user.is_super_admin):
            return Response({'error': 'Accès réservé.'}, status=403)

        payout_ids     = request.data.get('payout_ids', [])
        payment_ref    = request.data.get('payment_ref', '').strip()
        payment_method = request.data.get('payment_method', '').strip()
        note           = request.data.get('note', '').strip()
        auto_disburse  = request.data.get('auto_disburse', True)

        if not payout_ids:
            return Response({'error': 'payout_ids requis.'}, status=400)

        qs = LivreurWeeklyPayout.objects.filter(id__in=payout_ids, status='pending').select_related('livreur')

        auto_ok = auto_fail = manual = 0
        results = []

        for payout in qs:
            if auto_disburse and payout.livreur.has_payout_info:
                # Tentative virement automatique
                result = disburse_to_livreur(str(payout.id))
                if result.success:
                    auto_ok += 1
                    results.append({'id': str(payout.id), 'method': 'auto', 'ref': result.reference})
                else:
                    auto_fail += 1
                    results.append({'id': str(payout.id), 'method': 'auto_failed', 'error': result.message})
            else:
                # Pas de numéro → marquer manuellement
                payout.status         = LivreurWeeklyPayout.Status.PAID
                payout.paid_at        = timezone.now()
                payout.payment_ref    = payment_ref
                payout.payment_method = payment_method or 'manual'
                payout.note           = note or ('Numéro mobile money non configuré — virement manuel' if not payout.livreur.has_payout_info else note)
                payout.save(update_fields=['status', 'paid_at', 'payment_ref', 'payment_method', 'note', 'updated_at'])
                manual += 1
                results.append({'id': str(payout.id), 'method': 'manual'})

        return Response({
            'auto_disbursed': auto_ok,
            'auto_failed':    auto_fail,
            'manual_marked':  manual,
            'payment_ref':    payment_ref,
            'results':        results,
        })


class LivreurUpdatePayoutInfoView(APIView):
    """
    PUT /orders/livreur/payout-info/
    Le livreur configure son numéro mobile money pour recevoir ses salaires.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'livreur':
            return Response({'error': 'Réservé aux livreurs.'}, status=403)
        return Response({
            'payout_phone':    request.user.payout_phone,
            'payout_provider': request.user.payout_provider,
            'has_payout_info': request.user.has_payout_info,
        })

    def put(self, request):
        if request.user.role != 'livreur':
            return Response({'error': 'Réservé aux livreurs.'}, status=403)

        phone    = (request.data.get('payout_phone')    or '').strip()
        provider = (request.data.get('payout_provider') or '').strip()

        if not phone or not provider:
            return Response({'error': 'Numéro et opérateur requis.'}, status=400)
        VALID_PROVIDERS = {'orange_money', 'mtn_momo', 'paycard', 'kulu', 'soutra_money', 'akiba'}
        if provider not in VALID_PROVIDERS:
            return Response({'error': f'Opérateur invalide. Valeurs acceptées : {", ".join(sorted(VALID_PROVIDERS))}'}, status=400)

        request.user.payout_phone    = phone
        request.user.payout_provider = provider
        request.user.save(update_fields=['payout_phone', 'payout_provider', 'updated_at'])

        return Response({
            'message':         'Compte de paiement mis à jour.',
            'payout_phone':    phone,
            'payout_provider': provider,
        })


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


# ── Paiements vendeur ─────────────────────────────────────────────────────────

class SellerEarningsView(APIView):
    """
    GET /orders/seller/earnings/
    Retourne le résumé des gains du vendeur connecté + liste de ses paiements.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import SellerPayout
        from django.db.models import Sum, Q as _Q
        # Accepter buyers qui ont des ventes, en plus des sellers/admins
        has_sales = Order.objects.filter(seller=request.user).exists()
        if request.user.role not in ('seller', 'admin', 'super_admin') and not has_sales:
            return Response({'error': 'Réservé aux vendeurs.'}, status=403)

        payouts = SellerPayout.objects.filter(seller=request.user).order_by('-created_at')

        agg = payouts.aggregate(
            earned  = Sum('amount_gnf', filter=_Q(status='completed')),
            pending = Sum('amount_gnf', filter=_Q(status__in=['pending', 'processing'])),
            failed  = Sum('amount_gnf', filter=_Q(status='failed')),
        )
        total_earned  = agg['earned']  or 0
        total_pending = agg['pending'] or 0
        total_failed  = agg['failed']  or 0

        payout_list = [
            {
                'id':           str(p.id),
                'order_id':     str(p.order_id),
                'amount_gnf':   p.amount_gnf,
                'status':       p.status,
                'provider':     p.provider,
                'payout_phone': p.payout_phone,
                'external_ref': p.external_ref,
                'processed_at': p.processed_at,
                'created_at':   p.created_at,
                'admin_note':   p.admin_note,
            }
            for p in payouts[:50]
        ]

        return Response({
            'summary': {
                'total_earned':  total_earned,
                'total_pending': total_pending,
                'total_failed':  total_failed,
                'count':         payouts.count(),
            },
            'payouts': payout_list,
        })


class SellerUpdatePayoutInfoView(APIView):
    """
    PUT /orders/seller/payout-info/
    Le vendeur met à jour son numéro mobile money pour recevoir les paiements.
    """
    permission_classes = [IsAuthenticated]

    def put(self, request):
        phone    = (request.data.get('payout_phone') or '').strip()
        provider = (request.data.get('payout_provider') or '').strip()

        if not phone or not provider:
            return Response({'error': 'Numéro et opérateur requis.'}, status=400)

        VALID_PROVIDERS = {'orange_money', 'mtn_momo', 'paycard', 'kulu', 'soutra_money', 'akiba'}
        if provider not in VALID_PROVIDERS:
            return Response({'error': f'Opérateur invalide. Valeurs acceptées : {", ".join(sorted(VALID_PROVIDERS))}'}, status=400)

        # Écrire sur User (universel) + UserProfile (pour la rétro-compatibilité)
        request.user.payout_phone    = phone
        request.user.payout_provider = provider
        request.user.save(update_fields=['payout_phone', 'payout_provider', 'updated_at'])
        try:
            profile = request.user.profile
            profile.payout_phone    = phone
            profile.payout_provider = provider
            profile.save(update_fields=['payout_phone', 'payout_provider', 'updated_at'])
        except Exception:
            pass  # Pas de profil — pas grave, User est source de vérité

        return Response({
            'message':          'Informations de paiement mises à jour.',
            'payout_phone':     phone,
            'payout_provider':  provider,
        })


class AdminSellerPayoutListView(APIView):
    """GET /orders/admin/seller-payouts/ — liste tous les paiements vendeurs."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from .models import SellerPayout
        if not (request.user.is_super_admin or request.user.can_manage_accounting):
            return Response({'error': 'Accès réservé.'}, status=403)

        status_filter = request.query_params.get('status')
        qs = SellerPayout.objects.select_related('seller', 'order').order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter)

        data = [
            {
                'id':           str(p.id),
                'seller':       p.seller.full_name,
                'seller_phone': str(p.seller.phone_number),
                'order_id':     str(p.order_id),
                'amount_gnf':   p.amount_gnf,
                'status':       p.status,
                'provider':     p.provider,
                'payout_phone': p.payout_phone,
                'external_ref': p.external_ref,
                'processed_at': p.processed_at,
                'created_at':   p.created_at,
                'admin_note':   p.admin_note,
            }
            for p in qs[:200]
        ]
        total_pending = sum(p['amount_gnf'] for p in data if p['status'] in ('pending', 'processing'))
        return Response({'payouts': data, 'total_pending_gnf': total_pending})


class AdminTriggerSellerPayoutView(APIView):
    """POST /orders/admin/seller-payouts/<uuid>/disburse/ — déclenche le virement."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .models import SellerPayout
        from .payment_service import disburse_to_seller
        if not (request.user.is_super_admin or request.user.can_manage_accounting):
            return Response({'error': 'Accès réservé.'}, status=403)

        try:
            payout = SellerPayout.objects.get(pk=pk)
        except SellerPayout.DoesNotExist:
            return Response({'error': 'Paiement introuvable.'}, status=404)

        result = disburse_to_seller(str(payout.id))
        return Response({
            'success': result.success,
            'message': result.message,
            'reference': result.reference,
        })


class AdminMarkSellerPayoutPaidView(APIView):
    """POST /orders/admin/seller-payouts/<uuid>/mark-paid/ — marquer comme versé manuellement."""
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from .models import SellerPayout
        if not (request.user.is_super_admin or request.user.can_manage_accounting):
            return Response({'error': 'Accès réservé.'}, status=403)

        try:
            payout = SellerPayout.objects.get(pk=pk)
        except SellerPayout.DoesNotExist:
            return Response({'error': 'Paiement introuvable.'}, status=404)

        note = request.data.get('note', 'Versement manuel admin')
        payout.mark_completed(note=note)
        return Response({'message': 'Paiement marqué comme versé.', 'id': str(payout.id)})


@method_decorator(csrf_exempt, name='dispatch')
class ChaChaPayoutWebhookView(APIView):
    """
    POST /orders/webhook/chachap/payout/

    ChapChap appelle cette URL quand le statut d'un payout change
    (new → auto_processing → en_cours → executed ou failed).

    Payload attendu :
    {
        "payout_request_id": "PAYOUT-...",
        "payout_request_status": "executed",   # ou "failed", "en_cours", etc.
        "payout_amount": 4800.0,
        "payout_mode": "wallet_transfer",
        "payout_data": { "wallet_account_number": "...", "wallet_type": "paycard" }
    }
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [WebhookRateThrottle]

    def post(self, request):
        import json as _json

        logger.info("[PAYOUT WEBHOOK] POST reçu — headers=%s body=%.300s",
                    dict(request.headers), request.body)

        # ── Vérification signature HMAC ───────────────────────────────────────
        sig_ok = _verify_chachap_signature(request)
        if not sig_ok:
            logger.warning("[PAYOUT WEBHOOK] Signature invalide — rejeté")
            return Response({'error': 'Signature invalide'}, status=401)

        # ── Parse body ────────────────────────────────────────────────────────
        try:
            raw = request.body
            data = _json.loads(raw)
            # double-encodé ?
            if isinstance(data, str):
                data = _json.loads(data)
        except Exception as exc:
            logger.error("[PAYOUT WEBHOOK] Body non-parsable : %s", exc)
            return Response({'error': 'body invalide'}, status=400)

        payout_ref    = data.get('payout_request_id', '')
        payout_status = data.get('payout_request_status', '')

        logger.info("[PAYOUT WEBHOOK] payout_request_id=%s status=%s", payout_ref, payout_status)

        if not payout_ref:
            return Response({'error': 'payout_request_id manquant'}, status=400)

        # ── Chercher le SellerPayout correspondant ─────────────────────────────
        from .models import SellerPayout, LivreurWeeklyPayout

        seller_payout   = SellerPayout.objects.filter(external_ref=payout_ref).first()
        livreur_payout  = LivreurWeeklyPayout.objects.filter(payment_ref=payout_ref).first()

        if not seller_payout and not livreur_payout:
            logger.warning("[PAYOUT WEBHOOK] Aucun payout trouvé pour ref=%s", payout_ref)
            return Response({'received': True})   # 200 pour éviter les retries ChapChap

        if payout_status == 'executed':
            # ── Vendeur ────────────────────────────────────────────────────────
            if seller_payout and seller_payout.status != SellerPayout.Status.COMPLETED:
                seller_payout.mark_completed(
                    external_ref=payout_ref,
                    note=f"Règlement ChaChaP exécuté (webhook status=executed)",
                )
                logger.info("[PAYOUT WEBHOOK] SellerPayout %s → COMPLETED", seller_payout.id)
                self._notify_seller(seller_payout)

            # ── Livreur ────────────────────────────────────────────────────────
            if livreur_payout and livreur_payout.status != LivreurWeeklyPayout.Status.PAID:
                from django.utils import timezone as _tz
                livreur_payout.status      = LivreurWeeklyPayout.Status.PAID
                livreur_payout.paid_at     = _tz.now()
                livreur_payout.note        = "Règlement ChaChaP exécuté (webhook status=executed)"
                livreur_payout.save(update_fields=['status', 'paid_at', 'note', 'updated_at'])
                logger.info("[PAYOUT WEBHOOK] LivreurWeeklyPayout %s → PAID", livreur_payout.id)
                self._notify_livreur(livreur_payout)

        elif payout_status in ('failed', 'rejected', 'cancelled'):
            if seller_payout and seller_payout.status not in (
                SellerPayout.Status.COMPLETED, SellerPayout.Status.FAILED
            ):
                seller_payout.mark_failed(
                    note=f"Règlement ChaChaP échoué (webhook status={payout_status})"
                )
                logger.warning("[PAYOUT WEBHOOK] SellerPayout %s → FAILED (%s)", seller_payout.id, payout_status)

            if livreur_payout and livreur_payout.status not in (
                LivreurWeeklyPayout.Status.PAID,
            ):
                livreur_payout.note = f"Règlement ChaChaP échoué (webhook status={payout_status})"
                livreur_payout.save(update_fields=['note', 'updated_at'])
                logger.warning("[PAYOUT WEBHOOK] LivreurWeeklyPayout %s — FAILED (%s)", livreur_payout.id, payout_status)

        else:
            # Statuts intermédiaires (new, auto_processing, en_cours) → log seulement
            logger.info("[PAYOUT WEBHOOK] Statut intermédiaire %s pour %s — rien à faire", payout_status, payout_ref)

        return Response({'received': True})

    # ── Helpers notifications ─────────────────────────────────────────────────

    def _notify_seller(self, payout):
        try:
            from apps.notifications.models import Notification as _N
            _N.send(
                user=payout.seller,
                type=_N.Type.ORDER_UPDATE,
                title='💸 Virement reçu !',
                body=(
                    f'Votre virement de {payout.amount_gnf:,} GNF a été exécuté '
                    f'et envoyé sur votre compte {payout.provider}.'
                ),
                data={'payout_id': str(payout.id)},
            )
        except Exception as exc:
            logger.warning("[PAYOUT WEBHOOK] Notification vendeur impossible : %s", exc)

    def _notify_livreur(self, payout):
        try:
            from apps.notifications.models import Notification as _N
            _N.send(
                user=payout.livreur,
                type=_N.Type.ORDER_UPDATE,
                title='💸 Salaire reçu !',
                body=(
                    f'Votre virement de {payout.net_gnf:,} GNF a été exécuté '
                    f'et envoyé sur votre compte {payout.payment_method}.'
                ),
                data={'payout_id': str(payout.id)},
            )
        except Exception as exc:
            logger.warning("[PAYOUT WEBHOOK] Notification livreur impossible : %s", exc)
