"""
Guimatrix AI Features — Recherche intelligente, Assistant achat, Recommandations
Powered by Claude Haiku (coût minimal, réponses rapides)
"""
import json
import logging
from django.conf import settings
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import Listing, Category
from .serializers import ListingSerializer

logger = logging.getLogger(__name__)


# ─── Throttles ───────────────────────────────────────────────────────────────

class AISearchThrottle(AnonRateThrottle):
    rate = '30/hour'

class AISearchUserThrottle(UserRateThrottle):
    rate = '200/hour'


# ─── Helper : appel Claude ───────────────────────────────────────────────────

def _claude(system: str, user: str, max_tokens: int = 400) -> str | None:
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=max_tokens,
            system=system,
            messages=[{'role': 'user', 'content': user}],
        )
        return resp.content[0].text
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 1 — Recherche intelligente en langue naturelle
# POST /api/v1/listings/ai-search/
# Body: { "query": "je cherche un iPhone pas cher à Conakry" }
# ═══════════════════════════════════════════════════════════════════════════════

AI_SEARCH_SYSTEM = """Tu es un moteur de recherche pour Guimatrix, la marketplace guinéenne.
Analyse la requête de l'utilisateur et retourne un JSON avec les filtres de recherche extraits.

Villes principales de Guinée: Conakry, Kindia, Labé, Kankan, Nzérékoré, Boké, Faranah, Mamou, Gueckedou, Kissidougou.

Format de réponse (JSON uniquement, aucun texte autour) :
{
  "keywords": "mots clés pour la recherche dans les titres",
  "category_keywords": "mots pour identifier la catégorie (téléphone, voiture, maison, vêtement...)",
  "city": "ville si mentionnée sinon null",
  "min_price": nombre en GNF sinon null,
  "max_price": nombre en GNF sinon null,
  "condition": "new|like_new|good|fair|poor|null",
  "price_type": "fixed|negotiable|free|null",
  "interpretation": "une phrase courte expliquant ce que tu as compris"
}

Règles de conversion de prix :
- "million" = 1 000 000 GNF
- "mille" ou "k" = 1 000 GNF
- Si le prix semble en USD ou EUR, multiplier par 10 000 (taux approximatif)
- "pas cher" / "bon marché" → max_price = 500 000 GNF
- "milieu de gamme" → min_price = 500 000, max_price = 3 000 000 GNF
- "haut de gamme" / "premium" → min_price = 3 000 000 GNF"""


class AISearchView(APIView):
    """
    POST /api/v1/listings/ai-search/
    Recherche en langue naturelle : français, anglais, langues locales.
    """
    permission_classes = [AllowAny]
    throttle_classes   = [AISearchThrottle, AISearchUserThrottle]

    def post(self, request):
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'error': 'Requête vide'}, status=400)
        if len(query) > 300:
            return Response({'error': 'Requête trop longue (max 300 caractères)'}, status=400)

        # Récupérer les catégories disponibles pour aider Claude
        categories = list(Category.objects.filter(is_active=True).values('id', 'name', 'slug'))
        cat_context = ', '.join(f"{c['name']} (slug:{c['slug']})" for c in categories)

        user_prompt = f"""Catégories disponibles sur Guimatrix: {cat_context}

Requête utilisateur: "{query}"

Retourne uniquement le JSON de filtres."""

        raw = _claude(AI_SEARCH_SYSTEM, user_prompt, max_tokens=300)

        # Fallback si Claude non disponible : recherche textuelle classique
        if not raw:
            return self._fallback_search(query, request)

        try:
            # Extraire le JSON (parfois Claude ajoute du texte autour)
            start = raw.find('{')
            end   = raw.rfind('}') + 1
            filters = json.loads(raw[start:end])
        except (json.JSONDecodeError, ValueError):
            logger.warning("Claude returned invalid JSON: %s", raw)
            return self._fallback_search(query, request)

        # Construire le queryset Django à partir des filtres extraits
        qs = Listing.objects.filter(status=Listing.Status.ACTIVE).select_related('category', 'seller')

        # Mots clés dans titre + description
        kw = (filters.get('keywords') or '').strip()
        if kw:
            terms = kw.split()
            q = Q()
            for term in terms:
                q |= Q(title__icontains=term) | Q(description__icontains=term)
            qs = qs.filter(q)

        # Catégorie : chercher par nom/slug
        cat_kw = (filters.get('category_keywords') or '').strip()
        if cat_kw:
            cat_terms = cat_kw.split()
            cat_q = Q()
            for t in cat_terms:
                cat_q |= Q(category__name__icontains=t) | Q(category__slug__icontains=t)
            qs = qs.filter(cat_q)

        # Ville
        city = filters.get('city')
        if city:
            qs = qs.filter(city__icontains=city)

        # Prix
        if filters.get('min_price'):
            qs = qs.filter(price_gnf__gte=filters['min_price'])
        if filters.get('max_price'):
            qs = qs.filter(price_gnf__lte=filters['max_price'])

        # Condition
        condition = filters.get('condition')
        if condition and condition != 'null' and condition in dict(Listing.Condition.choices):
            qs = qs.filter(condition=condition)

        # Prix type
        price_type = filters.get('price_type')
        if price_type and price_type != 'null' and price_type in dict(Listing.PriceType.choices):
            qs = qs.filter(price_type=price_type)

        qs = qs.order_by('-is_boosted', '-created_at')

        # Pagination simple (20 résultats)
        page_size = 20
        results = qs[:page_size]
        serializer = ListingSerializer(results, many=True, context={'request': request})

        return Response({
            'interpretation': filters.get('interpretation', ''),
            'filters_applied': {
                'keywords': kw,
                'category': cat_kw,
                'city': city,
                'min_price': filters.get('min_price'),
                'max_price': filters.get('max_price'),
            },
            'count': qs.count(),
            'results': serializer.data,
        })

    def _fallback_search(self, query, request):
        """Recherche textuelle classique si Claude indisponible."""
        qs = Listing.objects.filter(status=Listing.Status.ACTIVE)
        terms = query.split()
        q = Q()
        for t in terms:
            q |= Q(title__icontains=t) | Q(description__icontains=t) | Q(city__icontains=t)
        qs = qs.filter(q).order_by('-is_boosted', '-created_at')
        serializer = ListingSerializer(qs[:20], many=True, context={'request': request})
        return Response({
            'interpretation': f'Recherche textuelle pour : {query}',
            'filters_applied': {},
            'count': qs.count(),
            'results': serializer.data,
        })


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2 — Assistant d'achat contextuel (enrichissement du SupportChat)
# POST /api/v1/core/support-chat/  (endpoint existant, on expose le nouveau ici)
# POST /api/v1/listings/assistant/
# Body: { "message": "...", "history": [...], "listing_id": "uuid" (optionnel) }
# ═══════════════════════════════════════════════════════════════════════════════

ASSISTANT_BASE = """Tu es l'assistant intelligent de Guimatrix, la première marketplace en ligne de Guinée.
Tu aides les acheteurs à trouver le bon produit, évaluer les prix, négocier et éviter les arnaques.
Tu réponds en français (ou en langue locale si l'utilisateur l'utilise).
Tu es direct, utile et honnête. Tes réponses sont courtes (2-5 phrases max).

CONTEXTE DE LA PLATEFORME :
{platform_context}

{listing_context}

GUIDE DE PRIX MOYEN EN GUINÉE (à utiliser pour conseiller) :
- Smartphone entrée de gamme : 500 000 - 1 500 000 GNF
- Smartphone milieu de gamme : 1 500 000 - 4 000 000 GNF
- Smartphone haut de gamme : 4 000 000 - 12 000 000 GNF
- Moto occasion : 3 000 000 - 8 000 000 GNF
- Voiture occasion : 15 000 000 - 80 000 000 GNF
- Studio / chambre Conakry : 500 000 - 1 500 000 GNF/mois

Tu peux conseiller sur : négociation, vérification du produit, signaux d'arnaque, comparaison de prix.
Tu ne peux PAS accéder aux comptes, rembourser ou résoudre des litiges (rediriger vers support@guimatrix.com)."""


class ListingAssistantView(APIView):
    """
    POST /api/v1/listings/assistant/
    Assistant d'achat avec contexte de l'annonce en cours.
    """
    permission_classes = [AllowAny]
    throttle_classes   = [AISearchThrottle, AISearchUserThrottle]

    def post(self, request):
        message    = (request.data.get('message') or '').strip()
        history    = request.data.get('history', [])
        listing_id = request.data.get('listing_id')

        if not message:
            return Response({'error': 'Message vide'}, status=400)
        if len(message) > 800:
            return Response({'error': 'Message trop long'}, status=400)

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
        if not api_key:
            return Response({'reply': "L'assistant IA n'est pas encore activé. Contactez le vendeur directement via la messagerie."})

        # Contexte plateforme : catégories + nombre d'annonces
        try:
            cats  = Category.objects.filter(is_active=True).values_list('name', flat=True)
            count = Listing.objects.filter(status=Listing.Status.ACTIVE).count()
            platform_context = (
                f"Annonces actives sur Guimatrix : {count}\n"
                f"Catégories disponibles : {', '.join(cats)}"
            )
        except Exception:
            platform_context = "Marketplace guinéenne multi-catégories."

        # Contexte annonce spécifique
        listing_context = ""
        if listing_id:
            try:
                listing = Listing.objects.select_related('category', 'seller').get(
                    id=listing_id, status=Listing.Status.ACTIVE
                )
                seller = listing.seller
                listing_context = (
                    f"ANNONCE EN COURS DE CONSULTATION :\n"
                    f"- Titre : {listing.title}\n"
                    f"- Prix : {listing.price_gnf:,} GNF ({listing.get_price_type_display()})\n"
                    f"- Catégorie : {listing.category.name if listing.category else 'Non définie'}\n"
                    f"- Condition : {listing.get_condition_display()}\n"
                    f"- Ville : {listing.city}{', ' + listing.quartier if listing.quartier else ''}\n"
                    f"- Vendeur : {seller.full_name} (note: {seller.profile.rating_avg:.1f}/5, "
                    f"{seller.profile.total_sales} ventes)\n"
                    f"- Description : {listing.description[:300]}{'...' if len(listing.description) > 300 else ''}"
                )
            except Listing.DoesNotExist:
                pass
            except Exception as e:
                logger.warning("Could not fetch listing context: %s", e)

        system = ASSISTANT_BASE.format(
            platform_context=platform_context,
            listing_context=listing_context,
        )

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)

            messages = []
            for msg in history[-8:]:
                role    = msg.get('role', '')
                content = str(msg.get('content', ''))
                if role in ('user', 'assistant') and content:
                    messages.append({'role': role, 'content': content})
            messages.append({'role': 'user', 'content': message})

            response = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=400,
                system=system,
                messages=messages,
            )
            return Response({'reply': response.content[0].text})

        except Exception as exc:
            logger.error("Listing assistant error: %s", exc)
            return Response({'reply': "Une erreur est survenue. Contactez le vendeur directement via la messagerie."})


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — Recommandations "Vous aimerez aussi"
# GET /api/v1/listings/{id}/similar/
# ═══════════════════════════════════════════════════════════════════════════════

class SimilarListingsView(APIView):
    """
    GET /api/v1/listings/{pk}/similar/
    Retourne jusqu'à 8 annonces similaires (même catégorie, fourchette de prix proche).
    Bonus : si Claude disponible, on booste les annonces dont le titre est sémantiquement proche.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            listing = Listing.objects.select_related('category').get(
                id=pk, status=Listing.Status.ACTIVE
            )
        except Listing.DoesNotExist:
            return Response({'error': 'Annonce introuvable'}, status=404)

        # Base : même catégorie, excluant l'annonce courante
        qs = Listing.objects.filter(
            status=Listing.Status.ACTIVE,
            category=listing.category,
        ).exclude(id=listing.id)

        # Fourchette de prix ±60%
        if listing.price_gnf and listing.price_gnf > 0:
            min_p = int(listing.price_gnf * 0.4)
            max_p = int(listing.price_gnf * 1.6)
            qs = qs.filter(price_gnf__gte=min_p, price_gnf__lte=max_p)

        qs = qs.order_by('-is_boosted', '-created_at')
        candidates = list(qs[:20])

        # Enrichissement IA : scorer la similarité sémantique si peu de résultats SQL
        if len(candidates) < 4 and getattr(settings, 'ANTHROPIC_API_KEY', ''):
            candidates = self._ai_similar(listing, candidates, request)

        # Fallback si toujours peu de résultats : même catégorie sans filtre prix
        if len(candidates) < 4:
            extra = Listing.objects.filter(
                status=Listing.Status.ACTIVE,
                category=listing.category,
            ).exclude(id=listing.id).exclude(
                id__in=[c.id for c in candidates]
            ).order_by('-is_boosted', '-created_at')[:8 - len(candidates)]
            candidates += list(extra)

        serializer = ListingSerializer(candidates[:8], many=True, context={'request': request})
        return Response({'results': serializer.data})

    def _ai_similar(self, listing, sql_results, request):
        """
        Demande à Claude d'identifier des annonces similaires parmi un pool plus large.
        Utilisé seulement quand le SQL ne trouve pas assez de résultats.
        """
        # Pool élargi : toute la plateforme, même catégorie parente
        pool_qs = Listing.objects.filter(
            status=Listing.Status.ACTIVE,
        ).exclude(id=listing.id)

        if listing.category and listing.category.parent:
            pool_qs = pool_qs.filter(
                Q(category=listing.category) |
                Q(category__parent=listing.category.parent)
            )

        pool = list(pool_qs.order_by('-is_boosted', '-created_at')[:30])

        if not pool:
            return sql_results

        pool_desc = "\n".join(
            f"{i}. [{p.id}] {p.title} — {p.price_gnf:,} GNF — {p.city}"
            for i, p in enumerate(pool)
        )

        system = (
            "Tu es un moteur de recommandation pour une marketplace. "
            "Retourne uniquement un JSON : { \"ids\": [\"uuid1\", \"uuid2\", ...] } "
            "avec les UUIDs des 6 annonces les plus similaires à l'annonce de référence. "
            "Classe-les du plus au moins similaire."
        )
        user = (
            f"Annonce de référence :\n"
            f"Titre: {listing.title}\n"
            f"Prix: {listing.price_gnf:,} GNF\n"
            f"Description: {listing.description[:200]}\n\n"
            f"Annonces disponibles :\n{pool_desc}"
        )

        raw = _claude(system, user, max_tokens=150)
        if not raw:
            return sql_results

        try:
            start = raw.find('{')
            end   = raw.rfind('}') + 1
            data  = json.loads(raw[start:end])
            ids   = data.get('ids', [])
            pool_map = {str(p.id): p for p in pool}
            return [pool_map[i] for i in ids if i in pool_map]
        except Exception as e:
            logger.warning("AI similar parsing error: %s", e)
            return sql_results
