import uuid
import logging
from django.conf import settings
from phonenumbers import data

logger = logging.getLogger(__name__)


class PaymentResult:
    def __init__(self, success: bool, reference: str = '', message: str = '', payment_url: str = ''):
        self.success     = success
        self.reference   = reference
        self.message     = message
        self.payment_url = payment_url  # URL hosted payment (carte Visa)


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


def initiate_paycard(phone: str, amount: int, order_id: str, network: str) -> PaymentResult:
    """
    Paycard Guinée — agrégateur Mobile Money (Orange Money GN + MTN MoMo GN).
    network : 'ORANGE_GN' ou 'MTN_GN'

    Variables Railway requises (à configurer quand tu reçois les clés) :
        PAYCARD_API_KEY      — clé API fournie par Paycard
        PAYCARD_SECRET_KEY   — clé secrète pour signature des webhooks
        PAYCARD_MERCHANT_ID  — identifiant marchand
        PAYCARD_SANDBOX      — 'true' en test, 'false' en production

    Docs Paycard : https://paycard.africa/developers
    """
    api_key     = getattr(settings, 'PAYCARD_API_KEY', '')
    merchant_id = getattr(settings, 'PAYCARD_MERCHANT_ID', '')

    # Pas de clé configurée → simulation (mode test sans API)
    if not api_key or not merchant_id:
        logger.info("[PAYCARD] Clés non configurées → simulation activée")
        return _simulate_payment('paycard', phone, amount)

    is_sandbox = getattr(settings, 'PAYCARD_SANDBOX', getattr(settings, 'DEBUG', True))
    # TODO: remplacer par l'URL réelle Paycard quand disponible
    base_url   = 'https://sandbox.paycard.africa/api/v1' if is_sandbox else 'https://api.paycard.africa/api/v1'

    try:
        import requests, hashlib, hmac as _hmac, time
        secret_key = getattr(settings, 'PAYCARD_SECRET_KEY', '')
        timestamp  = str(int(time.time()))
        ref        = f"GM-{order_id[:8].upper()}"

        # Signature HMAC-SHA256 : timestamp + merchant_id + amount + ref
        payload_str = f"{timestamp}{merchant_id}{amount}{ref}"
        signature   = _hmac.new(
            secret_key.encode(), payload_str.encode(), hashlib.sha256
        ).hexdigest() if secret_key else ''

        resp = requests.post(
            f'{base_url}/payments/initiate',
            json={
                'merchant_id':  merchant_id,
                'reference':    ref,
                'amount':       amount,
                'currency':     'GNF',
                'phone':        phone,
                'network':      network,          # 'ORANGE_GN' ou 'MTN_GN'
                'description':  f'Guimatrix {ref}',
                'callback_url': getattr(settings, 'PAYCARD_WEBHOOK_URL', ''),
                'timestamp':    timestamp,
                'signature':    signature,
            },
            headers={
                'X-Api-Key':    api_key,
                'Content-Type': 'application/json',
            },
            timeout=20,
        )
        data = resp.json()
        if resp.status_code in (200, 201) and data.get('status') in ('success', 'PENDING', 'INITIATED'):
            return PaymentResult(
                success=True,
                reference=data.get('transaction_id', ref),
                message=data.get('message', 'Paiement Paycard initié'),
            )
        err = data.get('message') or data.get('error') or 'Erreur Paycard'
        logger.warning("[PAYCARD] Échec initiation: %s", err)
        return PaymentResult(success=False, message=err)
    except Exception as exc:
        logger.error("[PAYCARD] Erreur API: %s", exc)
        return _simulate_payment('paycard', phone, amount)


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
                'payerMessage': 'Paiement Guimatrix',
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


def initiate_paycard_card(amount: int, order_id: str, customer_email: str = '', customer_name: str = '') -> PaymentResult:
    """
    Paycard Guinée — paiement par carte Visa/Mastercard.
    Retourne une URL vers la page de paiement hébergée Paycard (hosted checkout).
    Le client est redirigé vers cette page pour entrer ses données de carte.
    La confirmation se fait via webhook POST /orders/webhook/paycard/card/

    Variables Railway requises :
        PAYCARD_API_KEY      — clé API
        PAYCARD_SECRET_KEY   — clé secrète signature
        PAYCARD_MERCHANT_ID  — identifiant marchand
        PAYCARD_SANDBOX      — 'true' en test
        PAYCARD_CARD_RETURN_URL — URL de retour après paiement (ex: https://guimatrix.com/orders)
        PAYCARD_WEBHOOK_URL  — URL webhook Railway

    TODO : adapter les champs selon la doc Paycard officielle pour les cartes.
    Docs : https://paycard.africa/developers
    """
    api_key     = getattr(settings, 'PAYCARD_API_KEY', '')
    merchant_id = getattr(settings, 'PAYCARD_MERCHANT_ID', '')

    # Sans clé → URL de simulation locale
    if not api_key or not merchant_id:
        logger.info("[PAYCARD CARD] Clés non configurées → URL simulation")
        sim_ref = f"SIM-CARD-{uuid.uuid4().hex[:8].upper()}"
        return PaymentResult(
            success=True,
            reference=sim_ref,
            message="Paiement carte simulé (mode test)",
            payment_url=f"https://sandbox.paycard.africa/checkout/sim/{sim_ref}",
        )

    is_sandbox  = getattr(settings, 'PAYCARD_SANDBOX', True)
    base_url    = 'https://sandbox.paycard.africa/api/v1' if is_sandbox else 'https://api.paycard.africa/api/v1'
    ref         = f"GM-{order_id[:8].upper()}"
    return_url  = getattr(settings, 'PAYCARD_CARD_RETURN_URL', 'https://guimatrix.com/orders')
    webhook_url = getattr(settings, 'PAYCARD_WEBHOOK_URL', 'https://api.guimatrix.com/api/v1/orders/webhook/paycard/card/')

    try:
        import requests, hashlib, hmac as _hmac, time
        secret_key = getattr(settings, 'PAYCARD_SECRET_KEY', '')
        timestamp  = str(int(time.time()))

        payload_str = f"{timestamp}{merchant_id}{amount}{ref}"
        signature   = _hmac.new(
            secret_key.encode(), payload_str.encode(), hashlib.sha256
        ).hexdigest() if secret_key else ''

        resp = requests.post(
            f'{base_url}/checkout/create',
            json={
                'merchant_id':    merchant_id,
                'reference':      ref,
                'amount':         amount,
                'currency':       'GNF',
                'payment_method': 'card',          # Visa / Mastercard
                'description':    f'Guimatrix {ref}',
                'customer_email': customer_email,
                'customer_name':  customer_name,
                'return_url':     return_url,
                'webhook_url':    webhook_url,
                'timestamp':      timestamp,
                'signature':      signature,
            },
            headers={
                'X-Api-Key':    api_key,
                'Content-Type': 'application/json',
            },
            timeout=20,
        )
        data = resp.json()
        payment_url = data.get('checkout_url') or data.get('payment_url', '')
        if resp.status_code in (200, 201) and payment_url:
            return PaymentResult(
                success=True,
                reference=data.get('transaction_id', ref),
                message='Redirection vers la page de paiement Visa',
                payment_url=payment_url,
            )
        err = data.get('message') or data.get('error') or 'Erreur Paycard carte'
        logger.warning("[PAYCARD CARD] Échec création checkout: %s", err)
        return PaymentResult(success=False, message=err)
    except Exception as exc:
        logger.error("[PAYCARD CARD] Erreur API: %s", exc)
        sim_ref = f"SIM-CARD-{uuid.uuid4().hex[:8].upper()}"
        return PaymentResult(
            success=True,
            reference=sim_ref,
            message="Paiement carte simulé (erreur API)",
            payment_url=f"https://sandbox.paycard.africa/checkout/sim/{sim_ref}",
        )
