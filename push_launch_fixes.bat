@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH - Corrections pre-lancement (B1-B5 + A1-A9) ===
git add -A
git commit -m "fix: corrections pre-lancement - migrate build.sh, celery render.yaml, CSRF, SubscriptionView, SECRET_KEY, payout notify, AdminRoute, Referral, AdminUserUpdate super_admin, pagination orders"
git push
echo.
echo === DONE ===
echo.
echo ACTIONS MANUELLES REQUISES sur Render.com :
echo.
echo  1. Dashboard Render → guineemarche-backend → Environment
echo     Verifier que SECRET_KEY est bien definie (sinon l'app crash au demarrage)
echo     Verifier CHACHAP_API_KEY, BREVO_API_KEY, CLOUDINARY_URL, FIREBASE_*
echo.
echo  2. Dashboard Render → New Service → Worker
echo     Creer "guineemarche-celery-worker" et "guineemarche-celery-beat"
echo     (render.yaml les declare - Blueprint Sync devrait les creer automatiquement)
echo.
echo  3. Upgrader les plans :
echo     - guineemarche-backend  : free → starter (ou standard)
echo     - guineemarche-redis    : free → starter  (Redis free est ephemere !)
echo     - guineemarche-db       : free → starter  (PostgreSQL free = 1 Go max)
echo.
echo  4. Frontend guimatrix : Manual Deploy dans le dashboard Render
echo.
pause
