@echo off
cd /d C:\Users\DNTCP\guineemarche
git add apps/listings/views.py config/settings.py
git commit -m "fix: wrap perform_create in try/except + add logging for 500 debug"
git push origin main
echo.
echo Push termine ! Railway va redeploy automatiquement.
echo Reproduis l'erreur puis reviens pour voir les logs.
pause
