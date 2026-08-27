import uuid
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

CHACHAP_API_URL = 'https://chapchappay.com'


def initiate_chachap(amount: int, order_id: str) -> 'PaymentResult':
    """
    ChaChap Pay — agrégateur guinéen agréé BCRG.
    Crée une opération E-Commerce et retourne le lien de paiement hébergé.
    L'utilisateur est redirigé vers ce lien et choisit son mode (OM, MTN, PayCard, Kulu, Soutra…).
    La confirmation se fait via webhook POST /orders/webhook/chachap/

    Variables Railway requises :
        CHACHAP_API_KEY     — clé API ChaChap Pay (64 chars hex)
        CHACHAP_WEBHOOK_URL — URL de votre webhook (ex: https://api.guimatrix.com/api/v1/orders/webhook/chachap/)
    """
    api_key     = getattr(settings, 'CHACHAP_API_KEY', '').strip()
    webhook_url = getattr(settings, 'CHACHAP_WEBHOOK_URL',
                          'https://api.guimatrix.com/api/v1/orders/webhook/chachap/').strip()

    logger.info("[CHACHAP] Clé API présente: %s, longueur: %d", bool(api_key), len(api_key))

    # Sans clé → simulation avec URL de redirection factice
    if not api_key:
        # En simulation, on utilise order_id comme référence pour que le webhook
        # puisse retrouver le paiement via Payment.objects.filter(order__id=ref)
        sim_ref = str(order_id)
        logger.info("[CHACHAP] Clé API absente — simulation (ref=order_id=%s)", sim_ref)
        return PaymentResult(
            success=True,
            reference=sim_ref,
            message="Paiement ChaChap Pay simulé (mode test)",
            payment_url=f"https://chapchappay.com/pay/sim-{uuid.uuid4().hex[:12]}",
        )

    try:
        import requests
        # Body selon la doc officielle : amount + notify_url uniquement
        body = {'amount': amount}
        if webhook_url:
            body['notify_url'] = webhook_url

        # Endpoint réel vérifié en prod : /api/ecommerce/create
        # (la doc indique /api/ecommerce/operation mais c'est incorrect)
        resp = requests.post(
            f'{CHACHAP_API_URL}/api/ecommerce/create',
            json=body,
            headers={
                'CCP-Api-Key':  api_key,
                'Content-Type': 'application/json',
                'Accept':       'application/json',
            },
            timeout=20,
        )

        logger.info("[CHACHAP] Réponse HTTP %s — body brut: %s", resp.status_code, resp.text[:500])
        try:
            data = resp.json()
        except Exception:
            logger.error("[CHACHAP] Réponse non-JSON (status=%s): %s", resp.status_code, resp.text[:300])
            return PaymentResult(success=False, message=f"ChaChap Pay : réponse invalide (HTTP {resp.status_code})")

        payment_url = data.get('payment_url', '')
        operation_id = data.get('operation_id', '')

        if resp.status_code in (200, 201) and payment_url:
            logger.info("[CHACHAP] Opération créée — operation_id=%s amount=%s GNF", operation_id, amount)
            return PaymentResult(
                success=True,
                reference=operation_id,
                message='Redirection vers ChaChap Pay',
                payment_url=payment_url,
            )

        err = data.get('error') or data.get('message') or f'Erreur HTTP {resp.status_code}'
        logger.warning("[CHACHAP] Échec création opération (HTTP %s): %s | body=%s", resp.status_code, err, data)
        return PaymentResult(success=False, message=f"ChaChap Pay : {err}")

    except Exception as exc:
        logger.error("[CHACHAP] Erreur API: %s", exc)
        return PaymentResult(success=False, message=f"ChaChap Pay : erreur réseau ({exc})")


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


def disburse_to_livreur(weekly_payout_id: str) -> PaymentResult:
    """
    Déclenche le virement hebdomadaire vers un livreur.

    Flux :
    1. Charge le LivreurWeeklyPayout depuis la DB.
    2. Si le livreur a un numéro mobile money → appel ChaChaP B2C.
    3. Sinon → note admin pour virement manuel.

    À appeler par :
    - L'action admin "Déclencher le virement" dans LivreurWeeklyPayoutAdmin
    - La tâche Celery weekly_livreur_payouts (option auto-disburse)
    """
    from apps.orders.models import LivreurWeeklyPayout
    from django.utils import timezone

    try:
        payout = LivreurWeeklyPayout.objects.select_related('livreur').get(pk=weekly_payout_id)
    except LivreurWeeklyPayout.DoesNotExist:
        logger.error("[LIVREUR PAYOUT] LivreurWeeklyPayout %s introuvable", weekly_payout_id)
        return PaymentResult(success=False, message="Payout introuvable")

    if payout.status == LivreurWeeklyPayout.Status.PAID:
        logger.info("[LIVREUR PAYOUT] %s déjà versé, ignoré", weekly_payout_id)
        return PaymentResult(success=True, reference=payout.payment_ref, message="Déjà versé")

    amount  = payout.net_gnf
    livreur = payout.livreur
    phone   = livreur.payout_phone
    provider = livreur.payout_provider

    # Normalisation : uniquement pour les opérateurs téléphoniques (OM, MTN…)
    # PayCard utilise un numéro de compte → ne pas ajouter le préfixe 224
    if phone:
        phone = phone.replace(' ', '').replace('-', '')
        if provider != 'paycard':
            if phone.startswith('+'):
                phone = phone[1:]
            elif phone.startswith('00224'):
                phone = phone[2:]
            elif not phone.startswith('224'):
                phone = '224' + phone

    logger.info("[LIVREUR PAYOUT] Démarrage virement %s → %s GNF sur %s (%s) pour %s",
                weekly_payout_id, amount, phone, provider, livreur.full_name)

    # ── Cas 1 : Pas de numéro → traitement manuel admin ──────────────────────
    if not phone:
        payout.note = "Aucun numéro mobile money enregistré — virement manuel requis"
        payout.save(update_fields=['note', 'updated_at'])
        logger.warning("[LIVREUR PAYOUT] %s — numéro absent pour %s", weekly_payout_id, livreur.full_name)
        return PaymentResult(success=False, message=f"Numéro mobile money manquant pour {livreur.full_name}")

    # ── Minimum ChapChap Push API : 5 000 GNF ───────────────────────────────────
    CHACHAP_MIN_LIV = 5_000
    if amount < CHACHAP_MIN_LIV:
        msg_min_liv = (
            f"Montant {amount:,} GNF insuffisant — ChapChap exige un minimum de "
            f"{CHACHAP_MIN_LIV:,} GNF. Virement à effectuer manuellement."
        )
        logger.warning("[LIVREUR PAYOUT] %s — montant %s GNF < minimum %s GNF", weekly_payout_id, amount, CHACHAP_MIN_LIV)
        return PaymentResult(success=False, message=msg_min_liv)

    # ── Cas 2 : ChaChaP PUSH API — envoi direct vers OM / MTN / PayCard… ────────
    api_key     = getattr(settings, 'CHACHAP_API_KEY', '')
    encrypt_key = getattr(settings, 'CHACHAP_ENCRYPT_KEY', '')
    access_code = getattr(settings, 'CHACHAP_AGENT_ACCESS_CODE', '')
    if api_key and access_code:
        try:
            import requests as _req, json as _json2, hmac as _hmac2, hashlib as _hs2
            _ch_map2 = {
                'orange_money': 'orange_money', 'mtn_momo': 'mtn_momo',
                'mtn': 'mtn_momo', 'paycard': 'paycard',
                'kulu': 'kulu', 'soutra_money': 'soutra_money', 'akiba': 'akiba',
            }
            _channel2    = _ch_map2.get(provider or '', 'orange_money')
            _notify_url2 = getattr(settings, 'CHACHAP_PAYOUT_WEBHOOK_URL',
                                   'https://guineemarche.onrender.com/api/v1/orders/webhook/chachap/payout/')
            _body2 = {
                'account_number':  phone,
                'amount':          amount,
                'payment_channel': _channel2,
                'account_name':    livreur.full_name,
                'notify_url':      _notify_url2,
                'order_id':        f'LIV-{str(weekly_payout_id)[:8].upper()}',
            }
            _body2_bytes = _json2.dumps(_body2, separators=(',', ':')).encode()
            _headers2 = {'CCP-Api-Key': api_key, 'Content-Type': 'application/json'}
            if encrypt_key:
                _sig2 = _hmac2.new(encrypt_key.encode(), _body2_bytes, _hs2.sha256).hexdigest()
                _headers2['CCP-HMAC-Signature'] = _sig2
            _url2 = f'{CHACHAP_API_URL}/api/push/{access_code}/request'
            resp  = _req.post(_url2, data=_body2_bytes, headers=_headers2, timeout=20)
            raw2  = resp.text.strip()
            logger.info("[LIVREUR PAYOUT] Push HTTP %s — raw: %.300s", resp.status_code, raw2)
            try:
                data = _json2.loads(raw2)
                if not isinstance(data, dict):
                    data = {}
            except Exception:
                data = {}
            http_ok    = resp.status_code in (200, 201, 202)
            request_id = data.get('request_id', '')
            status2_   = data.get('status', '')
            if http_ok and request_id:
                if status2_ == 'success':
                    payout.status         = LivreurWeeklyPayout.Status.PAID
                    payout.paid_at        = timezone.now()
                    payout.payment_ref    = request_id
                    payout.payment_method = provider
                    payout.note           = f"Push ChaChaP exécuté (id={request_id})"
                    payout.save(update_fields=['status', 'paid_at', 'payment_ref', 'payment_method', 'note', 'updated_at'])
                    logger.info("[LIVREUR PAYOUT] %s → push exécuté id=%s", weekly_payout_id, request_id)
                else:
                    payout.payment_ref    = request_id
                    payout.payment_method = provider
                    payout.note           = f"Push ChaChaP soumis (id={request_id}, status={status2_})"
                    payout.save(update_fields=['payment_ref', 'payment_method', 'note', 'updated_at'])
                    logger.info("[LIVREUR PAYOUT] %s → push soumis id=%s status=%s", weekly_payout_id, request_id, status2_)
                return PaymentResult(success=True, reference=request_id, message=f"Push ChaChaP {status2_}")

            err = data.get('message') or data.get('error') or f'HTTP {resp.status_code}'
            logger.warning("[LIVREUR PAYOUT] Push ChaChaP échoué: %s", err)
            payout.note = f"Push ChaChaP échoué: {err}"
            payout.save(update_fields=['note', 'updated_at'])
            return PaymentResult(success=False, message=f"Push ChaChaP: {err}")
        except Exception as exc:
            logger.error("[LIVREUR PAYOUT] ChaChaP B2C exception: %s", exc)
            payout.note = f"Exception virement: {exc}"
            payout.save(update_fields=['note', 'updated_at'])
            return PaymentResult(success=False, message=str(exc))

    # ── Cas 3 : Pas de clé API → simulation / attente manuelle ───────────────
    sim_ref = f"SIM-LIV-{uuid.uuid4().hex[:10].upper()}"
    logger.info("[LIVREUR PAYOUT] Simulation virement %s → ref %s", weekly_payout_id, sim_ref)
    payout.note = f"Simulation — virement manuel de {amount:,} GNF vers {phone} ({provider}) requis"
    payout.save(update_fields=['note', 'updated_at'])
    return PaymentResult(
        success=True,
        reference=sim_ref,
        message=f"Simulation : virement de {amount:,} GNF vers {phone} à effectuer manuellement",
    )


def _notify_payout_failure(payout, error_msg: str) -> None:
    """Notifie l'admin ET le vendeur quand un virement automatique échoue."""
    try:
        from apps.notifications.models import Notification
        from apps.accounts.models import User
        seller = payout.seller
        # Notifier le vendeur
        Notification.send(
            user=seller,
            type=Notification.Type.ORDER_UPDATE,
            title='⚠️ Virement échoué',
            body=f'Le virement de {payout.amount_gnf:,} GNF a échoué. '
                 f'Vérifiez votre numéro de paiement dans votre profil ou contactez le support.',
            data={'payout_id': str(payout.id)},
        )
        # Notifier les admins comptables
        admins = User.objects.filter(
            role__in=['admin', 'super_admin', 'admin_accounting'], is_active=True
        )
        for adm in admins[:3]:
            Notification.send(
                user=adm,
                type=Notification.Type.ORDER_UPDATE,
                title='❌ Payout vendeur échoué',
                body=f'Virement {payout.id} ({payout.amount_gnf:,} GNF) pour {seller.full_name} '
                     f'a échoué : {error_msg}. Action manuelle requise.',
                data={'payout_id': str(payout.id)},
            )
    except Exception as exc:
        logger.warning("[PAYOUT] Notification échec virement impossible : %s", exc)


def disburse_to_seller(payout_id: str) -> PaymentResult:
    """
    Déclenche le versement au vendeur après libération de l'escrow.

    Flux :
    1. Charge le SellerPayout depuis la DB.
    2. Si le vendeur a un numéro mobile money → appel ChaChaP B2C (quand disponible).
    3. Sinon → marque comme PENDING MANUAL pour traitement admin.

    À appeler par :
    - La tâche Celery `apps.orders.tasks.process_seller_payout`
    - L'action admin "Déclencher le virement"
    """
    from apps.orders.models import SellerPayout

    try:
        payout = SellerPayout.objects.select_related('seller', 'order').get(pk=payout_id)
    except SellerPayout.DoesNotExist:
        logger.error("[PAYOUT] SellerPayout %s introuvable", payout_id)
        return PaymentResult(success=False, message="Payout introuvable")

    if payout.status == SellerPayout.Status.COMPLETED:
        logger.info("[PAYOUT] %s déjà versé, ignoré", payout_id)
        return PaymentResult(success=True, reference=payout.external_ref, message="Déjà versé")

    amount = payout.amount_gnf
    phone  = payout.payout_phone

    # Normalisation : uniquement pour les opérateurs téléphoniques (OM, MTN…)
    # PayCard utilise un numéro de compte, pas un numéro de téléphone → pas de préfixe 224
    if phone:
        phone = phone.replace(' ', '').replace('-', '')
        if payout.provider != 'paycard':
            if phone.startswith('+'):
                phone = phone[1:]          # +224XXXXXX → 224XXXXXX
            elif phone.startswith('00224'):
                phone = phone[2:]          # 00224XXXXXX → 224XXXXXX
            elif not phone.startswith('224'):
                phone = '224' + phone      # 6XXXXXXXX → 2246XXXXXXXX

    logger.info("[PAYOUT] Démarrage versement %s → %s GNF sur %s (%s)",
                payout_id, amount, phone, payout.provider)

    # ── Cas 1 : Pas de numéro → traitement manuel admin ──────────────────────
    if not phone:
        payout.admin_note = "Aucun numéro mobile money enregistré — versement manuel requis"
        payout.save(update_fields=['admin_note', 'updated_at'])
        logger.warning("[PAYOUT] %s — numéro absent, versement manuel nécessaire", payout_id)
        return PaymentResult(success=False, message="Numéro mobile money manquant — versement manuel")

    # ── Minimum ChapChap Push API : 5 000 GNF ───────────────────────────────────
    CHACHAP_MIN_AMOUNT = 5_000
    if amount < CHACHAP_MIN_AMOUNT:
        msg_min = (
            f"Montant {amount:,} GNF insuffisant — ChapChap exige un minimum de "
            f"{CHACHAP_MIN_AMOUNT:,} GNF. Virement à effectuer manuellement."
        )
        payout.admin_note = msg_min
        payout.save(update_fields=['admin_note', 'updated_at'])
        logger.warning("[PAYOUT] %s — montant %s GNF < minimum %s GNF", payout_id, amount, CHACHAP_MIN_AMOUNT)
        return PaymentResult(success=False, message=msg_min)

    # ── Cas 2 : ChaChaP PUSH API — envoi direct vers OM / MTN / PayCard / Kulu… ─
    api_key     = getattr(settings, 'CHACHAP_API_KEY', '')
    encrypt_key = getattr(settings, 'CHACHAP_ENCRYPT_KEY', '')
    access_code = getattr(settings, 'CHACHAP_AGENT_ACCESS_CODE', '')
    if api_key and access_code:
        try:
            import requests as _req, json as _json, hmac as _hmac, hashlib as _hs
            _ch_map = {
                'orange_money': 'orange_money', 'mtn_momo': 'mtn_momo',
                'mtn': 'mtn_momo', 'paycard': 'paycard',
                'kulu': 'kulu', 'soutra_money': 'soutra_money', 'akiba': 'akiba',
            }
            _channel    = _ch_map.get(payout.provider or '', 'orange_money')
            _notify_url = getattr(settings, 'CHACHAP_PAYOUT_WEBHOOK_URL',
                                  'https://guineemarche.onrender.com/api/v1/orders/webhook/chachap/payout/')
            _order_ref  = str(payout.order_id)[:8].upper()
            _body = {
                'account_number':  phone,
                'amount':          amount,
                'payment_channel': _channel,
                'account_name':    getattr(payout.seller, 'full_name', ''),
                'notify_url':      _notify_url,
                'order_id':        _order_ref,
            }
            _body_bytes = _json.dumps(_body, separators=(',', ':')).encode()
            _headers = {'CCP-Api-Key': api_key, 'Content-Type': 'application/json'}
            if encrypt_key:
                _sig = _hmac.new(encrypt_key.encode(), _body_bytes, _hs.sha256).hexdigest()
                _headers['CCP-HMAC-Signature'] = _sig
            _url = f'{CHACHAP_API_URL}/api/push/{access_code}/request'
            resp = _req.post(_url, data=_body_bytes, headers=_headers, timeout=20)
            raw  = resp.text.strip()
            logger.info("[PAYOUT] Push HTTP %s — raw: %.300s", resp.status_code, raw)
            try:
                data = _json.loads(raw)
                if not isinstance(data, dict):
                    data = {}
            except _json.JSONDecodeError:
                data = {}

            http_ok    = resp.status_code in (200, 201, 202)
            request_id = data.get('request_id', '')
            status_    = data.get('status', '')

            if http_ok and request_id:
                if status_ == 'success':
                    payout.mark_completed(
                        external_ref=request_id,
                        note=f"Push ChaChaP exécuté (id={request_id})",
                    )
                    logger.info("[PAYOUT] %s → push exécuté id=%s", payout_id, request_id)
                else:
                    # initiating / pending → PROCESSING
                    payout.status       = payout.Status.PROCESSING
                    payout.external_ref = request_id
                    payout.admin_note   = f"Push ChaChaP soumis (id={request_id}, status={status_})"
                    payout.save(update_fields=['status', 'external_ref', 'admin_note', 'updated_at'])
                    logger.info("[PAYOUT] %s → push soumis id=%s status=%s", payout_id, request_id, status_)
                return PaymentResult(success=True, reference=request_id, message=f"Push ChaChaP {status_}")

            err = data.get('message') or data.get('error') or raw[:120] or f'HTTP {resp.status_code}'
            logger.warning("[PAYOUT] Push ChaChaP échoué: %s", err)
            payout.mark_failed(note=f"Push ChaChaP: {err}")
            _notify_payout_failure(payout, err)
            return PaymentResult(success=False, message=f"Push ChaChaP: {err}")
        except Exception as exc:
            logger.error("[PAYOUT] Règlement ChaChaP exception: %s", exc)
            payout.mark_failed(note=f"Exception: {exc}")
            _notify_payout_failure(payout, str(exc))
            return PaymentResult(success=False, message=str(exc))

    # ── Cas 3 : Pas de clé API → simulation / attente manuelle ───────────────
    sim_ref = f"SIM-PAYOUT-{uuid.uuid4().hex[:10].upper()}"
    logger.info("[PAYOUT] Simulation versement %s → ref %s", payout_id, sim_ref)
    payout.admin_note = f"Simulation — virement manuel de {amount:,} GNF vers {phone} ({payout.provider}) requis"
    payout.save(update_fields=['admin_note', 'updated_at'])
    return PaymentResult(
        success=True,
        reference=sim_ref,
        message=f"Simulation : virement de {amount:,} GNF vers {phone} à effectuer manuellement",
    )


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


def sync_chachap_payout_status(payout_id: str) -> PaymentResult:
    """
    Interroge ChapChap pour connaître le statut actuel d'un payout
    et met à jour SellerPayout en conséquence.

    Endpoint : GET /api/payout/{access_code}/request/{payout_request_id}

    À appeler depuis l'action admin "Sync statut" ou un job Celery périodique.
    """
    from apps.orders.models import SellerPayout

    try:
        payout = SellerPayout.objects.select_related('seller').get(pk=payout_id)
    except SellerPayout.DoesNotExist:
        return PaymentResult(success=False, message="Payout introuvable")

    ext_ref = payout.external_ref
    if not ext_ref:
        return PaymentResult(success=False, message="Aucune référence ChapChap — payout jamais soumis")

    api_key     = getattr(settings, 'CHACHAP_API_KEY', '')
    access_code = getattr(settings, 'CHACHAP_AGENT_ACCESS_CODE', '')
    if not (api_key and access_code):
        return PaymentResult(success=False, message="Clés ChapChap non configurées")

    try:
        import requests as _req, json as _json
        # Push API: GET /push/{access_code}/request/{request_id}
        url  = f'{CHACHAP_API_URL}/api/push/{access_code}/request/{ext_ref}'
        resp = _req.get(url, headers={'CCP-Api-Key': api_key}, timeout=15)
        raw  = resp.text.strip()
        logger.info("[PAYOUT SYNC] GET %s → HTTP %s — %.300s", url, resp.status_code, raw)

        try:
            data = _json.loads(raw)
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}

        status_ = data.get('status', '') or data.get('payout_request_status', '')
        # Normaliser : Push "success" → "executed"
        if status_ == 'success':
            status_ = 'executed'
        elif status_ == 'error':
            status_ = 'failed'

        if status_ == 'executed':
            if payout.status != SellerPayout.Status.COMPLETED:
                payout.mark_completed(
                    external_ref=ext_ref,
                    note=f"Règlement ChaChaP exécuté (sync manuel, id={ext_ref})",
                )
                logger.info("[PAYOUT SYNC] %s → marqué COMPLETED", payout_id)
                # Notifier le vendeur
                try:
                    from apps.notifications.models import Notification as _N
                    _N.send(
                        user=payout.seller,
                        type=_N.Type.ORDER_UPDATE,
                        title='💸 Virement reçu !',
                        body=f'Votre virement de {payout.amount_gnf:,} GNF a été exécuté sur votre compte {payout.provider}.',
                        data={'payout_id': str(payout.id)},
                    )
                except Exception as _ne:
                    logger.warning("[PAYOUT SYNC] Notification vendeur : %s", _ne)
            return PaymentResult(success=True, reference=ext_ref, message="Exécuté — payout marqué COMPLETED")

        elif status_ in ('failed', 'rejected', 'cancelled', 'error'):
            if payout.status not in (SellerPayout.Status.COMPLETED, SellerPayout.Status.FAILED):
                payout.mark_failed(note=f"Règlement ChaChaP échoué (sync, status={status_})")
                logger.warning("[PAYOUT SYNC] %s → marqué FAILED (%s)", payout_id, status_)
            return PaymentResult(success=False, message=f"ChapChap: {status_}")

        else:
            # Statut intermédiaire ou inconnu
            msg = f"Statut actuel ChapChap: {status_ or 'inconnu'} — en attente"
            logger.info("[PAYOUT SYNC] %s — %s", payout_id, msg)
            return PaymentResult(success=True, reference=ext_ref, message=msg)

    except Exception as exc:
        logger.error("[PAYOUT SYNC] Exception: %s", exc)
        return PaymentResult(success=False, message=str(exc))
