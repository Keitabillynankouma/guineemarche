"""
Notifications push Firebase Cloud Messaging (FCM) — HTTP v1 API.

Variables Railway requises :
    FIREBASE_PROJECT_ID         — ID du projet Firebase (ex: guimatrix-prod)
    FIREBASE_SERVICE_ACCOUNT    — JSON complet du compte de service (copié depuis Firebase Console)
                                   ou chemin vers le fichier JSON (ex: /app/firebase-sa.json)

Comportement :
    - Si FIREBASE_PROJECT_ID ou FIREBASE_SERVICE_ACCOUNT est absent → log warning, pas d'envoi
    - Envoi asynchrone (threading.Thread) pour ne pas bloquer les vues
    - Un seul token par user (dernière session) → on écrase à chaque reconnexion
"""
import json
import logging
import threading
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_service_account() -> dict | None:
    """Parse le compte de service depuis la variable d'env (JSON string ou chemin fichier)."""
    raw = getattr(settings, 'FIREBASE_SERVICE_ACCOUNT', '')
    if not raw:
        return None
    if raw.strip().startswith('{'):
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("[FCM] FIREBASE_SERVICE_ACCOUNT JSON invalide : %s", e)
            return None
    # Chemin fichier
    try:
        with open(raw, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error("[FCM] Impossible de lire FIREBASE_SERVICE_ACCOUNT (%s) : %s", raw, e)
        return None


def _get_oauth_token(service_account: dict) -> str | None:
    """Obtient un access token OAuth2 via JWT (sans dépendance google-auth)."""
    import time, hmac, hashlib, base64
    try:
        import jwt as _jwt_pkg
    except ImportError:
        # Fallback si PyJWT non installé : utiliser requests + google-auth si dispo
        try:
            import google.oauth2.service_account as _sa
            import google.auth.transport.requests as _tr
            creds = _sa.Credentials.from_service_account_info(
                service_account,
                scopes=['https://www.googleapis.com/auth/firebase.messaging'],
            )
            req = _tr.Request()
            creds.refresh(req)
            return creds.token
        except Exception as e:
            logger.error("[FCM] Impossible d'obtenir le token OAuth2 (google-auth absent) : %s", e)
            return None

    # Avec PyJWT
    try:
        now = int(time.time())
        payload = {
            'iss': service_account['client_email'],
            'sub': service_account['client_email'],
            'aud': 'https://oauth2.googleapis.com/token',
            'iat': now,
            'exp': now + 3600,
            'scope': 'https://www.googleapis.com/auth/firebase.messaging',
        }
        private_key = service_account['private_key']
        assertion = _jwt_pkg.encode(payload, private_key, algorithm='RS256')

        import requests as _req
        resp = _req.post(
            'https://oauth2.googleapis.com/token',
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': assertion,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get('access_token')
        logger.error("[FCM] OAuth2 token request failed %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("[FCM] JWT signing error : %s", e)
    return None


def _do_send_fcm(fcm_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Envoi bloquant FCM HTTP v1."""
    import requests as _req

    project_id = getattr(settings, 'FIREBASE_PROJECT_ID', '')
    if not project_id:
        logger.debug("[FCM] FIREBASE_PROJECT_ID absent — push ignoré")
        return False

    service_account = _get_service_account()
    if not service_account:
        logger.warning("[FCM] Compte de service Firebase absent — push ignoré")
        return False

    access_token = _get_oauth_token(service_account)
    if not access_token:
        return False

    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    message: dict = {
        "message": {
            "token": fcm_token,
            "notification": {"title": title, "body": body},
        }
    }
    if data:
        # FCM data payload : toutes les valeurs doivent être des strings
        message["message"]["data"] = {k: str(v) for k, v in data.items()}

    try:
        resp = _req.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
            json=message,
            timeout=10,
        )
        if resp.status_code == 200:
            logger.debug("[FCM] Push envoyé → token=%s…", fcm_token[:20])
            return True
        logger.warning("[FCM] Erreur FCM %s : %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("[FCM] Requête FCM échouée : %s", e)
    return False


def send_push(fcm_token: str, title: str, body: str, data: dict | None = None) -> None:
    """
    Envoie une notification push FCM de manière asynchrone (fire-and-forget).

    Args:
        fcm_token: Token FCM de l'appareil cible
        title:     Titre de la notification
        body:      Corps de la notification
        data:      Payload data optionnel (dict str→str)
    """
    if not fcm_token:
        return
    threading.Thread(
        target=_do_send_fcm,
        args=(fcm_token, title, body, data),
        daemon=True,
    ).start()
