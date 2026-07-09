@echo off
cd /d C:\Users\DNTCP\guineemarche
git add apps/listings/ai_features.py apps/listings/urls.py ^
        frontend/src/components/AISearchBar.jsx ^
        frontend/src/components/ListingAssistant.jsx ^
        frontend/src/components/SimilarListings.jsx ^
        frontend/src/pages/ListingDetailPage.jsx ^
        frontend/src/pages/HomePage.jsx ^
        Procfile apps/orders/views.py frontend/src/services/api.js
git commit -m "feat: IA integree - recherche intelligente + assistant achat + recommandations similaires"
git push origin main
echo.
echo ================================================================
echo  Push termine ! Deployement Railway en cours...
echo ================================================================
echo.
echo  3 nouvelles features IA :
echo  - Recherche NLP : POST /api/v1/listings/ai-search/
echo  - Assistant achat : POST /api/v1/listings/assistant/
echo  - Similaires : GET /api/v1/listings/{id}/similar/
echo.
echo  Frontend :
echo  - Barre de recherche IA sur la HomePage
echo  - Chatbot contextuel sur chaque annonce
echo  - Carousel "Vous aimerez aussi" sur chaque annonce
echo  - CSS admin/DRF corriges (collectstatic)
echo  - CSV commandes corrige
echo ================================================================
pause
