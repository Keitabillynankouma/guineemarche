"""
Guimatrix AI Features — Recherche intelligente, Assistant achat, Recommandations
Powered by Claude Haiku 5.5 (rapide, économique, multilingue)
"""
import json
import logging
from django.conf import settings
from django.db.models import Q
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from .models import Listing, Category
from .serializers import ListingSerializer

logger = logging.getLogger(__name__)

# Modèle central — un seul endroit à changer
_MODEL = 'claude-haiku-5-5'


# ─── Throttles ───────────────────────────────────────────────────────────────

class AISearchThrottle(AnonRateThrottle):
    rate = '30/hour'

class AISearchUserThrottle(UserRateThrottle):
    rate = '200/hour'


# ─── Helper : appel Claude ───────────────────────────────────────────────────

def _claude(system: str, user: str, max_tokens: int = 400,
            messages: list | None = None) -> str | None:
    """
    Appel synchrone à Claude avec timeout strict (10s connect, 25s total).
    Accepte un historique de messages optionnel (pour l'assistant multi-tour).
    """
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key, timeout=25.0)

        if messages is None:
            messages = [{'role': 'user', 'content': user}]

        resp = client.messages.create(
            model=_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return resp.content[0].text
    except BaseException as e:
        import asyncio
        if isinstance(e, asyncio.CancelledError):
            logger.debug("Claude API call cancelled (client disconnect).")
            return None
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
Communes de Conakry : Kaloum, Dixinn, Ratoma, Matam, Matoto.

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
- Si le prix semble en USD → multiplier par 10 000; en EUR → multiplier par 11 000
- "pas cher" / "bon marché" / "abordable" → max_price = 500 000 GNF
- "milieu de gamme" → min_price = 500 000, max_price = 3 000 000 GNF
- "haut de gamme" / "premium" / "top" → min_price = 3 000 000 GNF

Langues acceptées : français, anglais, pular (peul), malinké, soussou — traduis en français pour les mots-clés."""


class AISearchView(APIView):
    """
    POST /api/v1/listings/ai-search/
    Recherche en langue naturelle : français, anglais, langues locales.
    Résultats mis en cache 20 minutes pour les requêtes identiques.
    """
    permission_classes = [AllowAny]
    throttle_classes   = [AISearchThrottle, AISearchUserThrottle]

    def post(self, request):
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'error': 'Requête vide'}, status=400)
        if len(query) > 300:
            return Response({'error': 'Requête trop longue (max 300 caractères)'}, status=400)

        # Cache : même requête → même résultat pendant 20 min
        cache_key = f'ai_search_{query.lower()[:100]}'
        cached_filters = cache.get(cache_key)

        if cached_filters:
            filters = cached_filters
        else:
            categories = list(Category.objects.filter(is_active=True).values('id', 'name', 'slug'))
            cat_context = ', '.join(f"{c['name']} (slug:{c['slug']})" for c in categories)

            user_prompt = (
                f"Catégories disponibles : {cat_context}\n\n"
                f"Requête : \"{query}\"\n\nRetourne uniquement le JSON de filtres."
            )

            raw = _claude(AI_SEARCH_SYSTEM, user_prompt, max_tokens=300)
            if not raw:
                return self._fallback_search(query, request)

            try:
                start, end = raw.find('{'), raw.rfind('}') + 1
                if start < 0 or end <= 0:
                    return self._fallback_search(query, request)
                filters = json.loads(raw[start:end])
                cache.set(cache_key, filters, timeout=60 * 20)  # 20 min
            except (json.JSONDecodeError, ValueError):
                logger.warning("AI search: JSON invalide. raw=%r", raw[:80])
                return self._fallback_search(query, request)

        # Construire le queryset
        qs = Listing.objects.filter(status=Listing.Status.ACTIVE).select_related('category', 'seller')

        kw = (filters.get('keywords') or '').strip()
        if kw:
            q = Q()
            for term in kw.split():
                q |= Q(title__icontains=term) | Q(description__icontains=term)
            qs = qs.filter(q)

        cat_kw = (filters.get('category_keywords') or '').strip()
        if cat_kw:
            cat_q = Q()
            for t in cat_kw.split():
                cat_q |= Q(category__name__icontains=t) | Q(category__slug__icontains=t)
            qs = qs.filter(cat_q)

        city = filters.get('city')
        if city:
            qs = qs.filter(city__icontains=city)

        if filters.get('min_price'):
            qs = qs.filter(price_gnf__gte=filters['min_price'])
        if filters.get('max_price'):
            qs = qs.filter(price_gnf__lte=filters['max_price'])

        condition = filters.get('condition')
        if condition and condition != 'null' and condition in dict(Listing.Condition.choices):
            qs = qs.filter(condition=condition)

        price_type = filters.get('price_type')
        if price_type and price_type != 'null' and price_type in dict(Listing.PriceType.choices):
            qs = qs.filter(price_type=price_type)

        qs = qs.order_by('-is_boosted', '-created_at')
        results = qs[:20]
        serializer = ListingSerializer(results, many=True, context={'request': request})

        return Response({
            'interpretation':  filters.get('interpretation', ''),
            'filters_applied': {
                'keywords': kw,
                'category': cat_kw,
                'city':     city,
                'min_price': filters.get('min_price'),
                'max_price': filters.get('max_price'),
            },
            'count':   qs.count(),
            'results': serializer.data,
        })

    def _fallback_search(self, query, request):
        qs = Listing.objects.filter(status=Listing.Status.ACTIVE)
        q = Q()
        for t in query.split():
            q |= Q(title__icontains=t) | Q(description__icontains=t) | Q(city__icontains=t)
        qs = qs.filter(q).order_by('-is_boosted', '-created_at')
        serializer = ListingSerializer(qs[:20], many=True, context={'request': request})
        return Response({
            'interpretation': f'Recherche pour : {query}',
            'filters_applied': {},
            'count':   qs.count(),
            'results': serializer.data,
        })


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 2 — Assistant d'achat / vente contextuel
# POST /api/v1/listings/assistant/
# Body: { "message": "...", "history": [...], "listing_id": "uuid" (optionnel) }
# ═══════════════════════════════════════════════════════════════════════════════

ASSISTANT_SYSTEM = """Tu es Guidy, l'assistant intelligent de Guimatrix — la première marketplace en ligne de Guinée.
Tu aides les acheteurs ET les vendeurs : trouver le bon produit, fixer un bon prix, négocier, éviter les arnaques.
Tu réponds en français (ou en langue locale si l'utilisateur l'utilise : pular, malinké, soussou).
Tes réponses sont courtes (3-5 phrases max), directes et adaptées au contexte guinéen.

══ CONTEXTE PLATEFORME ══
{platform_context}

══ CONTEXTE ANNONCE ══
{listing_context}

══ CONTEXTE UTILISATEUR ══
{user_context}

══ GUIDE DE PRIX MOYEN EN GUINÉE ══
Smartphones :
  - Entrée de gamme (Tecno, Itel, Infinix bas) : 500 000 – 1 500 000 GNF
  - Milieu de gamme (Samsung A, Xiaomi, iPhone 11) : 1 500 000 – 5 000 000 GNF
  - Haut de gamme (iPhone 14+, Samsung S) : 5 000 000 – 15 000 000 GNF
Motos : occasion 3 000 000 – 8 000 000 GNF | neuve 10 000 000 – 25 000 000 GNF
Voitures : occasion 15 000 000 – 80 000 000 GNF selon modèle/année
Immobilier Conakry : studio 500 000 – 1 500 000/mois | maison 1 500 000 – 5 000 000/mois
Électroménager : réfrigérateur 2 000 000 – 7 000 000 GNF | télé 1 000 000 – 5 000 000 GNF

══ RÈGLES ══
- Tu peux conseiller sur : négociation, inspection du produit, signaux d'arnaque, comparaison de prix
- Mentionne l'escrow Guimatrix comme protection pour les commandes
- Tu NE PEUX PAS accéder aux comptes, rembourser ou résoudre des litiges → rediriger vers support@guimatrix.com
- Si quelqu'un demande à payer hors plateforme, avertis-le fermement"""


class ListingAssistantView(APIView):
    """
    POST /api/v1/listings/assistant/
    Assistant d'achat/vente avec contexte de l'annonce et de l'utilisateur connecté.
    """
    permission_classes = [AllowAny]
    throttle_classes   = [AISearchThrottle, AISearchUserThrottle]

    def post(self, request):
        message    = (request.data.get('message') or '').strip()
        history    = request.data.get('history', [])
        listing_id = request.data.get('listing_id')

        if not message:
            return Response({'error': 'Message vide'}, status=400)
        if len(message) > 1000:
            return Response({'error': 'Message trop long (max 1000 caractères)'}, status=400)

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
        if not api_key:
            return Response({
                'reply': "Je ne suis pas encore activé. Contactez le vendeur via la messagerie Guimatrix."
            })

        # ── Contexte plateforme ──────────────────────────────────────────────
        try:
            cats  = list(Category.objects.filter(is_active=True).values_list('name', flat=True))
            count = Listing.objects.filter(status=Listing.Status.ACTIVE).count()
            platform_context = (
                f"Annonces actives : {count}\n"
                f"Catégories : {', '.join(cats[:15])}"
            )
        except Exception:
            platform_context = "Marketplace guinéenne multi-catégories."

        # ── Contexte annonce ─────────────────────────────────────────────────
        listing_context = "Aucune annonce spécifique — conseil général."
        if listing_id:
            try:
                listing = Listing.objects.select_related('category', 'seller', 'seller__profile').get(
                    id=listing_id, status=Listing.Status.ACTIVE
                )
                seller = listing.seller
                profile = getattr(seller, 'profile', None)
                rating  = getattr(profile, 'rating_avg', 0) or 0
                sales   = getattr(profile, 'total_sales', 0) or 0
                listing_context = (
                    f"Titre : {listing.title}\n"
                    f"Prix : {listing.price_gnf:,} GNF ({listing.get_price_type_display()})\n"
                    f"Catégorie : {listing.category.name if listing.category else '—'}\n"
                    f"État : {listing.get_condition_display()}\n"
                    f"Lieu : {listing.city}{', ' + listing.quartier if getattr(listing, 'quartier', '') else ''}\n"
                    f"Vendeur : {seller.full_name} | Note : {rating:.1f}/5 | {sales} ventes\n"
                    f"Description : {listing.description[:400]}"
                )
            except Listing.DoesNotExist:
                listing_context = "Annonce introuvable ou expirée."
            except Exception as e:
                logger.warning("Could not fetch listing context: %s", e)

        # ── Contexte utilisateur connecté ────────────────────────────────────
        user_context = "Utilisateur non connecté."
        if request.user and request.user.is_authenticated:
            user = request.user
            profile = getattr(user, 'profile', None)
            purchases = getattr(profile, 'total_purchases', None)
            user_context = (
                f"Utilisateur connecté : {user.full_name}\n"
                f"Achats passés : {purchases if purchases is not None else 'N/A'}\n"
                f"Ville : {getattr(user, 'city', '') or 'Non renseignée'}"
            )
            # Si l'utilisateur regarde sa propre annonce → mode vendeur
            if listing_id:
                try:
                    own = Listing.objects.filter(id=listing_id, seller=user).exists()
                    if own:
                        user_context += "\nMODE : C'est l'annonce du vendeur lui-même — conseille-le sur comment améliorer et vendre."
                except Exception:
                    pass

        system = ASSISTANT_SYSTEM.format(
            platform_context=platform_context,
            listing_context=listing_context,
            user_context=user_context,
        )

        # ── Historique (12 derniers échanges) ────────────────────────────────
        messages = []
        for msg in history[-12:]:
            role    = msg.get('role', '')
            content = str(msg.get('content', '')).strip()
            if role in ('user', 'assistant') and content:
                messages.append({'role': role, 'content': content})
        messages.append({'role': 'user', 'content': message})

        reply = _claude(system, message, max_tokens=500, messages=messages)

        if not reply:
            return Response({'reply': "Une erreur est survenue. Contactez le support via support@guimatrix.com."})

        return Response({'reply': reply})


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE 3 — Recommandations "Vous aimerez aussi"
# GET /api/v1/listings/{id}/similar/
# ═══════════════════════════════════════════════════════════════════════════════

class SimilarListingsView(APIView):
    """
    GET /api/v1/listings/{pk}/similar/
    Retourne jusqu'à 8 annonces similaires.
    L'IA booste la pertinence sémantique quand le SQL ne suffit pas.
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            listing = Listing.objects.select_related('category').get(
                id=pk, status=Listing.Status.ACTIVE
            )
        except Listing.DoesNotExist:
            return Response({'error': 'Annonce introuvable'}, status=404)

        qs = Listing.objects.filter(
            status=Listing.Status.ACTIVE,
            category=listing.category,
        ).exclude(id=listing.id)

        if listing.price_gnf and listing.price_gnf > 0:
            min_p = int(listing.price_gnf * 0.4)
            max_p = int(listing.price_gnf * 1.6)
            qs = qs.filter(price_gnf__gte=min_p, price_gnf__lte=max_p)

        qs = qs.order_by('-is_boosted', '-created_at')
        candidates = list(qs[:20])

        # Enrichissement IA si peu de résultats SQL
        if len(candidates) < 4 and getattr(settings, 'ANTHROPIC_API_KEY', ''):
            candidates = self._ai_similar(listing, candidates, request)

        # Fallback : même catégorie sans filtre prix
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
        pool_qs = Listing.objects.filter(status=Listing.Status.ACTIVE).exclude(id=listing.id)

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
            "Tu es un moteur de recommandation. "
            "Réponds UNIQUEMENT avec du JSON sur une ligne : {\"ids\":[\"uuid1\",\"uuid2\",...]} "
            "avec les UUIDs (max 6) des annonces les plus similaires, sans markdown ni explication."
        )
        user = (
            f"Référence : {listing.title} | {listing.price_gnf:,} GNF\n"
            f"Description : {listing.description[:200]}\n\n"
            f"Annonces disponibles :\n{pool_desc}"
        )

        raw = _claude(system, user, max_tokens=200)
        if not raw:
            return sql_results

        try:
            start, end = raw.find('{'), raw.rfind('}') + 1
            if start < 0 or end <= 0:
                return sql_results
            data     = json.loads(raw[start:end])
            ids      = data.get('ids', [])
            pool_map = {str(p.id): p for p in pool}
            return [pool_map[i] for i in ids if i in pool_map]
        except Exception as e:
            logger.warning("AI similar error: %s | raw=%r", e, raw[:80])
            return sql_results
