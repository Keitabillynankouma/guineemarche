# 🗺️ Feuille de Route — GuinéeMarché

**Version 1.0 — Juin 2026**
Marketplace mobile-first pour la Guinée · Orange Money + MTN MoMo · Escrow sécurisé

---

## État actuel (avant publication)

✅ Toutes les fonctionnalités critiques sont en place et corrigées :

| Fonctionnalité | Statut |
|---|---|
| Inscription / OTP SMS (Africa's Talking) | ✅ |
| Authentification JWT + refresh token | ✅ |
| Publication d'annonces avec sous-catégories | ✅ |
| Photos via Cloudinary | ✅ |
| Paiement Orange Money & MTN MoMo | ✅ |
| Escrow sécurisé (fonds bloqués jusqu'à réception) | ✅ |
| Litiges + interface admin de résolution | ✅ |
| Boutiques (shops) pour grands vendeurs | ✅ |
| Annonces publicitaires (banners) | ✅ |
| Notifications temps réel (WebSocket) | ✅ |
| Abonnement Pro (annonces illimitées) | ✅ |
| Badges automatiques | ✅ |
| PWA (Add to Home Screen) | ✅ |
| Partage WhatsApp sur les annonces | ✅ |
| Rate limiting anti-brute force OTP | ✅ |
| Vérification signature webhooks paiement | ✅ |
| Index base de données (performance) | ✅ |

---

## Phase 1 — Lancement (Juillet 2026)

**Objectif : 0 → 500 utilisateurs, 200 annonces actives**

### Avant de lancer publiquement

- [ ] **Variables d'environnement Render** : vérifier que toutes les clés sont configurées
  - `ORANGE_MONEY_*`, `MTN_MOMO_*`, `AT_USERNAME`, `AT_API_KEY`
  - `ORANGE_WEBHOOK_SECRET`, `MTN_WEBHOOK_SECRET`
  - `DJANGO_SECRET_KEY` (valeur forte, aléatoire)
  - `ALLOWED_HOSTS` avec les domaines Render
  - `DEBUG=False` en production
- [ ] **Tester le flux complet** en production :
  - Inscription → OTP SMS reçu → vérification → publication → commande → paiement → réception
- [ ] **Noms de domaine** : envisager `guineemarche.com` ou `.gn` (plus professionnel)
- [ ] **Créer 5 à 10 annonces "seed"** pour que la page d'accueil ne soit pas vide
- [ ] **Créer le compte admin** et tester l'interface de gestion des litiges
- [ ] **Tester sur Android + iOS** (vérifier le "Add to Home Screen")

### Actions marketing

- [ ] Groupe WhatsApp de lancement avec 50 contacts bêta testeurs à Conakry
- [ ] Publication sur Facebook Guinée (groupes d'achat/vente locaux)
- [ ] Page Facebook GuinéeMarché + premier post avec lien de téléchargement
- [ ] Vidéo courte (30s) montrant comment publier une annonce → WhatsApp + TikTok

---

## Phase 2 — Croissance (Août–Octobre 2026)

**Objectif : 2 000 utilisateurs, 1 000 annonces, 50 transactions/mois**

### Fonctionnalités prioritaires

- [ ] **Notation vendeurs** après une transaction complétée
  - Formulaire simple : étoiles 1–5 + commentaire
  - Visible sur la page profil et les annonces du vendeur
- [ ] **Système de parrainage** : code de parrainage → crédits ou annonce gratuite supplémentaire
- [ ] **Notifications push** (Web Push API) pour les messages et commandes
  - Utiliser `pywebpush` côté backend
  - Enregistrer le `PushSubscription` dans le service worker
- [ ] **Recherche avancée** avec filtres prix min/max, état, sous-catégorie
- [ ] **Annonces "urgentes"** (badge rouge "vente rapide") — option payante
- [ ] **Statistiques vendeur** : vues de ses annonces, taux de conversion
- [ ] **Sentry** pour le monitoring des erreurs en production
  - `pip install sentry-sdk` + `sentry_sdk.init(dsn=...)` dans `settings.py`
  - `npm install @sentry/react` côté frontend

### Infrastructure

- [ ] Migrer vers **PostgreSQL managed** (Render Database ou Supabase) — éviter la perte de données
- [ ] Mettre en place un **backup quotidien** de la base de données
- [ ] Configurer **Celery + Redis** sur Render pour les tâches asynchrones (SMS en background, expiration des annonces)
- [ ] **CDN pour les images** Cloudinary déjà en place — vérifier les transformations (compression auto)

---

## Phase 3 — Monétisation (Novembre 2026–Janvier 2027)

**Objectif : 10 000 utilisateurs, 200 transactions/mois, revenus réguliers**

### Sources de revenus

| Source | Modèle | Estimation |
|---|---|---|
| Commission escrow (5%) | Par transaction | Variable |
| Abonnement Pro (50 000 GNF/mois) | Mensuel | 50k × nb Pro |
| Boost d'annonce (10 000–20 000 GNF) | Ponctuel | Variable |
| Banners publicitaires (boutiques) | Mensuel/semaine | Variable |
| Partenariats boutiques Pro (forfait) | Mensuel | À négocier |

### Nouvelles fonctionnalités

- [ ] **Paiement abonnement Pro via Mobile Money** (connecter `SubscriptionView.post` au vrai flux de paiement)
- [ ] **Livraison partenaire** : intégrer un service de livraison local à Conakry
- [ ] **GuinéeMarché Business** : tableau de bord avancé pour les boutiques Pro (stats, multi-annonces en batch)
- [ ] **Vérification d'identité vendeur** : photo CNI + selfie → badge "Vendeur vérifié"
- [ ] **Chat en temps réel** avec lecture des messages (vu/non vu)
- [ ] **Catégories expandées** : immobilier (location/vente), emploi, services

---

## Phase 4 — Expansion (2027)

**Objectif : présence dans toutes les grandes villes de Guinée**

- [ ] Extension aux villes : Kankan, Labé, N'Zérékoré, Kindia, Faranah
- [ ] Application mobile native React Native (ou Capacitor.js depuis le frontend existant)
- [ ] API partenaires pour intégrer GuinéeMarché dans d'autres apps
- [ ] Programme d'affiliation pour les revendeurs locaux

---

## Ressources humaines recommandées

Pour passer de la phase 1 à la phase 3, voici le minimum nécessaire :

| Rôle | Priorité | Profil | Coût estimé |
|---|---|---|---|
| **Toi (Billy)** — Dev + fondateur | Immédiat | Full-stack | — |
| **Community Manager** | Phase 2 | Maîtrise WhatsApp/Facebook, guinéen(ne), connaît le marché local | 500k–1M GNF/mois |
| **Agent de vérification** (mi-temps) | Phase 2 | Vérifie les CNI des vendeurs, gère les litiges côté humain | 300k–500k GNF/mois |
| **Développeur junior** | Phase 3 | Pour accélérer le développement produit | 1M–2M GNF/mois |

**Total équipe phase 2 :** ~1,5M GNF/mois (~175 USD)

---

## Factures et coûts récurrents

| Service | Fréquence | Coût estimé |
|---|---|---|
| Render (backend + frontend) | Mensuel | ~25–50 USD |
| Cloudinary (images) | Mensuel | Gratuit jusqu'à 25 Go |
| Africa's Talking (SMS OTP) | À l'usage | ~0.04 USD/SMS |
| Nom de domaine | Annuel | 10–15 USD/an |
| Redis (Celery) | Mensuel | ~10 USD (Render Redis) |
| **Total infra phase 1** | Mensuel | **~45–80 USD** |

---

## Seuil de rentabilité estimé

Pour couvrir les coûts infra (80 USD/mois) avec la commission de 5% :

- Transaction moyenne : 300 000 GNF (~35 USD)
- Commission : 15 000 GNF (~1.75 USD)
- **Transactions nécessaires : ~46/mois** pour atteindre le seuil

C'est réaliste dès la phase 2 avec une base de 2 000 utilisateurs actifs.

---

## Checklist avant publication officielle

- [ ] `DEBUG=False` dans les variables d'environnement Render
- [ ] Tous les secrets de paiement configurés
- [ ] Test du flux complet en production (pas en sandbox)
- [ ] Page 404 et page d'erreur conviviales
- [ ] Politique de confidentialité (page `/privacy`) — requis par les stores
- [ ] Conditions générales d'utilisation (page `/terms`)
- [ ] Email de support configuré (ex: support@guineemarche.com)
- [ ] Compte admin créé en production
- [ ] 5+ annonces de test supprimées, 5+ vraies annonces présentes
- [ ] Test sur Android Chrome + iOS Safari (PWA)
- [ ] Test du partage WhatsApp
- [ ] Vérifier que les notifications SMS arrivent bien

---

*Bonne chance Billy ! GuinéeMarché a toutes les bases techniques pour réussir.* 🇬🇳
