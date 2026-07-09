@echo off
cd /d C:\Users\DNTCP\guineemarche
echo Migration directe Render -> Railway PostgreSQL...
python migrate_db.py
echo.
pause
