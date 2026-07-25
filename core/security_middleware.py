"""
Middleware de sécurité Guimatrix.
Détecte les attaques courantes, bloque les requêtes malveillantes et alerte via Sentry.
V2 : + blocage IP progressif (Redis) + Content-Security-Policy
"""
import re
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache

logger = logging.getLogger('security')

# ── Blocage IP progressif ─────────────────────────────────────────────────────
# Clés Redis : security:fail:{ip} → compteur | security:block:{ip} → flag blocage

BLOCK_THRESHOLD   = 10   # tentatives avant blocage
BLOCK_DURATION    = 30 * 60    # 30 minutes de blocage
COUNTER_DURATION  = 60 * 60   # fenêtre de comptage : 1 heure


def _ip_record_fail(ip: str) -> int:
    """Incrémente le compteur d'échecs pour une IP. Retourne le nouveau total."""
    key = f'security:fail:{ip}'
    try:
        count = cache.get(key, 0) + 1
        cache.set(key, count, COUNTER_DURATION)
        if count >= BLOCK_THRESHOLD:
            cache.set(f'security:block:{ip}', 1, BLOCK_DURATION)
            logger.warning("[SECURITY] IP bloquée après %d tentatives : %s", count, ip)
        return count
    except Exception:
        return 0


def _ip_is_blocked(ip: str) -> bool:
    """Retourne True si l'IP est actuellement bloquée."""
    try:
        return bool(cache.get(f'security:block:{ip}'))
    except Exception:
        return False

# ── Patterns d'attaques à détecter ────────────────────────────────────────────

SQL_INJECTION_PATTERNS = re.compile(
    r"(union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table|"
    r"delete\s+from|update\s+.*\s+set|exec\s*\(|execute\s*\(|"
    r"xp_cmdshell|information_schema|--\s*$|;\s*drop|1\s*=\s*1|"
    r"or\s+1\s*=\s*1|and\s+1\s*=\s*1)",
    re.IGNORECASE
)

XSS_PATTERNS = re.compile(
    r"(<script[\s>]|javascript:|\bon\w+\s*=|<iframe|<object|<embed|"
    r"<link\s+.*href|eval\s*\(|expression\s*\(|vbscript:)",
    re.IGNORECASE
)

PATH_TRAVERSAL_PATTERNS = re.compile(
    r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|\.\.%2f|%252e%252e)",
    re.IGNORECASE
)

# Scanners / outils d'attaque connus
MALICIOUS_UA_PATTERNS = re.compile(
    r"(sqlmap|nikto|nmap|masscan|zgrab|dirbuster|gobuster|wfuzz|"
    r"nuclei|hydra|burpsuite|acunetix|nessus|openvas|havij)",
    re.IGNORECASE
)

# Chemins de fichiers sensibles que les scanners essaient d'accéder
SENSITIVE_PATHS = re.compile(
    r"(/etc/passwd|/etc/shadow|/proc/self|\.env$|/wp-admin|/phpmyadmin|"
    r"/adminer|/\.git/|/\.ssh/|/backup|/phpinfo|/server-info|/server-status)",
    re.IGNORECASE
)

# Endpoints légitimes qui ne doivent pas être analysés (performance)
SKIP_PATHS = ('/static/', '/media/', '/favicon.ico')

# ── Middleware ─────────────────────────────────────────────────────────────────

class GuineeSecurityMiddleware(MiddlewareMixin):
    """
    Middleware de sécurité multi-couches :
    1. Détecte SQL injection, XSS, path traversal dans l'URL et les paramètres
    2. Bloque les scanners connus
    3. Bloque les accès aux chemins sensibles
    4. Envoie des alertes Sentry pour chaque attaque détectée
    5. Ajoute des en-têtes de sécurité HTTP à toutes les réponses
    """

    def process_request(self, request):
        path = request.path

        # Ignorer les fichiers statiques pour la performance
        if any(path.startswith(p) for p in SKIP_PATHS):
            return None

        # Collecter le contenu à analyser
        full_url   = request.get_full_path()
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        client_ip  = self._get_client_ip(request)

        # 0. IP bloquée ?
        if _ip_is_blocked(client_ip):
            return JsonResponse({'error': 'Too many requests'}, status=429)

        # 1. Scanner / outil d'attaque connu
        if MALICIOUS_UA_PATTERNS.search(user_agent):
            self._alert('SCANNER_DETECTED', request, {'user_agent': user_agent, 'path': path})
            _ip_record_fail(client_ip)
            return JsonResponse({'error': 'Forbidden'}, status=403)

        # 2. Chemins sensibles
        if SENSITIVE_PATHS.search(path):
            self._alert('SENSITIVE_PATH_ACCESS', request, {'path': path, 'ip': client_ip})
            _ip_record_fail(client_ip)
            return JsonResponse({'error': 'Not found'}, status=404)

        # 3. Path traversal dans l'URL
        if PATH_TRAVERSAL_PATTERNS.search(full_url):
            self._alert('PATH_TRAVERSAL_ATTEMPT', request, {'url': full_url, 'ip': client_ip})
            _ip_record_fail(client_ip)
            return JsonResponse({'error': 'Bad request'}, status=400)

        # 4. SQL injection dans les paramètres GET
        query_string = request.META.get('QUERY_STRING', '')
        if SQL_INJECTION_PATTERNS.search(query_string):
            self._alert('SQL_INJECTION_ATTEMPT', request, {'query': query_string[:500], 'ip': client_ip})
            _ip_record_fail(client_ip)
            return JsonResponse({'error': 'Bad request'}, status=400)

        # 5. XSS dans les paramètres GET
        if XSS_PATTERNS.search(query_string):
            self._alert('XSS_ATTEMPT', request, {'query': query_string[:500], 'ip': client_ip})
            _ip_record_fail(client_ip)
            return JsonResponse({'error': 'Bad request'}, status=400)

        return None

    def process_response(self, request, response):
        """Ajoute des en-têtes de sécurité HTTP à toutes les réponses."""
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        response['X-XSS-Protection'] = '1; mode=block'

        # Content-Security-Policy : autorise uniquement les sources connues
        # L'API ne sert pas de HTML directement → policy stricte
        response['Content-Security-Policy'] = (
            "default-src 'none'; "
            "script-src 'none'; "
            "style-src 'none'; "
            "img-src https://res.cloudinary.com data:; "
            "connect-src 'self' https://api.guimatrix.com https://guineemarche-production.up.railway.app; "
            "frame-ancestors 'none'; "
            "base-uri 'none'; "
            "form-action 'self';"
        )
        return response

    @staticmethod
    def _get_client_ip(request):
        """Récupère l'IP réelle du client (derrière proxy/Render)."""
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    @staticmethod
    def _alert(event_type: str, request, extra: dict):
        """Log + envoi d'une alerte Sentry."""
        ip = GuineeSecurityMiddleware._get_client_ip(request)
        logger.warning(
            "[SECURITY] %s | IP: %s | Path: %s | Extra: %s",
            event_type, ip, request.path, extra
        )
        try:
            import sentry_sdk
            with sentry_sdk.new_scope() as scope:
                scope.set_tag('security_event', event_type)
                scope.set_tag('client_ip', ip)
                scope.set_extra('request_path', request.path)
                scope.set_extra('details', extra)
                scope.set_level('warning')
                sentry_sdk.capture_message(
                    f"[Guimatrix Security] {event_type} from {ip}",
                    level='warning',
                )
        except Exception:
            pass  # Sentry non configuré — log suffit
