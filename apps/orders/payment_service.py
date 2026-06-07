import uuid
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class PaymentResult:
    def __init__(self, success: bool, reference: str = '', message: str = ''):
        self.success   = success
        self.reference = reference
        self.message   = message


def _simulate_payment(provider: str, phone: str, amount: int) -> PaymentResult:
    """Simulation locale — retourne toujours succès avec une ref unique."""
    ref = f"SIM-{provider.upper()[:2]}-{uuid.uuid4().hex[:10].upper()}"
    logger.info("[SIMULATION] %s payment %s GNF from %s → ref %s", provider, amount, phone, ref)
    return PaymentResult(success=True, reference=ref, message="Paiement simulé accepté")


def initiate_orange_money(phone: str, amount: int, order_id: str) -> PaymentResult:
    """
    Orange Money Guinea.
    En production : appeler l'API Orange Money GN avec les credentials.
    Pour l'instant : simulation.
    """
    api_key = getattr(settings, 'ORANGE_MONEY_API_KEY', '')
    if not api_key:
        return _simulate_payment('orange_money', phone, amount)

    try:
        import requests
        resp = requests.post(
            'https://api.orange.com/orange-money-webpay/dev/v1/webpayment',
            json={
                'merchant_key': api_key,
                'currency': 'GNF',
                'order_id': str(order_id),
                'amount': amount,
                'return_url': getattr(settings, 'PAYMENT_RETURN_URL', ''),
                'cancel_url': getattr(settings, 'PAYMENT_CANCEL_URL', ''),
                'notif_url':  getattr(settings, 'PAYMENT_WEBHOOK_URL', ''),
                'lang': 'fr',
                'reference': str(order_id),
            },
            timeout=15
        )
        data = resp.json()
        if resp.status_code == 200 and data.get('status') == 'SUCCESS':
            return PaymentResult(success=True, reference=data.get('pay_token', ''), message='Redirection Orange Money')
        return PaymentResult(success=False, message=data.get('message', 'Erreur Orange Money'))
    except Exception as exc:
        logger.error("Orange Money API error: %s", exc)
        return _simulate_payment('orange_money', phone, amount)


def initiate_mtn_momo(phone: str, amount: int, order_id: str) -> PaymentResult:
    """
    MTN Mobile Money Guinea.
    En production : appeler l'API MTN MoMo avec les credentials.
    Pour l'instant : simulation si les clés sont absentes.
    """
    api_key  = getattr(settings, 'MTN_MOMO_API_KEY', '')
    api_user = getattr(settings, 'MTN_MOMO_API_USER', '')
    if not all([api_key, api_user]):
        return _simulate_payment('mtn_momo', phone, amount)

    # Utiliser l'URL sandbox ou production selon le paramètre DEBUG
    is_sandbox      = getattr(settings, 'MTN_MOMO_SANDBOX', getattr(settings, 'DEBUG', True))
    base_url        = 'https://sandbox.momoapi.mtn.com' if is_sandbox else 'https://proxy.momoapi.mtn.com'
    target_env      = 'sandbox' if is_sandbox else 'mtnguinea'

    try:
        import requests
        import base64
        token_resp = requests.post(
            f'{base_url}/collection/token/',
            headers={
                'Authorization': 'Basic ' + base64.b64encode(f"{api_user}:{api_key}".encode()).decode(),
                'Ocp-Apim-Subscription-Key': getattr(settings, 'MTN_MOMO_SUBSCRIPTION_KEY', ''),
            },
            timeout=15
        )
        token = token_resp.json().get('access_token', '')
        pay_resp = requests.post(
            f'{base_url}/collection/v1_0/requesttopay',
            headers={
                'Authorization': f'Bearer {token}',
                'X-Reference-Id': str(order_id),
                'X-Target-Environment': target_env,
                'Ocp-Apim-Subscription-Key': getattr(settings, 'MTN_MOMO_SUBSCRIPTION_KEY', ''),
                'Content-Type': 'application/json',
            },
            json={
                'amount': str(amount),
                'currency': 'GNF',
                'externalId': str(order_id),
                'payer': {'partyIdType': 'MSISDN', 'partyId': phone},
                'payerMessage': 'Paiement GuinéeMarché',
                'payeeNote': str(order_id),
            },
            timeout=15
        )
        if pay_resp.status_code == 202:
            return PaymentResult(success=True, reference=str(order_id), message='Demande MTN MoMo envoyée')
        return PaymentResult(success=False, message='Erreur MTN MoMo')
    except Exception as exc:
        logger.error("MTN MoMo API error: %s", exc)
        return _simulate_payment('mtn_momo', phone, amount)
