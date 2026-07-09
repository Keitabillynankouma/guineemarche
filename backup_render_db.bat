@echo off
echo ========================================
echo  Backup Guimatrix - via Docker pg18
echo ========================================
echo.
echo Telechargement de l'image PostgreSQL 18 (Docker)...
echo (Premiere fois : peut prendre 2-3 minutes)
echo.

docker run --rm postgres:18 pg_dump "postgresql://guineemarche_db_user:FpIC8b1kUpUfwjOeRkHa473b2bnTtWnl@dpg-d8e49dv7f7vs73cq19a0-a.frankfurt-postgres.render.com/guineemarche_db" > "C:\Users\DNTCP\guineemarche\guimatrix_backup.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  SUCCES! Fichier cree:
    echo  guimatrix_backup.sql
    echo ========================================
) else (
    echo.
    echo ERREUR. Verifie que Docker Desktop est lance.
)

echo.
pause
