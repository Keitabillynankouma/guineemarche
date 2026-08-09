@echo off
cd /d C:\Users\DNTCP\guineemarche
git add config/settings.py frontend/.env.production
git commit -m "fix: audit4 - webhook URLs guineemarche.onrender.com, frontend .env.production API URL"
git push
echo Done.
echo.
echo RAPPEL OBLIGATOIRE :
echo  - Render dashboard - guimatrix - Manual Deploy (pour prendre .env.production en compte)
echo  - Communiquer la vraie URL webhook a ChaChaP : https://guineemarche.onrender.com/api/v1/orders/webhook/chachap/
pause
