"""
Modération automatique des annonces via Claude Haiku.
Appelée à chaque création d'annonce dans perform_create.
"""
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

MODERATION_SYSTEM = """Tu es un modérateur de contenu pour GuinéeMarché, une marketplace en ligne en Guinée.
Analyse l'annonce et retourne UNIQUEMENT un objet JSON valide, rien d'autre.

REJETER automatiquement si :
- Contenu adulte, sexuel ou pornographique
- Armes à feu, munitions, explosifs
- Drogues, stupéfiants ou substances illicites
- Escroquerie évidente (ex: iPhone neuf à 5 000 GNF, prix 100x trop bas)
- Discours haineux, menaces, contenu raciste
- Données personnelles d'autrui publiées sans consentement

METTRE EN RÉVISION (attente admin) si :
- Prix anormalement bas pour la catégorie (possiblement frauduleux)
- Description très vague ou quasi-vide (< 10 mots)
- Doublon suspect (même titre / description très générique)
- Contenu ambigu qui pourrait masquer un produit illicite

APPROUVER si l'annonce semble légitime.

Format de réponse STRICT (JSON uniquement) :
{"decision": "approve", "reason": "Annonce conforme"}
{"decision": "review", "reason": "Prix suspect pour la catégorie"}
{"decision": "reject", "reason": "Contenu adulte détecté"}"""


def moderate_listing(title: str, description: str, price_gnf: int, category: str) -> dict:
    """
    Analyse une annonce et retourne la décision de modération.
    Retourne toujours un dict {"decision": ..., "reason": ...}.
    Fail-open : en cas d'erreur, approuve l'annonce (ne bloque pas les vendeurs).
    """
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY non configurée — modération désactivée")
        return {"decision": "approve", "reason": "Modération IA non configurée"}

    content = (
        f"Titre : {title}\n"
        f"Catégorie : {category}\n"
        f"Prix : {price_gnf:,} GNF\n"
        f"Description : {description[:1500]}"
    )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=100,
            system=MODERATION_SYSTEM,
            messages=[{"role": "user", "content": content}],
        )
        text = resp.content[0].text.strip()

        # Extraire le JSON même si du texte parasite est présent
        start = text.find('{')
        end   = text.rfind('}') + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
            if result.get('decision') in ('approve', 'review', 'reject'):
                logger.info(
                    "Modération [%s] '%s' → %s (%s)",
                    category, title[:50], result['decision'], result.get('reason', '')
                )
                return result

        logger.warning("Réponse IA inattendue : %s", text)
        return {"decision": "approve", "reason": "Réponse IA non interprétable"}

    except Exception as exc:
        logger.error("Erreur modération IA : %s", exc)
        return {"decision": "approve", "reason": f"Erreur IA (fail-open)"}
