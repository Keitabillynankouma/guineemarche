@echo off
cd /d C:\Users\DNTCP\guineemarche
git add core/management/ config/settings.py
git commit -m "fix: add reset_sequences command + Railway CSRF/CORS settings"
git push origin main
echo.
echo Push termine !
pause
