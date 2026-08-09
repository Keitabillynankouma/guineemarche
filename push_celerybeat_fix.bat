@echo off
cd /d C:\Users\DNTCP\guineemarche
git add requirements.txt
git commit -m "fix: django-celery-beat 2.7.0->2.8.0 pour compatibilite Django 5.2"
git push
echo Done.
pause
