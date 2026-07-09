"""
Agent de sécurité des messages — Guimatrix
Analyse chaque message en temps réel pour détecter les tentatives d'arnaque.

Patterns détectés :
- Partage de numéro de téléphone pour sortir de la plateforme
- Demandes de virement bancaire direct (hors escrow)
- Liens vers sites externes suspects
- Urgence artificielle ("je pars demain", "offre expire ce soir")
- Demandes d'acompte hors système

Intégration :
    from core.chat_safety_agent import analyze_message_safety
    result = analyze_message_safety(message_content, sender, conversation)
    if result['action'] == 'block':
        return Response({'error': result['user_message']}, status=400)
"""
import logging
import re
from django.conf import settings

logger = logging.getLogger(__name__)


# ── Patterns heuristiques rapides (sans IA) ──────────────────────────────────

# Numéros de téléphone guinéens et internationaux
_PHONE_RE = re.compile(
    r'(?:\+?224[\s\-]?)?'         # préfixe GN optionnel
    r'(?:6[2-9]|7[0-9]|3[0-9])'  # opérateurs mobiles GN
    r'[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2}',
    re.IGNORECASE
)

# Mots-clés d'arnaque courants (variantes avec fautes incluses)
_SCAM_KEYWORDS = [
    'western union', 'moneygram', 'wave money', 'ria money',
    'virer', 'virement bancaire', 'numéro de compte',
    'rib ', ' rib', 'iban',
    'je pars demain', 'départ demain', 'voyage urgent',
    'acompte', 'avance', 'avancer l\'argent', 'envoyer d\'abord',
    'payer avant', 'prix spécial rien que pour vous',
    'contactez-moi sur whatsapp', 'mon whatsapp', 'whatsapp perso',
    'hors site', 'en dehors', 'en privé',
]

# URLs externes (on blackliste tout lien qui n'est pas guimatrix.com)
_URL_RE = re.compile(
    r'https?://(?!(?:www\.)?guimatrix\.com)[^\s]+',
    re.IGNORECASE
)


def _heuristic_scan(content: str) -> dict | None:
    """
    Scan rapide par règles (0 ms, 0 coût API).
    Retourne un résultat si une règle est déclenchée, None sinon.
    """
    lower = content.lower()

    # Téléphone dans le message
    phone_match = _PHONE_RE.search(content)
    if phone_match:
        return {
            'risk_level': 'high',
            'pattern':    'phone_number_shared',
            'detail':     f"Numéro de téléphone détecté : {phone_match.group()}",
            'action':     'warn',
        }

    # Mots-clés d'arnaque
    for kw in _SCAM_KEYWORDS:
        if kw in lower:
            return {
                'risk_level': 'high',
                'pattern':    'scam_keyword',
                'detail':     f"Mot-clé suspect : «{kw}»",
                'action':     'warn',
            }

    # Liens externes
    url_match = _URL_RE.search(content)
    if url_match:
        return {
            'risk_level': 'medium',
            'pattern':    'external_url',
            'detail':     f"Lien externe détecté : {url_match.group()[:60]}",
            'action':     'warn',
        }

    return None


def _ai_scan(content: str) -> dict | None:
    """
    Analyse IA avec Claude Haiku si l'API est disponible.
    Utilisé pour les cas ambigus non couverts par les heuristiques.
    """
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=150,
            system="""Tu analyses des messages sur une marketplace guinéenne (Guimatrix) pour détecter les arnaques.
Retourne UNIQUEMENT un JSON sans texte autour :
{
  "risk_level": "low|medium|high",
  "pattern": "ok|phone_share|external_payment|off_platform|urgency_scam|advance_request",
  "action": "ok|warn|block",
  "reason": "explication courte en français (max 10 mots)"
}

Règles :
- "ok" si c'est une conversation normale sur un produit
- "warn" si tentative de sortir de la plateforme ou d'arnaque possible
- "block" si clairement frauduleux (demande d'acompte hors système, virement direct)""",
            messages=[{
                'role': 'user',
                'content': f'Message à analyser :\n"""\n{content[:500]}\n"""'
            }],
        )
        import json
        raw = resp.content[0].text
        start, end = raw.find('{'), raw.rfind('}') + 1
        return json.loads(raw[start:end])
    except Exception as e:
        logger.warning("[ChatSafety] Erreur Claude API : %s", e)
        return None


def analyze_message_safety(content: str, sender=None, conversation=None) -> dict:
    """
    Point d'entrée principal. Analyse un message et retourne :
    {
        "action":       "ok" | "warn" | "block",
        "risk_level":   "low" | "medium" | "high",
        "pattern":      str,
        "user_message": str,   # Message à afficher à l'utilisateur si warn/block
    }
    """
    if not content or not content.strip():
        return {'action': 'ok', 'risk_level': 'low', 'pattern': 'empty', 'user_message': ''}

    # 1. Scan heuristique rapide
    heuristic = _heuristic_scan(content)

    if heuristic and heuristic['risk_level'] == 'high':
        # Cas clair → pas besoin d'IA
        action = heuristic['action']
        _log_flag(sender, conversation, heuristic)
        return {
            'action':       action,
            'risk_level':   'high',
            'pattern':      heuristic['pattern'],
            'user_message': _user_message(heuristic['pattern']),
        }

    # 2. IA pour les cas ambigus ou si heuristique = medium
    ai_result = _ai_scan(content)
    if ai_result and ai_result.get('action') in ('warn', 'block'):
        _log_flag(sender, conversation, ai_result)
        return {
            'action':       ai_result['action'],
            'risk_level':   ai_result.get('risk_level', 'medium'),
            'pattern':      ai_result.get('pattern', 'unknown'),
            'user_message': _user_message(ai_result.get('pattern', '')),
        }

    # 3. Message OK
    return {'action': 'ok', 'risk_level': 'low', 'pattern': 'ok', 'user_message': ''}


def _user_message(pattern: str) -> str:
    """Message affiché à l'utilisateur selon le pattern détecté."""
    messages = {
        'phone_number_shared': (
            "⚠️ Pour votre sécurité, échangez uniquement via la messagerie Guimatrix. "
            "Ne partagez pas votre numéro de téléphone — utilisez le bouton d'appel sécurisé de la plateforme."
        ),
        'external_payment': (
            "⚠️ Tous les paiements doivent passer par le système d'escrow Guimatrix. "
            "Ne payez jamais directement par virement ou mobile money hors plateforme."
        ),
        'advance_request': (
            "🚨 Ce message ressemble à une arnaque classique : demande d'acompte avant réception. "
            "Guimatrix protège votre argent via l'escrow — ne payez jamais en dehors."
        ),
        'scam_keyword': (
            "⚠️ Ce message contient des éléments suspects. "
            "Restez sur Guimatrix pour votre sécurité. En cas de doute, signalez le vendeur."
        ),
        'external_url': (
            "⚠️ Les liens externes ont été retirés pour votre sécurité. "
            "Toutes les transactions doivent se faire sur Guimatrix."
        ),
        'off_platform': (
            "⚠️ Les échanges hors plateforme ne sont pas couverts par la protection Guimatrix. "
            "Continuez la conversation ici pour rester protégé(e)."
        ),
    }
    return messages.get(pattern, (
        "⚠️ Ce message a été signalé pour vérification de sécurité. "
        "Si vous pensez que c'est une erreur, contactez le support."
    ))


def _log_flag(sender, conversation, result: dict):
    """Log + (optionnel) notif admin sur les messages flagués."""
    sender_info = getattr(sender, 'phone_number', '?') if sender else '?'
    conv_id     = str(getattr(conversation, 'id', '?')) if conversation else '?'
    logger.warning(
        "[ChatSafety] ⚠️ Message flagué — sender=%s conv=%s pattern=%s action=%s",
        sender_info, conv_id,
        result.get('pattern', '?'),
        result.get('action', '?'),
    )
    # TODO Sprint 2 : envoyer notif admin si action == 'block'
