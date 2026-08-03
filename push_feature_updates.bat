@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH - Mise a jour fonctionnalites + Manuel ===
git add -A
git commit -m "feat: villes/quartiers dynamiques, pickup_point mobile, admin link, error feedback profil, manuel utilisateur"
git push
echo.
echo === DONE ===
echo.
echo IMPORTANT : Aller sur Render dashboard et faire Manual Deploy pour guimatrix (frontend)
echo Le backend (guineemarche-backend) se redeploie automatiquement apres git push
pause
