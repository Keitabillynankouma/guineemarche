# GuinéeMarché — Référentiel des Fonctionnalités
**Mis à jour le 14 juin 2026**

---

## 1. Fonctionnalités Implémentées ✅

### Authentification & Utilisateurs
- ✅ Connexion par numéro de téléphone guinéen + OTP SMS
- ✅ Rôles : Acheteur, Vendeur, Administrateur
- ✅ Vérification du compte (`is_verified`)
- ✅ Rate limiting sur les endpoints OTP
- ✅ JWT (access + refresh tokens, blacklist)
- ✅ Profil utilisateur (avatar Cloudinary, bio, note moyenne)

### Annonces
- ✅ Modèle Listing : titre, description, prix (fixe / à débattre / gratuit), condition, statut
- ✅ Catégories & sous-catégories avec icônes
- ✅ Attributs dynamiques par catégorie (`CategoryAttribute`)
- ✅ Gestion des images via Cloudinary
- ✅ Boost d'annonce : flag `is_boosted`, date d'expiration, auto-désactivation
- ✅ Auto-expiration des annonces après 30 jours
- ✅ Compteur de vues (race condition corrigée)
- ✅ Index de base de données sur `Listing` (performance)
- ✅ Partage d'annonce via WhatsApp

### Boutiques
- ✅ Modèle `Shop` : logo, description, ville, statut (PENDING / ACTIVE / SUSPENDED)
- ✅ Plans tarifaires : BASIC / PRO / ELITE avec limites d'annonces
- ✅ Création boutique avec upload logo séparé (robustesse Cloudinary)
- ✅ Approbation manuelle par l'admin (`shop_approval_required`)
- ✅ Notification admin à chaque nouvelle boutique soumise
- ✅ Badge d'abonnement sur le profil vendeur

### Commandes & Paiements
- ✅ Modèle `Order` avec modes de livraison (pickup, meet, delivery)
- ✅ Paiement Orange Money (initiation + callback)
- ✅ Paiement MTN MoMo (initiation + callback)
- ✅ Système escrow : fonds bloqués jusqu'à confirmation réception
- ✅ Commission configurable (`SiteSettings.commission_pct`)
- ✅ Vérification de signature webhook paiement
- ✅ Points de retrait (`PickupPoint`) : CRUD admin + liste publique filtrée par ville
- ✅ Endpoint commandes reçues pour vendeurs

### Litiges
- ✅ Modèle `Dispute` lié à une commande
- ✅ Ouverture litige par acheteur ou vendeur
- ✅ Résolution litige par l'admin avec motif
- ✅ Notifications automatiques acheteur + vendeur à la résolution

### Notifications & Messagerie
- ✅ Notifications temps réel via WebSocket (Django Channels)
- ✅ JWT parsing WebSocket corrigé
- ✅ Notifications : nouvelle commande, statut commande, approbation boutique
- ✅ Messagerie entre utilisateurs

### Avis & Évaluations
- ✅ Modèle `Review` : note, commentaire, lié à une commande
- ✅ Mise à jour automatique de la note moyenne vendeur

### Administration & Configuration
- ✅ `SiteSettings` singleton (pk=1) : feature flags, commission, contact, maintenance
- ✅ Flags : `free_listings_enabled`, `subscriptions_enabled`, `max_free_listings`
- ✅ Flags : `escrow_enabled`, `shop_approval_required`, `maintenance_mode`
- ✅ Contact : `whatsapp_contact`, `support_email`
- ✅ API admin : annonces, publicités (banners), catégories, boutiques, litiges, points retrait
- ✅ Statistiques admin (`AdminStatsView`)
- ✅ Permissions `IsAdmin` centralisées

### Frontend — Pages & Navigation
- ✅ Routing React Router v6
- ✅ HomePage : carrousel bannières auto-play, catégories sticky, scroll infini (IntersectionObserver)
- ✅ HomePage : badges Nouveau (<24h) et Boosté, skeleton cards, section "Vu récemment"
- ✅ `ListingDetailPage` : galerie avec flèches prev/next + lightbox fullscreen (←→ Esc, miniatures)
- ✅ `ListingDetailPage` : boost panel visible uniquement pour le vendeur (isSeller corrigé)
- ✅ `ListingDetailPage` : badge "🔥 populaire", annonces similaires, "Vu récemment" (localStorage)
- ✅ `UpgradePage` : 3 plans tarifaires avec tableau comparatif
- ✅ `AdminPage` : 7 onglets (Tableau de bord, Annonces, Publicités, Catégories, Boutiques, **Points retrait**, Paramètres)
- ✅ Lien Admin depuis la page Profil

### Frontend — Vendeur & UX
- ✅ Vue Ma Boutique : création, édition, statut d'approbation
- ✅ Dashboard analytique vendeur : ventes, vues, revenus
- ✅ Auto-boost et auto-expiration des annonces
- ✅ Bouton support flottant (bas droite) : WhatsApp + Email (affiché si configuré)
- ✅ PWA : manifest + service worker (mode offline basique)
- ✅ Hook `useSettings()` pour lire les feature flags en temps réel
- ✅ TanStack Query : cache intelligent, refetch automatique
- ✅ Zones de rendez-vous : 20+ villes de Guinée, 60+ points (`meetingZones.js`)

---

## 2. 🚨 Bilan Render — Actions Requises

> **Tu n'as PAS encore appliqué les modifications sur Render. Voici les étapes exactes dans l'ordre.**

### Étape 1 — 🔴 CRITIQUE : Corriger `CLOUDINARY_API_SECRET`
```
Render Dashboard → ton service Web → Environment
→ Trouver la variable CLOUDINARY_API_SECRET
→ La valeur actuelle fait ~16 caractères (tronquée)
→ Elle doit faire ~27 caractères (copier depuis cloudinary.com → Console → API Keys)
```
**Sans ça, tout upload d'image (logo boutique, photos annonce) retourne 500.**

### Étape 2 — 🔴 OBLIGATOIRE : Pusher le code
```bash
cd C:\Users\DNTCP\guineemarche
git add -A
git commit -m "feat: points retrait admin, support email, lightbox images, homepage v2, meeting zones Guinée"
git push
```
Render redéploiera automatiquement après le push.

### Étape 3 — 🟠 APRÈS DÉPLOIEMENT : Lancer les migrations
Dans **Render → ton service → Shell** :
```bash
python manage.py migrate
```
Applique les migrations jusqu'à `0005_referral` (parrainage, code référent, bonus slots).

### Étape 4 — 🟡 RECOMMANDÉ : Configurer le support
Dans l'admin Django (`/admin → Site Settings`) :
- `whatsapp_contact` → ex. `224620000000`
- `support_email` → ton adresse de support

Ces valeurs s'afficheront dans le bouton flottant sur le site.

### Étape 5 — 🟡 VÉRIFICATION : Tester la création de boutique
Créer une boutique test depuis un compte vendeur.
- Réponse `201` → tout fonctionne ✅
- Réponse `500` → `CLOUDINARY_API_SECRET` encore incorrect 🔴

### Checklist résumée

| # | Urgence | Action | Fait ? |
|---|---------|--------|--------|
| 1 | 🔴 CRITIQUE | Corriger `CLOUDINARY_API_SECRET` dans Render (> 27 chars) | ⬜ |
| 2 | 🔴 OBLIGATOIRE | `git add -A && git commit && git push` | ⬜ |
| 3 | 🟠 APRÈS PUSH | `python manage.py migrate` (Render Shell) | ⬜ |
| 4 | 🟡 RECOMMANDÉ | Configurer WhatsApp + email dans `/admin` | ⬜ |
| 5 | 🟡 VÉRIF | Tester création boutique → doit retourner 201 | ⬜ |

---

## 3. Prochaines Fonctionnalités à Développer

| Fonctionnalité | Priorité | Effort | Statut |
|----------------|----------|--------|--------|
| Paiement boost automatique (Orange Money / MTN) | 🔴 Haute | Moyen | ✅ Fait |
| Page Commandes avec timeline de statut | 🔴 Haute | Faible | ✅ Fait |
| Messagerie temps réel (WebSocket chat) | 🔴 Haute | Élevé | ✅ Fait |
| Recherche full-text avec filtres avancés | 🔴 Haute | Moyen | ✅ Fait |
| Notifications push PWA | 🟠 Moyenne | Moyen | ✅ Fait |
| Page avis & évaluations publique vendeur | 🟠 Moyenne | Faible | ✅ Fait |
| Système de favoris (wishlist) | 🟠 Moyenne | Faible | ✅ Fait |
| Export admin CSV (commandes, utilisateurs) | 🟠 Moyenne | Faible | ✅ Fait |
| Tableau de bord vendeur avancé (graphiques) | 🟠 Moyenne | Moyen | ✅ Fait |
| Application mobile React Native (Expo) | 🟡 Basse | Très élevé | ✅ Fait |
| Vérification identité vendeur (KYC) | 🟡 Basse | Élevé | ⬜ À faire |
| Programme de parrainage / referral | 🟡 Basse | Moyen | ✅ Fait |

---

*Document généré automatiquement — GuinéeMarché © 2026*
