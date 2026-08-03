@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === PUSH full auto-payout vendeurs + livreurs ===
git add apps/orders/tasks.py
git commit -m "feat: virement automatique complet - vendeurs (escrow auto-release) + livreurs (weekly task)"
git push
echo.
echo === DONE - Pense a faire Manual Deploy sur Render ===
pause
