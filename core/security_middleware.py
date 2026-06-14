"""
Middleware de sécurité GuinéeMarché.
Détecte les attaques courantes, bloque les requêtes malveillantes et alerte via Sentry.
"""
import re
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('security')

# ── Patterns d'attaques à détecter ────────────────────────────────────────────

SQL_INJECTION_PATTERNS = re.compile(
    r"(union\s+select|select\s+.*\s+from|insert\s+into|drop\s+table|"
    r"delete\s+from|update\s+.*\s+set|exec\s*\(|execute\s*\(|"
    r"xp_cmdshell|information_schema|--\s*$|;\s*drop|1\s*=\s*1|"
    r"or\s+1\s*=\s*1|and\s+1\s*=\s*1)",
    re.IGNORECASE
)

XSS_PATTERNS = re.compile(
    r"(<script[\s>]|javascript:|on\w+\s*=|<iframe|<object|<embed|"
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

        # 1. Scanner / outil d'attaque connu
        if MALICIOUS_UA_PATTERNS.search(user_agent):
            self._alert('SCANNER_DETECTED', request, {
                'user_agent': user_agent,
                'path': path,
            })
            return JsonResponse({'error': 'Forbidden'}, status=403)

        # 2. Chemins sensibles
        if SENSITIVE_PATHS.search(path):
            self._alert('SENSITIVE_PATH_ACCESS', request, {
                'path': path,
                'ip': client_ip,
            })
            return JsonResponse({'error': 'Not found'}, status=404)

        # 3. Path traversal dans l'URL
        if PATH_TRAVERSAL_PATTERNS.search(full_url):
            self._alert('PATH_TRAVERSAL_ATTEMPT', request, {
                'url': full_url,
                'ip': client_ip,
            })
            return JsonResponse({'error': 'Bad request'}, status=400)

        # 4. SQL injection dans les paramètres GET
        query_string = request.META.get('QUERY_STRING', '')
        if SQL_INJECTION_PATTERNS.search(query_string):
            self._alert('SQL_INJECTION_ATTEMPT', request, {
                'query': query_string[:500],
                'ip': client_ip,
            })
            return JsonResponse({'error': 'Bad request'}, status=400)

        # 5. XSS dans les paramètres GET
        if XSS_PATTERNS.search(query_string):
            self._alert('XSS_ATTEMPT', request, {
                'query': query_string[:500],
                'ip': client_ip,
            })
            return JsonResponse({'error': 'Bad request'}, status=400)

        return None

    def process_response(self, request, response):
        """Ajoute des en-têtes de sécurité HTTP à toutes les réponses."""
        # Empêche le sniffing MIME
        response['X-Content-Type-Options'] = 'nosniff'
        # Empêche le clickjacking
        response['X-Frame-Options'] = 'DENY'
        # Force HTTPS pour 1 an (HSTS)
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        # Politique de référent
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        # Désactive les fonctionnalités dangereuses du navigateur
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
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
                    f"[GuinéeMarché Security] {event_type} from {ip}",
                    level='warning',
                )
        except Exception:
            pass  # Sentry non configuré — log suffit
