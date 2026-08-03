@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH audit complet - tous les fixes ===
git add -A
git commit -m "fix: audit complet - P0 webhook signature, amendes DEDUCTED, refund litige, mobile auth routes, commission 4pct, secrets codes, expire listings, auto-assign notify, downloadCSV, delivery mode"
git push
echo.
echo === DONE ===
echo.
echo IMPORTANT : Aller sur Render dashboard et faire Manual Deploy pour guimatrix (frontend)
echo Le backend (guineemarche-backend) se redeploie automatiquement apres git push
pause
