from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.shortcuts import get_object_or_404

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer, MessageSerializer, StartConversationSerializer
)


class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ConversationSerializer

    def get_queryset(self):
        user = self.request.user
        return Conversation.objects.filter(
            buyer=user
        ).union(
            Conversation.objects.filter(seller=user)
        ).order_by('-last_message_at')


class StartConversationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StartConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        listing = serializer.listing
        buyer   = request.user

        if buyer == listing.seller:
            return Response(
                {'error': 'Vous ne pouvez pas contacter votre propre annonce.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        conversation, created = Conversation.objects.get_or_create(
            listing=listing,
            buyer=buyer,
            seller=listing.seller
        )

        message = Message.objects.create(
            conversation=conversation,
            sender=buyer,
            content=serializer.validated_data['message'],
            msg_type=Message.MsgType.TEXT
        )

        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at'])

        return Response({
            'conversation': ConversationSerializer(
                conversation, context={'request': request}
            ).data,
            'message': MessageSerializer(message).data,
        }, status=status.HTTP_201_CREATED)


class MessageListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = MessageSerializer

    def get_queryset(self):
        conversation_id = self.kwargs['conversation_id']
        user = self.request.user
        conversation = get_object_or_404(
            Conversation,
            id=conversation_id
        )
        if user not in [conversation.buyer, conversation.seller]:
            return Message.objects.none()

        # Marquer les messages comme lus
        conversation.messages.filter(
            is_read=False
        ).exclude(sender=user).update(is_read=True)

        return conversation.messages.all()


class SendMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id)
        user = request.user

        if user not in [conversation.buyer, conversation.seller]:
            return Response(
                {'error': 'Accès refusé.'},
                status=status.HTTP_403_FORBIDDEN
            )

        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=request.data.get('content', ''),
            msg_type=request.data.get('msg_type', Message.MsgType.TEXT),
            offer_amount_gnf=request.data.get('offer_amount_gnf')
        )

        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at'])

        return Response(
            MessageSerializer(message).data,
            status=status.HTTP_201_CREATED
        )