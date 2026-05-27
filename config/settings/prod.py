from .base import *

DEBUG = False

ALLOWED_HOSTS = ['*']  # On mettra le vrai domaine plus tard

CORS_ALLOWED_ORIGINS = [
    "https://votre-frontend.onrender.com",
]

STATIC_ROOT = BASE_DIR / 'staticfiles'