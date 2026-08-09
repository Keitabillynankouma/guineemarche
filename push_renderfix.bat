@echo off
cd /d C:\Users\DNTCP\guineemarche
git add render.yaml
git commit -m "fix: render.yaml retire section databases (deja existante sur Render, evite erreur Blueprint)"
git push
echo Done.
pause
