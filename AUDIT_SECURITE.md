# Audit Sécurité & Cartographie des Agents IA — Guimatrix
> Réalisé le 09/07/2026 — Version 1.0

---

## PARTIE 1 — SÉCURITÉ EXISTANTE

### ✅ Ce qui est déjà en place

| Couche | Mécanisme | Fichier |
|---|---|---|
| Réseau | HSTS, CSP, X-Frame-Options, X-Content-Type-Options | `core/security_middleware.py` |
| Attaques | Détection SQL injection, XSS, path traversal dans URLs et params | `core/security_middleware.py` |
| IP | Blocage progressif Redis : 10 fails → 30 min de ban | `core/security_middleware.py` |
| Bots | Détection User-Agent malveillants (sqlmap, nikto, nmap, burpsuite) | `core/security_middleware.py` |
| Chemins | Blocage `/etc/passwd`, `.env`, `/wp-admin`, `/phpmyadmin` | `core/security_middleware.py` |
| Auth | JWT + token blacklist à chaque rotation | `config/settings.py` + simplejwt |
| OTP | Rate limit 5/h par IP sur tous les endpoints OTP | `apps/accounts/views.py` |
| Login | Rate limit 10/h par IP | `apps/accounts/views.py` |
| API globale | 200 req/jour anon, 1000 req/jour user authentifié | `config/settings.py` |
| Webhook Orange | HMAC-SHA256 signature verification | `apps/orders/views.py` |
| Webhook Paycard | HMAC-SHA256 + protection replay attack (fenêtre 5 min) | `apps/orders/views.py` |
| Admin | Permission `IsAdmin` sur tous les endpoints admin | `core/permissions.py` |
| Fichiers | Validation type MIME réel (pas seulement extension) | Implémenté Task #14 |
| JWT key | SHA256(SECRET_KEY) → toujours 256 bits, jamais trop court | `config/settings.py` |
| Monitoring | Sentry — erreurs + perf + sécurité, ignorant 401/404 normaux | `config/settings.py` |
| Emails | Brevo HTTP API (contourne blocage SMTP Railway) | `core/brevo_backend.py` |

---

## PARTIE 2 — FAILLES IDENTIFIÉES

### 🔴 CRITIQUE

#### [FAILLE-01] Middleware CSRF commenté
**Fichier :** `config/settings.py`, ligne 103
```python
#'django.middleware.csrf.CsrfViewMiddleware',   # ← DÉSACTIVÉ
```
**Impact :** L'API JWT est CSRF-safe (token dans header Authorization), mais les endpoints utilisant des cookies de session sont exposés.
**Fix :** Soit activer le middleware et exempter les routes API via `@csrf_exempt` sur les ViewSets, soit documenter explicitement que toute auth passe par JWT Bearer uniquement.

#### [FAILLE-02] Webhook Orange sans secret = open door
**Fichier :** `apps/orders/views.py`, ligne 370-371
```python
if not secret:
    return True  # non configuré → laisser passer
```
**Impact :** Si `ORANGE_WEBHOOK_SECRET` n'est pas défini dans Railway, n'importe qui peut POST sur `/api/v1/orders/webhook/orange/` et confirmer des paiements fictifs.
**Fix :** Changer en `return False` (rejeter si non configuré) et vérifier que la variable est bien dans Railway.

### 🟠 ÉLEVÉ

#### [FAILLE-03] Reviews sans vérification d'achat
**Fichier :** `apps/reviews/views.py`
```python
def perform_create(self, serializer):
    serializer.save(reviewer=self.request.user)  # aucune vérification
```
**Impact :** N'importe quel utilisateur authentifié peut laisser une review à n'importe quel autre utilisateur, même sans jamais avoir eu une commande avec lui. Permet les fausses reviews positives (fake boosting) et négatives (attaques concurrentielles).
**Fix :** Vérifier qu'il existe une commande `COMPLETED` entre reviewer et reviewee, et qu'aucune review n'existe déjà pour cette commande.

#### [FAILLE-04] Pas de re-modération à la mise à jour d'annonce
**Fichier :** `apps/listings/views.py`, `ListingDetailView.update()`
**Impact :** Un vendeur peut faire approuver une annonce normale, puis la modifier pour y ajouter du contenu interdit. La modération IA ne s'exécute qu'à la création.
**Fix :** Appeler `moderate_listing_task.delay(str(instance.id))` dans `update()` également, au moins si `title` ou `description` ont changé.

#### [FAILLE-05] Messages sans throttle
**Fichier :** `apps/messaging/views.py`
**Impact :** Un utilisateur peut envoyer un nombre illimité de messages, permettant le spam et la surcharge des WebSockets.
**Fix :** Ajouter `UserRateThrottle` (ex: 60 messages/heure) sur l'endpoint d'envoi.

### 🟡 MOYEN

#### [FAILLE-06] Pas de détection de compte dupliqué
**Fichier :** `apps/accounts/serializers.py`
**Impact :** Un utilisateur banni peut se réinscrire avec un numéro de téléphone légèrement modifié ou une nouvelle adresse email. Pas de fingerprinting de device.
**Fix :** Agent IA de détection (voir Partie 3).

#### [FAILLE-07] Géolocalisation Haversine en Python (N+1 implicite)
**Fichier :** `apps/listings/views.py`, `filter_queryset()`
```python
ids = [l.id for l in queryset if _in_radius(l)]
```
**Impact :** Charge TOUS les listings en mémoire Python pour filtrer, puis fait une seconde requête SQL avec les IDs. Avec 10K+ annonces = dégradation majeure.
**Fix :** Calculer la distance en SQL (PostGIS ou formule Haversine en annotation Django).

---

## PARTIE 3 — CARTOGRAPHIE DES AGENTS IA

### Agents IA existants

| # | Agent | Déclencheur | Modèle | Fichier |
|---|---|---|---|---|
| AI-01 | **Modération annonce** | Création d'annonce (Celery async) | Claude Haiku | `apps/listings/moderation.py` |
| AI-02 | **Rapport sécurité quotidien** | Cron 07h00 (Celery Beat) | Claude Haiku | `core/security_agent.py` |
| AI-03 | **Recherche naturelle** | POST `/ai-search/` | Claude Haiku | `apps/listings/ai_features.py` |
| AI-04 | **Assistant achat** | POST `/assistant/` | Claude Haiku | `apps/listings/ai_features.py` |
| AI-05 | **Recommandations similaires** | GET `/{id}/similar/` | Claude Haiku | `apps/listings/ai_features.py` |

---

### Agents IA à créer (priorités)

---

#### 🔴 [AI-06] Agent de détection de reviews frauduleuses
**Priorité :** Critique — marketplace sans reviews fiables = mort lente  
**Déclencheur :** À chaque création de review + scan hebdomadaire  
**Logique :**
- Détecte : reviewer sans commande complète avec le reviewee, burst de reviews (5+ en 1h sur même vendeur), texte copy-paste entre reviews, rating moyen qui s'écarte brusquement
- Decision : `flag` (envoyer à modération admin) / `auto_hide` (si score fraude > 0.9)

```python
# apps/reviews/fraud_agent.py
def check_review_fraud(review) -> dict:
    """
    Analyse une review avec Claude Haiku et retourne :
    { "fraud_score": 0.0-1.0, "reason": str, "action": "ok|flag|auto_hide" }
    """
```

---

#### 🔴 [AI-07] Agent de sécurité des messages (chat)
**Priorité :** Critique — vecteur principal d'arnaques sur les marketplaces  
**Déclencheur :** À chaque message envoyé (async Celery, 0 latence perçue)  
**Logique :**
- Détecte : numéros de téléphone partagés pour sortir du système, demandes de virement bancaire direct, liens vers sites externes suspects, urgence artificielle ("je pars demain"), promesses de livraison sans escrow
- Decision : `ok` / `warn_sender` (ajouter bannière avertissement) / `block_message` + notif admin

```python
# core/chat_safety_agent.py
def analyze_message(content: str, sender, conversation) -> dict:
    """
    { "risk_level": "low|medium|high", "pattern": str, "action": "ok|warn|block" }
    """
```

**Impact UX :** Messages bloqués remplacés par "Ce message a été retenu pour vérification de sécurité."

---

#### 🟠 [AI-08] Agent de modération d'images
**Priorité :** Élevé — la modération actuelle est 100% texte  
**Déclencheur :** Création/modification d'annonce (après upload Cloudinary)  
**Logique :**
- Utilise Claude avec vision (`claude-haiku-4-5-20251001`) pour analyser chaque image uploadée
- Détecte : contenu adulte, armes, drogues, billets de banque, documents d'identité, images volées (watermarks d'autres sites)
- Decision : `ok` / `flag_image` (masquer image en attente) / `reject_listing`

```python
# apps/listings/image_moderation.py
def moderate_image(image_url: str) -> dict:
    """
    { "decision": "ok|flag|reject", "reason": str, "confidence": 0.0-1.0 }
    """
```

---

#### 🟠 [AI-09] Agent de résolution de litiges
**Priorité :** Élevé — les litiges sont chronophages pour l'admin  
**Déclencheur :** Ouverture d'un litige (`DisputeView.post()`)  
**Logique :**
- Analyse : historique de commande, messages échangés, rating acheteur et vendeur, photos de livraison éventuelles
- Produit un rapport structuré pour l'admin avec recommandation (rembourser / libérer escrow / enquête)
- Envoie le rapport à l'admin par email (via `send_mail()`)

```python
# core/dispute_agent.py
def analyze_dispute(order) -> dict:
    """
    { "recommendation": "refund|release|investigate",
      "confidence": 0.0-1.0, "summary": str, "risk_factors": list }
    """
```

---

#### 🟡 [AI-10] Agent de qualité des annonces
**Priorité :** Moyen — améliore l'expérience acheteur  
**Déclencheur :** Modération initiale + scan hebdomadaire des annonces actives  
**Logique :**
- Score de qualité (0-100) basé sur : longueur description, nombre d'images, prix renseigné, ville renseignée, catégorie précise
- Suggestions automatiques envoyées au vendeur : "Votre annonce 'Moto Honda' a un score de 45/100. Ajoutez des photos pour augmenter vos chances de vente de 3x."
- NE bloque PAS l'annonce, seulement des suggestions proactives

---

#### 🟡 [AI-11] Agent de détection de compte dupliqué
**Priorité :** Moyen — protège l'intégrité de la plateforme  
**Déclencheur :** Nouvel inscription  
**Logique :**
- Compare : prénom/nom similaires, numéro de téléphone proche (ex: +224 620 001 234 vs +224 620 001 235), même device fingerprint, même IP que compte banni
- Decision : `ok` / `flag_for_review` / `auto_suspend`

---

#### 🟢 [AI-12] Agent de traduction locale
**Priorité :** Bas — différenciateur business fort  
**Déclencheur :** À la demande (bouton "Traduire" sur annonce) ou auto si langue détectée  
**Logique :**
- Claude traduit titre + description vers : Pular (Fula), Mandingo, Susu, anglais
- Stocké en base comme `listing.translations = { "pular": "...", "mandingo": "..." }`
- Permet aux acheteurs ruraux (souvent moins francophones) d'accéder au catalogue

---

## PARTIE 4 — PLAN D'ACTION

### Corrections sécurité immédiates (1-2 jours)

```
[FAILLE-01] Clarifier CSRF : activer avec exemptions API OU documenter JWT-only
[FAILLE-02] Orange webhook : changer `return True` → `return False` si secret absent
[FAILLE-03] Reviews : ajouter vérification commande COMPLETED avant création
[FAILLE-04] Re-modération : appeler moderate_listing_task dans update() si description change
[FAILLE-05] Messages : ajouter throttle 60/heure sur endpoint envoi
```

### Agents IA à développer (ordre de priorité)

```
Sprint 1 : AI-07 (chat safety) + AI-06 (reviews fraude)
Sprint 2 : AI-08 (image moderation) + AI-09 (dispute resolution)
Sprint 3 : AI-10 (listing quality) + AI-11 (duplicate accounts)
Sprint 4 : AI-12 (traduction locale) — différenciateur marché
```

---

## RÉSUMÉ EXÉCUTIF

**Score sécurité actuel : 7/10**

Le projet a une base solide : middleware multi-couches, throttling, JWT + blacklist, vérification signatures webhook, Sentry. Les points critiques sont l'Orange webhook sans secret (faille payment) et les reviews sans validation (fausse réputation).

**Couverture IA actuelle : 5 agents** (modération, sécurité, recherche, assistant, recommandations)
**Couverture IA cible : 12 agents** — les 7 nouveaux comblent les angles morts : arnaques en chat, fausses reviews, images, litiges, qualité, comptes dupliqués, langues locales.

L'investissement le plus rentable à court terme : **AI-07 (chat safety)** — c'est là où 80% des arnaques sur les marketplaces africaines se produisent.
