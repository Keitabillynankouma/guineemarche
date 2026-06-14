# GuinéeMarché — Application Mobile (React Native + Expo)

## Structure
```
mobile/
├── App.js                        # Point d'entrée, QueryClient + Navigation
├── app.json                      # Config Expo (nom, icône, splash, bundle ID)
├── babel.config.js
├── package.json
└── src/
    ├── services/api.js           # Tous les appels API (authAPI, listingsAPI, etc.)
    ├── store/authStore.js        # Zustand — session JWT via SecureStore
    ├── theme.js                  # Couleurs, spacing, fonts
    ├── navigation/
    │   └── AppNavigator.js       # Stack + BottomTabs
    ├── components/
    │   └── ListingCard.js        # Carte annonce réutilisable
    └── screens/
        ├── LoginScreen.js
        ├── RegisterScreen.js
        ├── HomeScreen.js         # Recherche + filtres + liste infinie
        ├── ListingDetailScreen.js # Galerie + commande + messagerie
        ├── MessagesScreen.js     # Liste convs + chat + messages rapides
        ├── OrdersScreen.js       # Achats & ventes avec actions
        └── ProfileScreen.js      # Profil + abonnement + menu
```

## Démarrage rapide

### Prérequis
- Node.js 18+
- Expo CLI : `npm install -g expo-cli`
- Application **Expo Go** sur votre téléphone (Android/iOS)

### Installation
```bash
cd mobile
npm install
```

### Lancer
```bash
npx expo start
```
Scannez le QR code avec l'app Expo Go.

### ⚠️ Configuration obligatoire

Dans `src/services/api.js`, changez `BASE_URL` :

```js
// Développement local (remplacez par l'IP de votre machine) :
export const BASE_URL = 'http://192.168.1.X:8000/api/v1'

// Production :
export const BASE_URL = 'https://guineemarche.onrender.com/api/v1'
```

> **CORS** : Assurez-vous que votre IP locale est dans `CORS_ALLOWED_ORIGINS` du backend Django.

## Build production (EAS)

```bash
npm install -g eas-cli
eas login
eas build --platform android   # APK / AAB pour Google Play
eas build --platform ios       # IPA pour App Store
```

Avant le build, renseignez votre `projectId` dans `app.json` → `extra.eas.projectId`.

## Fonctionnalités

| Écran | Fonctionnalités |
|-------|----------------|
| Accueil | Recherche, filtres ville/catégorie, scroll infini, FAB publier |
| Détail annonce | Galerie multi-photos, commande, messagerie vendeur |
| Messages | Liste conversations, chat temps réel, 7 messages rapides ⚡ |
| Commandes | Onglets Achats/Ventes, timeline statut, actions |
| Profil | Stats, abonnement, menu navigation, déconnexion |
| Auth | Connexion, inscription, session persistante (SecureStore) |
