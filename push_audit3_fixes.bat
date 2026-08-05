@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH - Corrections audit 3 ===
git add -A
git commit -m "fix: audit3 — AdminActivateSubscriptionView + throttle SubscriptionView + bouton Pro admin UI"
git push
echo.
echo === DONE ===
echo.
echo RAPPEL MANUEL RENDER :
echo  - Manual Deploy frontend guimatrix (obligatoire apres push frontend)
echo  - Ajouter les services Celery worker + beat (Blueprint Sync dans render.yaml)
echo  - Verifier toutes les variables d'environnement (voir render.yaml commentaires)
echo  - L'endpoint admin activer Pro est disponible : POST /accounts/admin/users/<id>/subscription/
pause
