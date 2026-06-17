from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def send_sms(to: str, body: str) -> bool:
    username = getattr(settings, 'AT_USERNAME', '')
    api_key  = getattr(settings, 'AT_API_KEY', '')

    if not all([username, api_key]):
        logger.warning("Africa's Talking non configuré — SMS non envoyé à %s", to)
        return False

    try:
        import africastalking
        africastalking.initialize(username, api_key)
        sms = africastalking.SMS
        sender = getattr(settings, 'AT_SENDER_ID', None) or None
        response = sms.send(body, [str(to)], sender)
        recipients = response.get('SMSMessageData', {}).get('Recipients', [])
        if recipients and recipients[0].get('statusCode') == 101:
            logger.info("SMS envoyé à %s", to)
            return True
        logger.warning("Réponse AT inattendue pour %s: %s", to, response)
        return False
    except Exception as exc:
        logger.error("Échec envoi SMS à %s: %s", to, exc)
        return False


def send_otp_sms(phone_number: str, code: str) -> bool:
    body = f"[Guimatrix] Votre code de vérification est : {code}\nValide 10 minutes."
    return send_sms(to=phone_number, body=body)
