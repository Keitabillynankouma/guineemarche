@echo off
cd /d C:\Users\DNTCP\guineemarche
echo === GIT STATUS ===
git status
echo.
echo === DERNIERS COMMITS ===
git log --oneline -8
echo.
echo === DIFF FRONTEND ===
git diff HEAD -- frontend/src/pages/SellerEarningsPage.jsx
echo.
pause
