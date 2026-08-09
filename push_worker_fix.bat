@echo off
cd /d C:\Users\DNTCP\guineemarche
git add build_worker.sh render.yaml
git commit -m "fix: build_worker.sh sans migrate pour les workers Celery (region Frankfurt)"
git push
echo Done.
pause
