@echo off
cd /d C:\Users\DNTCP\guineemarche\frontend
echo Mise a jour du package-lock.json...
npm install
echo.
cd /d C:\Users\DNTCP\guineemarche
git add frontend/package-lock.json frontend/package.json
git commit -m "fix: update package-lock.json for Railway build"
git push origin main
echo.
echo Fait ! Railway va re-builder automatiquement.
pause
