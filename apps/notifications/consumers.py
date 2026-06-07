import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket pour recevoir les notifications en temps réel.
    URL : ws://.../ws/notifications/
    Auth : le token JWT est passé en query param ?token=<access_token>
    """

    async def connect(self):
        user = await self._get_user()
        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        self.user       = user
        self.group_name = f"user_{user.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(json.dumps({'type': 'connected', 'message': 'Connecté aux notifications'}))

    async def disconnect(self, code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # Le client peut envoyer {"type": "ping"} pour tester la connexion
        try:
            data = json.loads(text_data or '{}')
            if data.get('type') == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    async def notification_message(self, event):
        """Appelé par channel_layer.group_send(..., {'type': 'notification.message', ...})"""
        await self.send(json.dumps({
            'type':    event.get('notification_type', 'system'),
            'title':   event.get('title', ''),
            'body':    event.get('body', ''),
            'data':    event.get('data', {}),
            'notif_id': event.get('notif_id', ''),
        }))

    @database_sync_to_async
    def _get_user(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from apps.accounts.models import User
        scope = self.scope
        # Récupérer le token depuis les query params
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token_str = params.get('token', [''])[0]
        if not token_str:
            return AnonymousUser()
        try:
            token = AccessToken(token_str)
            return User.objects.get(id=token['user_id'])
        except Exception:
            return AnonymousUser()
