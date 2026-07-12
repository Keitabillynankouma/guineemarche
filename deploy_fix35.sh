#!/bin/bash
# Fix #35 — 4 corrections livreur
cd "$(dirname "$0")"
git add \
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

git commit -m "fix(livreur): auto-assign, listing sold, dual codes, 3-way rating

- Auto-assign livreur dès création commande home_delivery (priorité même ville)
- Listing marqué 'sold' dans Order.complete()
- Dual codes : pickup_code (livreur→vendeur) + verification_code (acheteur→livreur)
- Migration 0010 : champ pickup_code sur DeliveryAssignment
- Notation 3-way : acheteur, vendeur et livreur peuvent tous se noter
- Migration 0002 reviews : unique_together (order, reviewer, reviewee)
- OrderSerializer expose delivery_assignment_detail (codes + livreur_id)
- LivreurDashboard : étape 1 pickup_code, étape 2 verification QR, notation post-livraison
- OrdersPage : codes visibles par vendeur/acheteur + boutons notation livreur
- api.js : reviewsAPI.create() avec reviewee explicite"

git push
echo "✅ Déployé — Railway lance les migrations automatiquement"
