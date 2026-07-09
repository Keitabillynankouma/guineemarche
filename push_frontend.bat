@echo off
cd /d C:\Users\DNTCP\guineemarche
git add frontend/package.json config/settings.py
git commit -m "feat: add Railway frontend service + CORS config"
git push origin main
echo.
echo Push termine ! Railway va builder le frontend automatiquement.
pause
