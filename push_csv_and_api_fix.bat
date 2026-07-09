@echo off
cd /d C:\Users\DNTCP\guineemarche
git add apps/orders/views.py frontend/src/services/api.js
git commit -m "fix: orders CSV avec annonces supprimees + VITE_API_URL fallback api.guimatrix.com"
git push origin main
echo.
echo Push termine ! Railway va redeploy automatiquement.
echo - CSV commandes: les 12 commandes seront maintenant visibles
echo - Frontend: pointera vers api.guimatrix.com apres rebuild
pause
