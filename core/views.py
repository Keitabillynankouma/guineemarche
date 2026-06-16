import logging
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from django.conf import settings
from core.permissions import IsAdmin
from core.site_settings import SiteSettings

logger = logging.getLogger(__name__)


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SiteSettings
        fields = '__all__'


class SiteSettingsView(APIView):
    """
    GET  /api/v1/core/settings/  — lecture publique (frontend)
    PATCH /api/v1/core/settings/ — modification admin uniquement
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdmin()]

    def get(self, request):
        obj = SiteSettings.get()
        return Response(SiteSettingsSerializer(obj).data)

    def patch(self, request):
        obj = SiteSettings.get()
        serializer = SiteSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── Throttle spécifique pour le chatbot ───────────────────────────────────────

class SupportChatThrottle(AnonRateThrottle):
    rate = '200/hour'


class SupportChatUserThrottle(UserRateThrottle):
    rate = '500/hour'


# ── Support chatbot powered by Claude ─────────────────────────────────────────

SUPPORT_SYSTEM_PROMPT = """Tu es l'assistant virtuel de GuinéeMarché, la première marketplace en ligne de Guinée.
Tu réponds en français (ou en langue locale si l'utilisateur l'utilise).
Tu es serviable, poli et concis.

À propos de GuinéeMarché :
- Plateforme d'achat et vente en ligne basée en Guinée (Conakry)
- Les vendeurs publient des annonces (électronique, vêtements, mobilier, véhicules, immobilier, etc.)
- Les acheteurs contactent les vendeurs via messagerie intégrée
- Paiement via Orange Money ou en espèces (remise en main propre)
- Plans : Gratuit (3 annonces), Pro (15 annonces, boost), Business (illimité, boutique)
- Les annonces expirent après 30 jours (renouvelables)
- Les boosts mettent une annonce en avant pendant 7 jours

Ce que tu peux aider :
- Comment créer/modifier/supprimer une annonce
- Comment contacter un vendeur
- Comment payer (Orange Money ou espèces)
- Comment signaler un problème ou une arnaque
- Problèmes de compte (connexion, mot de passe, profil)
- Questions sur les plans et abonnements
- Programme de parrainage (code de parrainage = bonus d'annonces)

Ce que tu ne peux PAS faire :
- Accéder à des comptes utilisateurs spécifiques
- Rembourser ou annuler des transactions (rediriger vers le support humain)
- Résoudre des litiges complexes (rediriger vers support@guineemarche.com ou WhatsApp +224622411238)

Si tu ne sais pas, dis-le honnêtement et propose de contacter le support humain.
Garde tes réponses courtes (2-4 phrases max sauf si plus de détail est nécessaire)."""


class SupportChatView(APIView):
    """
    POST /api/v1/core/support-chat/
    Body: { "message": "...", "history": [{"role": "user"|"assistant", "content": "..."}] }
    """
    permission_classes = [AllowAny]
    throttle_classes   = [SupportChatThrottle, SupportChatUserThrottle]

    def post(self, request):
        message = (request.data.get('message') or '').strip()
        history = request.data.get('history', [])

        if not message:
            return Response({'error': 'Message vide'}, status=400)
        if len(message) > 1000:
            return Response({'error': 'Message trop long (max 1000 caractères)'}, status=400)

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
        if not api_key:
            return Response({'reply': "Le service de support automatique n'est pas encore configuré. Contactez-nous sur WhatsApp au +224622411238."})

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            # Construire l'historique (max 10 échanges pour limiter les coûts)
            messages = []
            for msg in history[-10:]:
                role = msg.get('role', '')
                content = str(msg.get('content', ''))
                if role in ('user', 'assistant') and content:
                    messages.append({'role': role, 'content': content})
            messages.append({'role': 'user', 'content': message})

            response = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=512,
                system=SUPPORT_SYSTEM_PROMPT,
                messages=messages,
            )
            reply = response.content[0].text
            return Response({'reply': reply})

        except Exception as exc:
            logger.error("Support chat error: %s", exc)
            return Response({'reply': "Une erreur est survenue. Contactez-nous sur WhatsApp au +224622411238."}, status=200)
