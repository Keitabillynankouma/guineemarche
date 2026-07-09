@echo off
cd /d C:\Users\DNTCP\guineemarche
git add frontend/Dockerfile frontend/package-lock.json frontend/package.json
git commit -m "fix: add Dockerfile for Railway frontend build"
git push origin main
echo.
echo Push termine ! Railway va utiliser le Dockerfile.
pause
