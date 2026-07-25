from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import UserRateThrottle
from django.utils import timezone
from django.shortcuts import get_object_or_404


class MessageSendThrottle(UserRateThrottle):
    """Limite l'envoi de messages à 60/heure par utilisateur (anti-spam)."""
    scope = 'message_send'
    rate  = '60/hour'

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer, MessageSerializer, StartConversationSerializer
)


class ConversationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ConversationSerializer

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        return Conversation.objects.filter(
            Q(buyer=user) | Q(seller=user)
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
    throttle_classes   = [MessageSendThrottle]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id)
        user = request.user

        if user not in [conversation.buyer, conversation.seller]:
            return Response(
                {'error': 'Accès refusé.'},
                status=status.HTTP_403_FORBIDDEN
            )

        content  = request.data.get('content', '')
        msg_type = request.data.get('msg_type', Message.MsgType.TEXT)

        # ── Agent sécurité chat (heuristiques + Claude Haiku) ─────────────────
        if msg_type == Message.MsgType.TEXT and content:
            try:
                from core.chat_safety_agent import analyze_message_safety
                safety = analyze_message_safety(content, sender=user, conversation=conversation)
                if safety['action'] == 'block':
                    return Response(
                        {'error': safety['user_message'] or 'Message bloqué pour raison de sécurité.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if safety['action'] == 'warn':
                    # On laisse passer mais on ajoute un avertissement dans la réponse
                    # Le frontend pourra afficher une bannière au-dessus du message
                    safety_warning = safety['user_message']
                else:
                    safety_warning = None
            except Exception:
                safety_warning = None
        else:
            safety_warning = None

        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            content=content,
            msg_type=msg_type,
            offer_amount_gnf=request.data.get('offer_amount_gnf')
        )

        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=['last_message_at'])

        response_data = MessageSerializer(message).data
        if safety_warning:
            response_data['safety_warning'] = safety_warning

        return Response(response_data, status=status.HTTP_201_CREATED)