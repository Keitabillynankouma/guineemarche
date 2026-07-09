@echo off
cd /d C:\Users\DNTCP\guineemarche
git add Procfile apps/orders/views.py frontend/src/services/api.js
git commit -m "fix: collectstatic au demarrage + CSV commandes + VITE_API_URL"
git push origin main
echo.
echo Push termine ! Railway va redeploy.
echo Apres le redeploy, l'admin Django et le DRF auront leurs CSS.
pause
