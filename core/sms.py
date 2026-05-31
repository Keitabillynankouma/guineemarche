from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_sms(to: str, body: str) -> bool:
    """Envoie un SMS via Twilio. Retourne True si succès, False sinon."""
    sid    = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
    token  = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
    from_  = getattr(settings, 'TWILIO_PHONE_NUMBER', '')

    if not all([sid, token, from_]):
        logger.warning("Twilio non configuré — SMS non envoyé à %s: %s", to, body)
        return False

    try:
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(body=body, from_=from_, to=str(to))
        logger.info("SMS envoyé à %s", to)
        return True
    except Exception as exc:
        logger.error("Échec envoi SMS à %s: %s", to, exc)
        return False


def send_otp_sms(phone_number: str, code: str) -> bool:
    body = f"[GuinéeMarché] Votre code de vérification est : {code}\nValide 10 minutes."
    return send_sms(to=phone_number, body=body)
