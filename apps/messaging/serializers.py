from rest_framework import serializers
from .models import Conversation, Message
from apps.accounts.models import User


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)

    class Meta:
        model  = Message
        fields = ('id', 'conversation', 'sender', 'sender_name',
                  'content', 'msg_type', 'offer_amount_gnf', 'is_read', 'created_at')
        read_only_fields = ('id', 'sender', 'sender_name', 'is_read', 'created_at')


class ConversationSerializer(serializers.ModelSerializer):
    last_message    = serializers.SerializerMethodField()
    other_user      = serializers.SerializerMethodField()
    unread_count    = serializers.SerializerMethodField()
    listing_title   = serializers.CharField(source='listing.title', read_only=True)
    listing_price   = serializers.IntegerField(source='listing.price_gnf', read_only=True)

    class Meta:
        model  = Conversation
        fields = ('id', 'listing', 'listing_title', 'listing_price',
                  'buyer', 'seller', 'other_user', 'last_message',
                  'unread_count', 'last_message_at', 'created_at')
        read_only_fields = ('id', 'buyer', 'seller', 'created_at')

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'content': msg.content, 'created_at': msg.created_at}
        return None

    def get_other_user(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        user = request.user
        other = obj.seller if obj.buyer == user else obj.buyer
        return {'id': str(other.id), 'full_name': other.full_name}

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()


class StartConversationSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField()
    message    = serializers.CharField(max_length=1000)

    def validate_listing_id(self, value):
        from apps.listings.models import Listing
        try:
            listing = Listing.objects.get(id=value, status=Listing.Status.ACTIVE)
        except Listing.DoesNotExist:
            raise serializers.ValidationError("Annonce introuvable ou inactive.")
        self.listing = listing
        return value