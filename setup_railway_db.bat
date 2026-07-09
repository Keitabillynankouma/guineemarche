@echo off
cd /d C:\Users\DNTCP\guineemarche

echo === Etape 1: Creation des tables Django sur Railway ===
set DATABASE_URL=postgresql://postgres:zwdkBYcoIdSqKxeWADRPnxMDhlEUCKGr@acela.proxy.rlwy.net:20200/railway
venv\Scripts\python.exe manage.py migrate --no-input
echo.

echo === Etape 2: Migration des donnees Render -> Railway ===
venv\Scripts\python.exe migrate_db.py
echo.

pause
