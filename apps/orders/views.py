from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import Order, Payment
from .serializers import OrderSerializer, CreatePaymentSerializer, PaymentSerializer
from .payment_service import initiate_orange_money, initiate_mtn_momo


class OrderListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(
            buyer=user
        ).select_related('listing', 'buyer', 'seller')

    def perform_create(self, serializer):
        serializer.save(buyer=self.request.user)


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        return Order.objects.filter(buyer=user) | Order.objects.filter(seller=user)


class OrderUpdateStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        order = get_object_or_404(Order, pk=pk)
        user  = request.user

        if action == 'confirm' and order.seller == user:
            order.confirm()
        elif action == 'complete' and order.buyer == user:
            order.complete()
        elif action == 'cancel' and user in [order.buyer, order.seller]:
            order.cancel()
        else:
            return Response(
                {'error': 'Action non autorisée.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return Response(OrderSerializer(order).data)


class InitiatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, buyer=request.user)

        if order.status not in [Order.Status.PENDING, Order.Status.CONFIRMED]:
            return Response(
                {'error': 'Cette commande ne peut pas être payée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CreatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        provider     = serializer.validated_data['provider']
        phone_number = serializer.validated_data.get('phone_number', '')

        payment = Payment.objects.create(
            order=order,
            provider=provider,
            phone_number=phone_number,
            amount_gnf=order.amount_gnf,
            status=Payment.Status.PENDING
        )

        # Appeler le bon service selon le fournisseur
        if provider == Payment.Provider.ORANGE_MONEY:
            result = initiate_orange_money(phone_number, order.amount_gnf, str(order.id))
        elif provider == Payment.Provider.MTN_MOMO:
            result = initiate_mtn_momo(phone_number, order.amount_gnf, str(order.id))
        else:
            # CASH ou CARD : confirmation directe
            result_type = type('R', (), {'success': True, 'reference': '', 'message': 'Paiement en espèces enregistré'})
            result = result_type()

        if result.success:
            payment.status       = Payment.Status.SUCCESS
            payment.external_ref = getattr(result, 'reference', '')
            payment.save(update_fields=['status', 'external_ref'])
            order.confirm()
        else:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response(
                {'error': result.message},
                status=status.HTTP_502_BAD_GATEWAY
            )

        return Response({
            'message': result.message,
            'payment': PaymentSerializer(payment).data,
        }, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    """
    Reçoit les callbacks des opérateurs (Orange Money, MTN MoMo).
    Vérifie le statut et met à jour le paiement correspondant.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, provider):
        data = request.data

        # Orange Money envoie `pay_token`, MTN MoMo envoie `externalId` (= order_id)
        if provider == 'orange':
            ref      = data.get('pay_token', '')
            ext_ref  = data.get('status', '')
            success  = ext_ref == 'SUCCESS'
        elif provider == 'mtn':
            ref      = data.get('externalId', '')
            ext_ref  = data.get('status', '')
            success  = ext_ref == 'SUCCESSFUL'
        else:
            return Response({'error': 'Fournisseur inconnu'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.get(external_ref=ref) if ref else None
            if not payment:
                payment = Payment.objects.filter(
                    order__id=ref, status=Payment.Status.PENDING
                ).first()

            if payment:
                payment.status = Payment.Status.SUCCESS if success else Payment.Status.FAILED
                payment.save(update_fields=['status'])
                if success:
                    payment.order.confirm()
        except Exception:
            pass

        return Response({'status': 'ok'})
