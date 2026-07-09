@echo off
cd /d C:\Users\DNTCP\guineemarche
git add config/settings.py
git commit -m "fix: add Railway to CSRF_TRUSTED_ORIGINS and CORS_ALLOWED_ORIGINS"
git push origin main
echo.
echo Push termine !
pause
