@echo off
cd /d C:\Users\DNTCP\guineemarche
git add frontend/.env.production
git commit -m "fix: frontend .env.production VITE_API_URL pointe vers guineemarche.onrender.com"
git push
echo Done.
echo.
echo IMPORTANT : Aller sur Render dashboard - guimatrix - Manual Deploy
pause
