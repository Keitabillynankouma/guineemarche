#!/bin/bash
# Fix #37 — Vue admins + barre de recherche unifiée
cd "$(dirname "$0")"
git add \
  apps/accounts/models.py \
  apps/accounts/admin.py \
  apps/accounts/migrations/0010_adminuser_proxy.py \
  frontend/src/pages/HomePage.jsx

git commit -m "feat(admin+search): vue équipe admin + barre de recherche unifiée IA/classique

Vue Équipe Admin (#37)
- Proxy model AdminUser (pas de nouvelle table)
- Migration 0010 : proxy model
- Section dédiée 'Équipe Admin' dans le panel Django
- Filtrage auto : role=admin OU is_staff=True
- Colonnes enrichies : rôle (badge couleur), staff ✓, superuser ✓, dernière connexion (relative)
- Actions bulk : Promouvoir en admin / Rétrograder / Accorder superuser / Retirer superuser / Activer / Désactiver

Barre de recherche unifiée (#37)
- Suppression de la double barre (AISearchBar + classique séparées)
- Nouveau composant SmartSearchBar intégré dans HomePage
- Toggle IA (✨) / Classique (🔍)
- Mode IA : appel POST /listings/ai-search/ + interprétation affichée
- Mode classique : debounce 400ms sur la liste d'annonces + filtre ville
- Suggestions d'exemples en mode IA (champ vide)"

git push
echo "✅ Déployé — Railway lance les migrations automatiquement"
