@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH auto-virement vendeur + admin panel ===
git add apps/orders/views.py frontend/src/pages/AdminPage.jsx
git commit -m "feat: auto-virement vendeur apres confirmation acheteur + section admin deblocage"
git push
echo.
echo === DONE - Pense a faire Manual Deploy sur Render ===
pause
