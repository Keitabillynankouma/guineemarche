#!/bin/bash
# Fix #35 + #36 — Livreur : 4 bugs + disponibilité manuelle
cd "$(dirname "$0")"
git add \
  apps/accounts/models.py \
  apps/accounts/admin.py \
  apps/accounts/views.py \
  apps/accounts/urls.py \
  apps/accounts/serializers.py \
  apps/accounts/migrations/0009_user_is_available.py \
  apps/orders/models.py \
  apps/orders/serializers.py \
  apps/orders/views.py \
  apps/orders/admin.py \
  apps/orders/migrations/0010_deliveryassignment_pickup_code.py \
  apps/reviews/models.py \
  apps/reviews/serializers.py \
  apps/reviews/views.py \
  apps/reviews/migrations/0002_review_unique_reviewer_reviewee.py \
  frontend/src/pages/LivreurDashboard.jsx \
  frontend/src/pages/OrdersPage.jsx \
  frontend/src/services/api.js

git commit -m "feat(livreur): disponibilité manuelle + auto-assign smart + dual codes + 3-way rating

Disponibilité (#36)
- Champ is_available sur User (migration 0009)
- Toggle POST /accounts/livreur/toggle-availability/
- LivreurDashboard : bouton Disponible/Indisponible dans le header
- Algorithme auto-assign filtre is_available=True
- Admin : is_available visible et éditable en liste

Auto-assign (#35)
- Algorithme Option B : même ville → en service aujourd'hui → moins chargé
- Listing marqué 'sold' dans Order.complete()
- Dual codes : pickup_code (livreur→vendeur) + verification_code (acheteur→livreur)
- Migration 0010 : champ pickup_code sur DeliveryAssignment
- Notation 3-way : unique_together (order, reviewer, reviewee)
- Migration 0002 reviews
- OrderSerializer expose delivery_assignment_detail avec tous les codes
- LivreurDashboard : étape 1 pickup_code, étape 2 QR, notation post-livraison
- OrdersPage : codes + boutons notation livreur
- api.js : reviewsAPI + authAPI.toggleAvailability"

git push
echo "✅ Déployé — Railway lance les migrations automatiquement"
