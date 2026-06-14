# GuinéeMarché — Documentation Complète

> Première marketplace en ligne de Guinée (Conakry)
> Version 1.0 — Juin 2026

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Fonctionnalités](#3-fonctionnalités)
4. [API — Endpoints](#4-api--endpoints)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Guide de déploiement](#6-guide-de-déploiement)
7. [Guide administrateur](#7-guide-administrateur)
8. [Sécurité](#8-sécurité)
9. [Audit & Améliorations suggérées](#9-audit--améliorations-suggérées)
10. [Roadmap](#10-roadmap)

---

## 1. Vue d'ensemble

GuinéeMarché est une plateforme de commerce en ligne adaptée au marché guinéen. Elle permet aux vendeurs de publier des annonces et aux acheteurs de les contacter, de payer via Mobile Money et de suivre leurs commandes.

**URL de production :** https://guineemarche-frontend.onrender.com
**API backend :** https://guineemarche.onrender.com/api/v1/

**Chiffres clés (à date) :**
- 15 annonces publiées
- 11 utilisateurs inscrits
- 75 000 GNF de volume de transactions
- Paiement via Orange Money et MTN MoMo (simulation active)

---

## 2. Architecture technique

### Stack

| Couche | Technologie | Version |
|---|---|---|
| Backend | Django + Django REST Framework | 5.2 / 3.17 |
| Auth | JWT (SimpleJWT) | 5.5 |
| Base de données | PostgreSQL (prod) / SQLite (dev) | 18 / 3 |
| Cache / WebSocket | Redis (Valkey) + Django Channels | 8 |
| Frontend | React + Vite + TanStack Query | 19 / 8 / 5 |
| État global | Zustand | 5 |
| Style | Tailwind CSS | 3.4 |
| Stockage médias | Cloudinary | — |
| Tâches async | Celery | 5.6 |
| SMS OTP | Africa's Talking | — |
| IA Support | Claude Haiku (Anthropic) | claude-haiku-4-5 |
| IA Modération | Claude Haiku (Anthropic) | claude-haiku-4-5 |
| Monitoring | Sentry | 2.x |
| Déploiement | Render.com | — |

### Structure du projet

```
guineemarche/
├── apps/
│   ├── accounts/        # Authentification, profils, abonnements, parrainage
│   ├── listings/        # Annonces, catégories, favoris, signalements, publicités
│   ├── messaging/       # Messagerie temps réel (WebSocket)
│   ├── orders/          # Commandes, paiements, points de retrait
│   ├── reviews/         # Avis et évaluations vendeurs
│   └── notifications/   # Notifications in-app
├── core/                # Paramètres site, sécurité, pagination, chatbot support
├── config/              # Settings Django, URLs, ASGI
└── frontend/            # Application React
    └── src/
        ├── pages/       # 17 pages (HomePage, ListingDetailPage, AdminPage…)
        ├── components/  # SupportChatWidget
        ├── services/    # api.js (Axios)
        ├── hooks/       # useSettings, useRecentlyViewed…
        └── store/       # Zustand (authStore)
```

### Flux de données

```
Utilisateur → React (Vite) → Axios (JWT) → Django REST API → PostgreSQL
                                                           → Cloudinary (images)
                                                           → Redis (WebSocket / cache)
                                                           → Celery (tâches async)
                                                           → Anthropic API (IA)
                                                           → Africa's Talking (SMS)
```

---

## 3. Fonctionnalités

### Utilisateurs
- Inscription par numéro de téléphone guinéen (+224)
- Vérification OTP par SMS (Africa's Talking)
- Rôles : Acheteur / Vendeur / Administrateur
- Profil avec photo, ville, quartier
- Programme de parrainage (code unique → bonus d'annonces)

### Annonces
- Création avec photos multiples (Cloudinary)
- Catégories et sous-catégories avec attributs dynamiques
- Filtres : prix, ville, catégorie, état, type de prix
- Recherche full-text
- Expiration automatique après 30 jours
- **Modération automatique par IA** : approuvée / en révision / refusée
- Boost d'annonce (mise en avant 7 jours)

### Paiements
- Orange Money Guinée
- MTN Mobile Money Guinée
- Commission plateforme : 4%
- Escrow (fonds retenus jusqu'à confirmation de livraison)
- Mode simulation actif (en attente des accords opérateurs)

### Abonnements
| Plan | Annonces | Prix | Avantages |
|---|---|---|---|
| Gratuit | 3 | 0 GNF | Basique |
| Pro | 15 | — | Boost inclus, priorité |
| Business | Illimité | — | Boutique officielle, auto-boost |

### Boutiques
- Page boutique publique par vendeur Pro/Business
- Approbation admin requise
- Badge "Boutique Approuvée"

### Commandes
- Création de commande avec paiement intégré
- Timeline visuelle des statuts (En attente → Confirmée → Terminée)
- Modes de livraison : Main propre / Point de retrait / Livraison domicile
- Gestion des litiges

### Messagerie
- Chat temps réel via WebSocket (Django Channels + Redis)
- Historique des conversations
- Notifications de nouveaux messages

### Support
- **Chatbot IA 24h/24** (Claude Haiku) — répond aux questions courantes
- Contact WhatsApp direct
- Contact Email

### Administration
- Tableau de bord : stats globales (users, annonces, revenus)
- Gestion des annonces (approuver, suspendre, supprimer)
- Gestion des boutiques (approuver, rejeter)
- Gestion des publicités/bannières
- Gestion des catégories et sous-catégories
- Paramètres site (WhatsApp, email, maintenance, feature flags)
- Export CSV commandes et utilisateurs
- Gestion des points de retrait

### Sécurité & Monitoring
- Middleware de sécurité : détection SQL injection, XSS, scanners
- En-têtes HTTP sécurisés (HSTS, X-Frame-Options, nosniff)
- Rate limiting par endpoint
- Sentry : alertes erreurs Django en temps réel
- JWT avec rotation des tokens

---

## 4. API — Endpoints

Base URL : `/api/v1/`

### Authentification (`/accounts/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `register/` | Inscription | Non |
| POST | `send-otp/` | Envoyer OTP SMS | Non |
| POST | `verify-otp/` | Vérifier OTP | Non |
| POST | `login/` | Connexion → JWT | Non |
| POST | `token/refresh/` | Rafraîchir token | Non |
| POST | `logout/` | Déconnexion | Oui |
| GET/PATCH | `me/` | Profil utilisateur | Oui |
| GET | `subscription/` | Abonnement actuel | Oui |
| GET | `badges/` | Badges obtenus | Oui |
| GET | `referral/` | Stats parrainage | Oui |

### Annonces (`/listings/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `` | Liste annonces (filtres, recherche) | Non |
| POST | `` | Créer une annonce | Oui |
| GET | `{id}/` | Détail annonce | Non |
| PATCH | `{id}/` | Modifier annonce | Oui (vendeur) |
| DELETE | `{id}/` | Supprimer annonce | Oui (vendeur) |
| GET | `my/` | Mes annonces | Oui |
| GET | `categories/` | Liste catégories | Non |
| GET | `categories/{id}/attributes/` | Attributs catégorie | Non |
| POST | `favorites/` | Ajouter favori | Oui |
| DELETE | `favorites/{id}/` | Retirer favori | Oui |
| GET | `favorites/` | Mes favoris | Oui |
| POST | `boost/` | Booster une annonce | Oui |
| GET | `banners/` | Publicités actives | Non |

### Messagerie (`/messaging/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `conversations/` | Mes conversations | Oui |
| POST | `conversations/` | Créer conversation | Oui |
| GET | `conversations/{id}/messages/` | Messages d'une conversation | Oui |
| POST | `conversations/{id}/messages/` | Envoyer message | Oui |

WebSocket : `ws://[backend]/ws/chat/{conversation_id}/?token=[JWT]`

### Commandes (`/orders/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `` | Mes achats | Oui |
| POST | `` | Créer commande + paiement | Oui |
| GET | `{id}/` | Détail commande | Oui |
| PATCH | `{id}/status/` | Mettre à jour statut | Oui |
| GET | `seller/` | Mes ventes | Oui |
| GET | `admin/export/` | Export CSV | Admin |
| GET | `pickup-points/` | Points de retrait | Non |

### Avis (`/reviews/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `{userId}/` | Avis d'un vendeur | Non |
| POST | `` | Laisser un avis | Oui |

### Notifications (`/notifications/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `` | Mes notifications | Oui |
| PATCH | `{id}/read/` | Marquer comme lue | Oui |
| PATCH | `read-all/` | Tout marquer lu | Oui |

### Core (`/core/`)
| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `settings/` | Paramètres publics du site | Non |
| PATCH | `settings/` | Modifier paramètres | Admin |
| POST | `support-chat/` | Chatbot IA support | Non |

---

## 5. Variables d'environnement

### Backend (Render Web Service)

| Variable | Description | Requis |
|---|---|---|
| `SECRET_KEY` | Clé secrète Django | ✅ |
| `DEBUG` | `False` en production | ✅ |
| `DATABASE_URL` | URL PostgreSQL Render | ✅ |
| `REDIS_URL` | URL Redis/Valkey Render | ✅ |
| `CLOUDINARY_CLOUD_NAME` | Nom du cloud Cloudinary | ✅ |
| `CLOUDINARY_API_KEY` | Clé API Cloudinary | ✅ |
| `CLOUDINARY_API_SECRET` | Secret Cloudinary | ✅ |
| `AT_USERNAME` | Africa's Talking username | ✅ |
| `AT_API_KEY` | Africa's Talking API key | ✅ |
| `AT_SENDER_ID` | Expéditeur SMS | ✅ |
| `ANTHROPIC_API_KEY` | Clé Claude API (IA) | ✅ |
| `SENTRY_DSN` | DSN projet Django sur Sentry | ✅ |
| `ALLOWED_HOSTS` | Domaines autorisés | ✅ |
| `ORANGE_MONEY_API_KEY` | Clé Orange Money GN | ⏳ En attente |
| `MTN_MOMO_API_USER` | Utilisateur MTN MoMo | ⏳ En attente |
| `MTN_MOMO_API_KEY` | Clé MTN MoMo | ⏳ En attente |
| `MTN_MOMO_SUBSCRIPTION_KEY` | Subscription Key MTN | ⏳ En attente |
| `PAYMENT_RETURN_URL` | URL retour après paiement | ⏳ En attente |
| `PAYMENT_CANCEL_URL` | URL annulation paiement | ⏳ En attente |
| `PAYMENT_WEBHOOK_URL` | URL webhook paiement | ⏳ En attente |

### Frontend (Render Static Site)

| Variable | Description | Requis |
|---|---|---|
| `VITE_API_URL` | URL du backend Django | ✅ |
| `VITE_SENTRY_DSN` | DSN projet React sur Sentry | ✅ |

---

## 6. Guide de déploiement

### Prérequis
- Compte Render.com
- Compte Cloudinary (stockage images)
- Compte Africa's Talking (SMS)
- Compte Anthropic (IA)
- Compte Sentry (monitoring)

### Backend Django

```bash
# 1. Cloner le repo
git clone [repo-url]
cd guineemarche

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Variables d'environnement (copier .env.example → .env)

# 4. Migrations
python manage.py migrate

# 5. Créer super-utilisateur admin
python manage.py createsuperuser

# 6. Lancer en développement
python manage.py runserver
# ou avec Daphne (ASGI) pour WebSocket :
daphne config.asgi:application
```

**Sur Render :**
- Type : Web Service
- Build Command : `pip install -r requirements.txt`
- Start Command : `daphne -b 0.0.0.0 -p $PORT config.asgi:application`
- Après chaque déploiement, lancer via Shell : `python manage.py migrate`

### Frontend React

```bash
cd frontend
npm install
npm run dev        # Développement
npm run build      # Production
```

**Sur Render :**
- Type : Static Site
- Build Command : `npm install && npm run build`
- Publish Directory : `dist`

---

## 7. Guide administrateur

### Accès
- URL : `/admin` depuis l'app (lien dans la page Profil)
- Requiert un compte avec `role = admin`

### Onglets

**Vue d'ensemble**
- Stats : total utilisateurs, annonces actives, revenus
- Graphiques d'activité

**Annonces**
- Liste complète avec filtres par statut
- Actions : approuver, suspendre, supprimer
- ⚠️ Les annonces en `draft` (flaggées par la modération IA) nécessitent une revue manuelle

**Boutiques**
- Demandes d'approbation boutique Pro/Business
- Approuver ou rejeter avec motif

**Paramètres**
- Numéro WhatsApp support : format `224XXXXXXXXX` (sans +)
- Email support
- Message de maintenance
- Activation/désactivation des abonnements
- Limite annonces gratuites
- Feature flags : `free_listings_enabled`, `subscriptions_enabled`

### Export CSV
- Commandes : `Admin → Export CSV → Commandes`
- Utilisateurs : `Admin → Export CSV → Utilisateurs`
- Les fichiers sont téléchargés directement (authentification JWT requise)

---

## 8. Sécurité

### Middleware de sécurité actif
Le middleware `GuineeSecurityMiddleware` analyse chaque requête et bloque :

| Menace | Action | Alerte Sentry |
|---|---|---|
| Scanners (sqlmap, nikto, nmap…) | 403 Forbidden | ✅ |
| SQL Injection dans les paramètres | 400 Bad Request | ✅ |
| XSS dans les paramètres | 400 Bad Request | ✅ |
| Path Traversal (`../../../etc/passwd`) | 400 Bad Request | ✅ |
| Accès fichiers sensibles (`.env`, `.git`) | 404 Not Found | ✅ |

### En-têtes HTTP sécurisés
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Rate Limiting
| Endpoint | Limite anonyme | Limite connecté |
|---|---|---|
| Global API | 200/jour | 1000/jour |
| OTP | 5/heure | — |
| Login | 10/heure | — |
| Support Chat | 200/heure | 500/heure |

### Authentification
- JWT avec rotation des tokens (Access : 2h, Refresh : 30 jours)
- Blacklist des tokens après déconnexion
- OTP SMS obligatoire à l'inscription

---

## 9. Audit & Améliorations suggérées

### 🔴 Priorité haute

**1. Modération IA asynchrone**
Actuellement la modération est synchrone dans `perform_create` → ajoute 1-2 secondes à la création d'annonce. À déplacer dans une tâche Celery.
```python
# apps/listings/tasks.py
@shared_task
def moderate_listing_async(listing_id):
    listing = Listing.objects.get(id=listing_id)
    # ... modération ...
```

**2. Migration référral sur PostgreSQL**
Vérifier que `0005_referral` a bien tourné sur Render :
```bash
# Sur le Shell Render
python manage.py showmigrations accounts
python manage.py migrate accounts 0005_referral
```

**3. CORS en production**
`CORS_ALLOW_ALL_ORIGINS = True` est trop permissif :
```python
# settings.py
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://guineemarche-frontend.onrender.com",
]
```

### 🟡 Priorité moyenne

**4. Notification vendeur sur rejet d'annonce**
Quand la modération rejette une annonce, envoyer une notification in-app et un SMS au vendeur avec la raison.

**5. Onglet "En révision" dans l'admin**
Les annonces en `draft` après modération ne sont pas visibles dans l'admin panel actuel. Ajouter un filtre/onglet pour les traiter rapidement.

**6. Email utilisateur obligatoire**
Le champ `email` est optionnel sur le modèle User. Pour les notifications importantes (confirmation commande, rejet annonce), l'email est plus fiable que le SMS.

**7. Sentry frontend**
Connecter `VITE_SENTRY_DSN` et vérifier la réception des erreurs React dans le dashboard Sentry.

### 🟢 Améliorations futures

**8. Paiements réels Orange Money / MTN**
Signer les accords marchands avec Orange Guinea et MTN Guinea pour passer de la simulation à la production.

**9. Application mobile React Native**
L'app Expo est prête mais pas encore publiée sur le Play Store / App Store.

**10. Système de livraison**
Intégrer un partenaire de livraison à domicile (coursier Conakry).

**11. Annonces vidéo**
Permettre l'upload de courtes vidéos produit (Cloudinary supporte la vidéo).

**12. Statistiques vendeur avancées**
Taux de conversion, portée des annonces, comparaison avec la période précédente.

---

## 10. Roadmap

### ✅ Complété (v1.0)
- Authentification OTP SMS
- Annonces avec photos et catégories
- Recherche et filtres
- Messagerie temps réel
- Commandes avec paiement Mobile Money (simulation)
- Abonnements Pro et Business
- Boutiques officielles
- Programme de parrainage
- Système d'avis et évaluations
- Dashboard analytique vendeur
- Panel administrateur complet
- Export CSV
- PWA (Progressive Web App)
- Chatbot support IA 24h/24
- Modération automatique des annonces par IA
- Middleware de sécurité
- Monitoring Sentry

### 🔄 En cours (v1.1)
- Paiements réels Orange Money / MTN (en attente accords)
- Migration PostgreSQL complète

### 📅 Planifié (v1.2)
- Application mobile React Native (Play Store / App Store)
- Système de livraison à domicile
- Notifications push mobile
- Annonces vidéo

### 🔮 Vision long terme (v2.0)
- Marketplace B2B (grossistes)
- Financement participatif local
- Score de confiance vendeur (IA)
- Paiement en plusieurs fois

---

*Documentation générée le 14 juin 2026*
*GuinéeMarché — guineemarche.sentry.io*
