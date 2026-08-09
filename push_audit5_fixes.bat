@echo off
cd /d C:\Users\DNTCP\guineemarche
git add apps/reviews/views.py
git commit -m "fix: review uniquement sur commande COMPLETED (bloque avis sur PENDING/CANCELLED)"
git push
echo Done.
pause
