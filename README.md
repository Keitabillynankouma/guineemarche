# GuinéeMarché

Marketplace mobile-first pour la Guinée Conakry. Acheteurs et vendeurs peuvent publier des annonces, échanger par messagerie, et finaliser des transactions via un système d'escrow.

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Django 5.2 + Django REST Framework |
| Frontend | React 18 + Vite + TailwindCSS |
| Base de données | PostgreSQL (production) / SQLite (local) |
| Temps réel | Django Channels + Redis (WebSocket) |
| Stockage images | Cloudinary |
| Fichiers statiques | WhiteNoise |
| SMS / OTP | Africa's Talking |
| Hébergement | Render |

## Structure du projet

```
guineemarche/
├── config/           # Paramètres Django, URLs, ASGI/WSGI
├── apps/
│   ├── accounts/     # Authentification par numéro de téléphone + OTP
│   ├── listings/     # Annonces, catégories, favoris, signalements
│   ├── messaging/    # Conversations acheteur/vendeur
│   ├── orders/       # Commandes et paiements (escrow)
│   ├── reviews/      # Avis et notes
│   └── notifications/# Notifications temps réel (WebSocket)
├── core/             # Modèles de base, utilitaires, SMS
├── frontend/         # React + Vite (SPA)
├── build.sh          # Script de déploiement Render
└── Makefile          # Commandes de développement
```

## Installation locale

### Prérequis
- Python 3.11+
- Node.js 18+
- Redis (pour les WebSockets)

### Backend

```bash
python -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows

make install
cp .env.example .env          # Remplir les variables
make migrate
make superuser
make run
```

### Frontend

```bash
make frontend-install
make frontend-dev
```

## Variables d'environnement

Créer un fichier `.env` à la racine (voir `.env.example`) :

```env
# Django
SECRET_KEY=votre-cle-secrete-tres-longue
DEBUG=True
DATABASE_URL=postgresql://user:password@localhost:5432/guineemarche

# Redis
REDIS_URL=redis://localhost:6379/0

# Cloudinary (stockage des images)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Africa's Talking (SMS OTP)
AT_USERNAME=sandbox          # 'sandbox' en dev, votre username en prod
AT_API_KEY=...
AT_SENDER_ID=                # Laisser vide en sandbox
```

## API — Points d'entrée principaux

| Méthode | URL | Description |
|---|---|---|
| POST | `/api/v1/accounts/register/` | Inscription (envoi OTP) |
| POST | `/api/v1/accounts/verify-otp/` | Vérification OTP |
| POST | `/api/v1/accounts/login/` | Connexion JWT |
| POST | `/api/v1/accounts/logout/` | Déconnexion |
| GET | `/api/v1/accounts/me/` | Profil utilisateur connecté |
| GET | `/api/v1/listings/` | Liste des annonces actives |
| POST | `/api/v1/listings/` | Créer une annonce (multipart/form-data) |
| GET | `/api/v1/listings/{id}/` | Détail d'une annonce |
| GET | `/api/v1/listings/my/` | Mes annonces |
| GET | `/api/v1/listings/categories/` | Catégories |
| POST | `/api/v1/listings/favorites/` | Ajouter aux favoris |
| POST | `/api/v1/messaging/start/` | Démarrer une conversation |
| GET | `/api/v1/messaging/{id}/messages/` | Messages d'une conversation |
| POST | `/api/v1/orders/` | Créer une commande |
| POST | `/api/v1/orders/{id}/pay/` | Payer une commande |

Authentification : JWT Bearer token dans le header `Authorization`.

## Fonctionnalités clés

### Inscription / OTP
1. L'utilisateur s'inscrit avec son numéro de téléphone guinéen (+224)
2. Un OTP à 6 chiffres est envoyé par SMS via Africa's Talking
3. L'OTP est valide 10 minutes
4. Après vérification, le compte est activé

### Annonces
- Upload d'images compressées côté client (max 1200px, JPEG 75%)
- Stockage permanent sur Cloudinary (persiste entre les déploiements)
- Statut : brouillon → active → vendue/expirée
- Filtres : ville, catégorie, prix, condition

### Escrow / Paiements
- L'acheteur paie, les fonds sont gelés en escrow
- Le vendeur prépare et livre la commande
- L'acheteur confirme la réception → paiement libéré au vendeur
- Système de dispute en cas de litige

### Temps réel
- Notifications WebSocket pour : nouveaux messages, changements de statut de commande
- Canal Redis requis (`REDIS_URL`)

## Déploiement (Render)

### Variables à configurer sur Render

```
SECRET_KEY        → clé secrète Django (longue et aléatoire)
DEBUG             → False
DATABASE_URL      → URL PostgreSQL Render
REDIS_URL         → URL Redis Render
CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET → compte Cloudinary
AT_USERNAME       → votre username Africa's Talking (production, pas "sandbox")
AT_API_KEY        → clé API Africa's Talking production
```

### Build automatique
Le fichier `build.sh` est exécuté à chaque déploiement :
```bash
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
```

### Images après redéploiement
Les images sont stockées sur **Cloudinary** et persistent entre les déploiements. Le système de fichiers de Render est éphémère — ne jamais compter sur le dossier `media/` local en production.

## SMS en production

Africa's Talking fonctionne en mode **sandbox** par défaut (messages visibles uniquement dans le simulateur web). Pour envoyer de vrais SMS :

1. Créer un compte live sur Africa's Talking
2. Changer `AT_USERNAME` de `sandbox` → votre vrai username
3. Utiliser la clé API **live** (pas la clé sandbox)

## Commandes utiles

```bash
make run              # Lancer le serveur Django
make migrate          # Migrations
make shell            # Shell Django interactif
make superuser        # Créer un superutilisateur
make test             # Lancer les tests
make freeze           # Mettre à jour requirements.txt
make deploy-check     # Vérifier la config pour la production
make frontend-dev     # Lancer le serveur de développement React
make frontend-build   # Build React pour production
```
