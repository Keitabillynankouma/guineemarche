@echo off
cd /d C:\Users\DNTCP\guineemarche

git add apps/orders/views.py
git add config/settings.py

git commit -m "fix(audit8): 4 bugs critiques/hauts avant lancement

- orders/views.py: CRITIQUE — importer Listing depuis apps.listings.models
  (NameError sur chaque creation de commande, 100%% des achats etaient casses)
- orders/views.py: HAUT — supprimer verification_code des notifs/SMS livreur
  dans _auto_assign_livreur et AdminAssignLivreurView (le livreur ne doit
  pas connaitre le code d'avance pour eviter confirmation sans livraison)
- orders/views.py: HAUT — DeliveryTrackingView retourne verification_code
  uniquement a l'acheteur et aux admins (le vendeur ne doit pas le voir)
- orders/views.py + settings.py: MOYEN — throttle delivery_confirm releve
  a 20/heure (5/heure bloquait les livreurs legitimement actifs)"

git push
echo === DONE ===
pause
