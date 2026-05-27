from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import Order, Payment
from .serializers import OrderSerializer, CreatePaymentSerializer, PaymentSerializer


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
        return Order.objects.filter(
            buyer=user
        ) | Order.objects.filter(seller=user)


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

        payment = Payment.objects.create(
            order=order,
            provider=serializer.validated_data['provider'],
            phone_number=serializer.validated_data.get('phone_number', ''),
            amount_gnf=order.amount_gnf,
            status=Payment.Status.PENDING
        )

        # Ici on intégrera Orange Money / MTN MoMo plus tard
        # Pour l'instant on simule un paiement réussi
        payment.status = Payment.Status.SUCCESS
        payment.save(update_fields=['status'])

        return Response({
            'message': 'Paiement initié avec succès.',
            'payment': PaymentSerializer(payment).data
        }, status=status.HTTP_201_CREATED)