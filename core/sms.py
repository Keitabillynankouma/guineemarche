from django.conf import settings
import logging
import base64
import urllib.request
import urllib.error
import json

logger = logging.getLogger(__name__)

NIMBA_API_URL = 'https://api.nimbasms.com/v1/messages'


def send_sms(to: str, body: str) -> bool:
    """Envoie un SMS via Nimba SMS (fournisseur guinéen)."""
    service_id   = getattr(settings, 'NIMBA_SERVICE_ID', '')
    secret_token = getattr(settings, 'NIMBA_SECRET_TOKEN', '')
    sender_name  = getattr(settings, 'NIMBA_SENDER_NAME', 'Guimatrix')

    if not all([service_id, secret_token]):
        logger.warning("Nimba SMS non configuré — SMS non envoyé à %s", to)
        return False

    try:
        # Basic Auth : base64(service_id:secret_token)
        credentials = base64.b64encode(f"{service_id}:{secret_token}".encode()).decode()

        payload = json.dumps({
            "sender_name": sender_name,
            "to": [str(to)],
            "message": body,
            "channel": "sms",
        }).encode('utf-8')

        req = urllib.request.Request(
            NIMBA_API_URL,
            data=payload,
            headers={
                'Authorization': f'Basic {credentials}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            if status == 201:
                logger.info("SMS Nimba envoyé à %s", to)
                return True
            logger.warning("Nimba SMS — statut inattendu %s pour %s", status, to)
            return False

    except urllib.error.HTTPError as exc:
        body_err = exc.read().decode('utf-8', errors='replace')
        logger.error("Nimba SMS HTTPError %s pour %s : %s", exc.code, to, body_err)
        return False
    except Exception as exc:
        logger.error("Nimba SMS — échec envoi à %s : %s", to, exc)
        return False


def send_otp_sms(phone_number: str, code: str) -> bool:
    body = f"[Guimatrix] Votre code de vérification est : {code}\nValide 10 minutes."
    return send_sms(to=phone_number, body=body)


def send_order_sms_seller(order) -> bool:
    """Alerte SMS au vendeur quand une nouvelle commande est passée."""
    if not order.seller.phone_number:
        return False
    amount = f"{order.amount_gnf:,}".replace(',', ' ')
    body = (
        f"[Guimatrix] Nouvelle commande !\n"
        f"Article : {order.listing.title}\n"
        f"Acheteur : {order.buyer.full_name}\n"
        f"Montant : {amount} GNF\n"
        f"Mode : {order.get_delivery_mode_display()}\n"
        f"Connectez-vous pour confirmer."
    )
    return send_sms(to=str(order.seller.phone_number), body=body)


def send_order_sms_buyer(order) -> bool:
    """Confirmation SMS à l'acheteur après passage de commande."""
    if not order.buyer.phone_number:
        return False
    amount = f"{order.amount_gnf:,}".replace(',', ' ')
    body = (
        f"[Guimatrix] Commande enregistrée !\n"
        f"Article : {order.listing.title}\n"
        f"Vendeur : {order.seller.full_name}\n"
        f"Montant : {amount} GNF\n"
        f"Vous serez alerté dès confirmation."
    )
    return send_sms(to=str(order.buyer.phone_number), body=body)
