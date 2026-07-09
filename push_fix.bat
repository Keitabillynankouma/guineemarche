@echo off
cd /d C:\Users\DNTCP\guineemarche
git add requirements.txt
git commit -m "fix: add gunicorn to requirements.txt for Railway deployment"
git push origin main
echo.
echo Push termine ! Appuyez sur une touche pour fermer.
pause
