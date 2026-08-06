@echo off
cd /d C:\Users\DNTCP\guineemarche

REM Push d'abord les commits Audit 6 en attente (si pas encore poussés)
git push

REM Audit 7 fixes
git add apps/accounts/views.py
git add apps/orders/serializers.py
git add apps/orders/views.py
git add config/settings.py

git commit -m "fix(audit7): 4 bugs securite

- accounts/views.py: bloquer bypass abonnement Pro en mode simulation
  (sans ORANGE_MONEY_API_KEY, retourne 202 + ref manuelle au lieu de
  valider gratuitement)
- orders/serializers.py: codes livraison role-aware — verification_code
  visible acheteur uniquement, pickup_code vendeur uniquement, les deux
  pour admin (evite cross-party code leak)
- orders/views.py: contexte request passe au serializer sur toutes les
  reponses OrderSerializer (4 occurrences) pour activer filtrage roles
- orders/views.py: DisputeView restreint aux commandes CONFIRMED +
  escrow HELD (empeche litiges sur commandes non payees)
- orders/views.py + config/settings.py: DeliveryCodeThrottle 5/heure
  par livreur sur LivreurConfirmDeliveryView (anti brute-force code
  6 chiffres — 900000 combinaisons)"

git push
echo === DONE ===
pause
