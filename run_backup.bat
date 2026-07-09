@echo off
cd /d C:\Users\DNTCP\guineemarche
echo Re-generation du backup depuis Render...
python backup_python.py
echo.
echo Taille du fichier backup:
for %%A in (guimatrix_backup.sql) do echo %%~zA octets
pause
