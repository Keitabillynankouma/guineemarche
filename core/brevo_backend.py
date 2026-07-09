"""
Backend email Django personnalisé — utilise l'API HTTP Brevo.

Railway bloque toutes les connexions SMTP sortantes (ports 25, 465, 587).
Ce backend remplace le backend SMTP Django par défaut et envoie tous les
emails via l'API REST Brevo (HTTPS port 443), qui n'est jamais bloquée.

Configuration dans settings.py :
    EMAIL_BACKEND = 'core.brevo_backend.BrevoEmailBackend'

Compatible avec toutes les fonctions Django standard :
    send_mail(), send_mass_mail(), EmailMessage().send(), etc.
Inclut les emails de réinitialisation de mot de passe Django.
"""
import logging
import requests
from email.headerregistry import Address
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'


def _parse_address(addr: str) -> dict:
    """
    Convertit une adresse email (str) en dict Brevo {'email': ..., 'name': ...}.
    Gère les formats 'Name <email@x.com>' et 'email@x.com'.
    """
    addr = addr.strip()
    if '<' in addr and '>' in addr:
        name, _, raw = addr.partition('<')
        email = raw.rstrip('> ').strip()
        name  = name.strip().strip('"')
    else:
        email = addr
        name  = ''
    return {'email': email, 'name': name} if name else {'email': email}


class BrevoEmailBackend(BaseEmailBackend):
    """
    Backend Django qui envoie chaque EmailMessage via l'API REST Brevo.
    Thread-safe ; les erreurs sont loggées et non levées par défaut
    (fail_silently=True est le comportement par défaut de Railway).
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self._api_key      = getattr(settings, 'BREVO_API_KEY', '')
        self._sender_email = getattr(settings, 'BREVO_SENDER_EMAIL', '')
        self._sender_name  = 'Guimatrix'

    def open(self):
        """Compatible avec l'interface BaseEmailBackend."""
        return True

    def close(self):
        pass

    def send_messages(self, email_messages):
        """
        Envoie une liste de EmailMessage via Brevo.
        Retourne le nombre de messages envoyés avec succès.
        """
        if not self._api_key or not self._sender_email:
            logger.warning(
                "[BrevoBackend] BREVO_API_KEY ou BREVO_SENDER_EMAIL manquant — "
                "%d email(s) non envoyé(s)", len(email_messages)
            )
            return 0

        sent = 0
        for msg in email_messages:
            try:
                sent += self._send_one(msg)
            except Exception as exc:
                if not self.fail_silently:
                    raise
                logger.warning("[BrevoBackend] Erreur lors de l'envoi : %s", exc)
        return sent

    def _send_one(self, msg) -> int:
        """Envoie un seul EmailMessage. Retourne 1 si succès, 0 sinon."""
        recipients = [_parse_address(r) for r in msg.to]
        if not recipients:
            return 0

        # Construire le payload Brevo
        payload = {
            'sender':  {'name': self._sender_name, 'email': self._sender_email},
            'to':      recipients,
            'subject': msg.subject or '(sans objet)',
        }

        # CC / BCC
        if msg.cc:
            payload['cc']  = [_parse_address(r) for r in msg.cc]
        if msg.bcc:
            payload['bcc'] = [_parse_address(r) for r in msg.bcc]

        # Contenu : préférer HTML si disponible
        html_body = None
        text_body = None

        # Vérifier les alternatives HTML
        if hasattr(msg, 'alternatives'):
            for content, mimetype in msg.alternatives:
                if mimetype == 'text/html':
                    html_body = content
                    break

        if html_body:
            payload['htmlContent'] = html_body
            if msg.body:
                payload['textContent'] = msg.body
        else:
            # Email texte pur — envelopper dans un HTML minimal
            text_body = msg.body or ''
            payload['htmlContent'] = (
                f'<pre style="font-family:sans-serif;white-space:pre-wrap;">'
                f'{text_body}</pre>'
            )
            payload['textContent'] = text_body

        # Appel API Brevo
        try:
            resp = requests.post(
                BREVO_API_URL,
                headers={
                    'api-key':      self._api_key,
                    'Content-Type': 'application/json',
                    'Accept':       'application/json',
                },
                json=payload,
                timeout=15,
            )
        except requests.RequestException as exc:
            logger.error("[BrevoBackend] Connexion API échouée : %s", exc)
            return 0

        if resp.status_code in (200, 201, 202):
            logger.info(
                "[BrevoBackend] ✓ Email envoyé à %s — « %s »",
                ', '.join(r['email'] for r in recipients),
                msg.subject,
            )
            return 1
        else:
            logger.warning(
                "[BrevoBackend] ✗ API Brevo %s : %s",
                resp.status_code, resp.text[:300],
            )
            return 0
