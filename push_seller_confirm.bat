@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH web fix: bouton confirmer vendeur ===
git add frontend/src/pages/OrdersPage.jsx
git commit -m "fix: web OrdersPage - bouton Confirmer commande pour le vendeur (especes)"
git push
echo.

echo === BUILD EAS mobile (seller confirm button) ===
cd mobile
call eas build --profile preview --platform android --no-wait
echo.

echo === DONE ===
pause
