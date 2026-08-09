@echo off
cd /d C:\Users\DNTCP\guineemarche
git add apps/orders/views.py
git add apps/listings/views.py
git add apps/listings/tasks.py
git add apps/listings/models.py
git add apps/listings/migrations/0007_listing_boost_expires_at.py
git commit -m "fix(audit6): 4 bugs critiques/hauts

- orders/views.py: race condition double-achat — select_for_update() + vérif
  commandes actives existantes avant création (bloque double-purchase simultané)
- orders/views.py: webhook ChaChap — ajout validation timestamp Ccp-Timestamp
  (protection replay attack, cohérent avec Paycard qui vérifie déjà 5min)
- listings/views.py: boost interdit sur annonce non-ACTIVE (évite facturation
  pour rien sur annonce suspendue/draft)
- listings/views.py + models.py + tasks.py: boost_expires_at séparé de
  expires_at — les annonces permanentes ne s'expirent plus après fin de boost"
git push
echo === DONE ===
pause
