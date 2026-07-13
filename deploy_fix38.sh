#!/bin/bash
# Fix #38 — Dashboard admin frontend : Livraisons, Commandes, Utilisateurs
cd "$(dirname "$0")"
git add \
  apps/orders/views.py \
  apps/orders/urls.py \
  apps/accounts/views.py \
  apps/accounts/urls.py \
  frontend/src/pages/AdminPage.jsx

git commit -m "feat(admin): dashboard livraisons + commandes + utilisateurs

Backend
- AdminOrderListView  : GET /orders/admin/orders/ (filtre status/mode/search)
- AdminDeliveryReassignView : POST /orders/admin/assignments/<id>/reassign/
- AdminUserListView   : GET /accounts/admin/users/ (filtre role/search/is_active)
- AdminUserUpdateView : PATCH /accounts/admin/users/<id>/ (role, is_active, is_staff)
- AdminLivreurListView : expose is_available dans la réponse
- AdminStatsView : +livreurs_available, +orders_today, +deliveries_* (total/en_route/assigned/today)

Frontend AdminPage.jsx
- Onglet 🚚 Livraisons : suivi en temps réel (assigned/en_route/delivered), codes pickup+verification, réassignation livreur inline
- Onglet 📋 Commandes : liste complète avec filtres statut/mode/recherche
- Onglet 👥 Utilisateurs : stats par rôle, toggle actif/inactif, changement de rôle
- Dashboard : 11 stats cards (livreurs dispo, commandes aujourd'hui, livrées aujourd'hui...)
- Badge orange sur onglet Livraisons quand des livraisons sont en cours"

git push
echo "✅ Déployé"
