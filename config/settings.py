from pathlib import Path
import dj_database_url
import os
from datetime import timedelta
import logging

try:
    import cloudinary
except ImportError:
    cloudinary = None

from decouple import config as env

try:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    _SENTRY_AVAILABLE = True
except ImportError:
    _SENTRY_AVAILABLE = False




BASE_DIR = Path(__file__).resolve().parent.parent

# DEBUG doit être défini EN PREMIER (utilisé dans le bloc SECRET_KEY ci-dessous)
_debug_env = os.environ.get('DEBUG') or env('DEBUG', default='False')
DEBUG = str(_debug_env).lower() in ('true', '1', 'yes')

_secret_key = os.environ.get('SECRET_KEY') or env('SECRET_KEY', default='')
if not _secret_key:
    if DEBUG:
        # Dev local uniquement — jamais utilisé en production
        _secret_key = 'dev-only-key-NOT-for-production-' + os.urandom(16).hex()
    else:
        raise RuntimeError(
            "SECRET_KEY must be set in environment variables. "
            "Set it in the Render dashboard under Environment > Add secret file."
        )
SECRET_KEY = _secret_key

# ALLOWED_HOSTS
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS') or env('ALLOWED_HOSTS', default='')
_base_hosts = ['guineemarche.onrender.com', 'www.guineemarche.com', 'api.guimatrix.com', 'guimatrix.com']
if _allowed_hosts_env:
    ALLOWED_HOSTS = list({h.strip() for h in _allowed_hosts_env.split(',') if h.strip()} | set(_base_hosts))
elif DEBUG:
    ALLOWED_HOSTS = ['*']
else:
    ALLOWED_HOSTS = _base_hosts
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'cloudinary_storage',
    'cloudinary',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'phonenumber_field',
    'channels',
    'django_celery_beat',
]

LOCAL_APPS = [
    'apps.accounts.apps.AccountsConfig',
    'apps.listings',
    'apps.messaging',
    'apps.orders',
    'apps.reviews',
    'apps.notifications',
    'core',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS


CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME') or env('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY':    os.environ.get('CLOUDINARY_API_KEY')    or env('CLOUDINARY_API_KEY',    default=''),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET') or env('CLOUDINARY_API_SECRET', default=''),
}

_USE_CLOUDINARY = bool(CLOUDINARY_STORAGE['CLOUD_NAME'])

if _USE_CLOUDINARY and cloudinary:
    cloudinary.config(
        cloud_name=CLOUDINARY_STORAGE['CLOUD_NAME'],
        api_key=CLOUDINARY_STORAGE['API_KEY'],
        api_secret=CLOUDINARY_STORAGE['API_SECRET'],
        secure=True
    )

STORAGES = {
    "default": {
        "BACKEND": (
            "cloudinary_storage.storage.MediaCloudinaryStorage"
            if _USE_CLOUDINARY
            else "django.core.files.storage.FileSystemStorage"
        )
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"
    },
}


MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'core.security_middleware.GuineeSecurityMiddleware',   # Sécurité active
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',   # protège /admin/ — les vues DRF JWT sont exemptées automatiquement
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

DATABASE_URL = os.environ.get('DATABASE_URL', '')
if DATABASE_URL and DATABASE_URL.startswith(('postgres', 'sqlite', 'mysql')):
    DATABASES = {'default': dj_database_url.config(default=DATABASE_URL)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    # Clé de signature dédiée — évite le warning "HMAC key too short"
    # Utilise decouple (lit .env) pour être cohérent entre le serveur et les scripts
    # de test qui appellent django.setup() — les deux lisent le même .env.
    'SIGNING_KEY': env(
        'JWT_SIGNING_KEY',
        default=__import__('hashlib').sha256(SECRET_KEY.encode()).hexdigest()
    ),
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon':         '200/day',
        'user':         '1000/day',
        'otp':          '5/hour',
        'login':        '10/hour',
        'message_send': '60/hour',    # Anti-spam messagerie
        'webhook':           '60/minute',  # Protection bruteforce webhooks
        'delivery_confirm':  '5/hour',     # Anti brute-force codes livraison (6 chiffres)
    },
}

CSRF_TRUSTED_ORIGINS = [
    'https://guineemarche-frontend.onrender.com',
    'https://guineemarche.onrender.com',
    'https://guineemarche-production.up.railway.app',
    'https://guineemarche-frontend-production.up.railway.app',
    'https://*.railway.app',
    'https://*.up.railway.app',
]

CORS_ALLOW_ALL_ORIGINS = DEBUG  # True en dev, False en prod
CORS_ALLOWED_ORIGINS = [
    "https://guineemarche-frontend.onrender.com",
    "https://guimatrix.onrender.com",
    "https://guimatrix.com",
    "https://www.guimatrix.com",
    "https://api.guimatrix.com",
    "https://guineemarche.com",
    "https://www.guineemarche.com",
    "http://localhost:5173",   # Dev local
    "http://127.0.0.1:5173",
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Conakry'
USE_I18N = True
USE_TZ = True

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Requis par django-cloudinary-storage 0.3.0 (non compatible Django 5.x sans ceci)
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

PHONENUMBER_DEFAULT_REGION = 'GN'

# ── Nimba SMS (fournisseur SMS guinéen) ──────────────────────────────────────
NIMBA_SERVICE_ID   = env('NIMBA_SERVICE_ID',   default='')
NIMBA_SECRET_TOKEN = env('NIMBA_SECRET_TOKEN', default='')
NIMBA_SENDER_NAME  = env('NIMBA_SENDER_NAME',  default='Guimatrix')

# Anthropic Claude API (support chatbot + modération)
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')

# ── Firebase Cloud Messaging (FCM) — notifications push ───────────────────────
# Créer un projet Firebase → Settings → Service Accounts → Generate new private key
# FIREBASE_PROJECT_ID    : ID du projet (ex: guineemarche-prod)
# FIREBASE_SERVICE_ACCOUNT : contenu JSON complet du compte de service (une seule ligne)
FIREBASE_PROJECT_ID      = env('FIREBASE_PROJECT_ID', default='')
FIREBASE_SERVICE_ACCOUNT = env('FIREBASE_SERVICE_ACCOUNT', default='')

# ── Sentry — monitoring erreurs + performance + sécurité ──────────────────────
SENTRY_DSN = env('SENTRY_DSN', default='')

if SENTRY_DSN and _SENTRY_AVAILABLE:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(
                transaction_style='url',
                middleware_spans=True,
                signals_spans=True,
                cache_spans=True,
            ),
            RedisIntegration(),
            CeleryIntegration(),
            LoggingIntegration(
                level=logging.WARNING,       # Capturer WARNING et plus
                event_level=logging.ERROR,   # Créer un événement Sentry sur ERROR+
            ),
        ],
        # Performance : tracer 10 % des requêtes en prod, 100 % en dev
        traces_sample_rate=1.0 if DEBUG else 0.1,
        # Profiling : analyser les requêtes lentes
        profiles_sample_rate=1.0 if DEBUG else 0.05,
        environment='development' if DEBUG else 'production',
        send_default_pii=False,      # Ne pas envoyer d'infos personnelles
        attach_stacktrace=True,
        # Ignorer les erreurs non-critiques courantes
        ignore_errors=[
            'django.http.response.Http404',
            'rest_framework.exceptions.AuthenticationFailed',
            'rest_framework.exceptions.NotAuthenticated',
            'asyncio.exceptions.CancelledError',
            'asyncio.CancelledError',
        ],
    )

# Secrets pour validation des signatures webhook paiement
# Définir dans les variables d'environnement Render
ORANGE_WEBHOOK_SECRET = env('ORANGE_WEBHOOK_SECRET', default='')

# ── ChaChap Pay — agrégateur guinéen agréé BCRG ──────────────────────────────
# Configurer dans Railway (ou .env local pour les tests) :
CHACHAP_API_KEY      = env('CHACHAP_API_KEY', default='')
# Clé HMAC séparée pour la signature des webhooks (≠ clé API)
# Accepte CHACHAP_HMAC_KEY ou CHACHAP_WEBHOOK_SECRET selon le nom choisi dans Railway
CHACHAP_HMAC_KEY     = env('CHACHAP_HMAC_KEY', default='') or env('CHACHAP_WEBHOOK_SECRET', default='')
CHACHAP_WEBHOOK_URL = env('CHACHAP_WEBHOOK_URL',
                          default='https://guineemarche.onrender.com/api/v1/orders/webhook/chachap/')

# ── Paycard Guinée — agrégateur Mobile Money (Orange Money GN + MTN MoMo GN) ─
# Configurer dans Railway quand tu reçois les clés Paycard :
PAYCARD_API_KEY     = env('PAYCARD_API_KEY', default='')
PAYCARD_SECRET_KEY  = env('PAYCARD_SECRET_KEY', default='')
PAYCARD_MERCHANT_ID = env('PAYCARD_MERCHANT_ID', default='')
PAYCARD_SANDBOX     = env('PAYCARD_SANDBOX', default=str(DEBUG)).lower() in ('true', '1', 'yes')
# URL Railway à communiquer à Paycard comme callback webhook :
# https://api.guimatrix.com/api/v1/orders/webhook/paycard/
PAYCARD_WEBHOOK_URL = env('PAYCARD_WEBHOOK_URL', default='https://guineemarche.onrender.com/api/v1/orders/webhook/paycard/')

# ── Brevo — API HTTP (Railway bloque SMTP port 587) ──────────────────────────
# Railway bloque les connexions SMTP sortantes → on utilise l'API REST Brevo (HTTPS)
# Brevo → Settings → API Keys → Generate a new API key → copier dans Railway
BREVO_API_KEY      = env('BREVO_API_KEY', default='')
# Email expéditeur : doit être vérifié dans Brevo → Senders & IPs → Senders
BREVO_SENDER_EMAIL = env('BREVO_SENDER_EMAIL', default='')
ADMIN_EMAIL        = env('ADMIN_EMAIL', default='bnkeita020@gmail.com')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Guimatrix <noreply@guimatrix.com>')

# Backend email Django → Brevo HTTP API (contourne le blocage SMTP Railway)
# Toutes les fonctions Django (send_mail, password_reset, admin) passent par Brevo
EMAIL_BACKEND = 'core.brevo_backend.BrevoEmailBackend'

CSRF_COOKIE_SECURE   = True
CSRF_USE_SESSIONS    = False
SESSION_COOKIE_SECURE = not DEBUG        # cookies session uniquement en HTTPS en production
SECURE_HSTS_SECONDS   = 0 if DEBUG else 31536000   # HSTS 1 an en production
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD   = not DEBUG
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'

# Exempter les URLs API du CSRF
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + ['X-CSRFToken']

# Forcer les réponses JSON pour l'API
DEFAULT_EXCEPTION_HANDLER = 'rest_framework.views.exception_handler'

APPEND_SLASH = False

ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG':  {'hosts': [env('REDIS_URL', default='redis://localhost:6379/1')]},
    }
}

# ── Celery + Beat (tâches périodiques) ───────────────────────────────────────
CELERY_BROKER_URL  = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_TIMEZONE    = 'Africa/Conakry'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        # Suppress CancelledError log spam from client disconnects on Python 3.12+
        'suppress_cancelled': {
            '()': 'config.logging_filters.SuppressCancelledError',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'filters': ['suppress_cancelled'],
        },
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'django.request': {'handlers': ['console'], 'level': 'ERROR', 'propagate': False},
        'apps': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
        'core': {'handlers': ['console'], 'level': 'DEBUG', 'propagate': False},
    },
}

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    # Libération escrow — toutes les heures
    'auto-release-escrow': {
        'task':     'apps.orders.tasks.auto_release_escrow',
        'schedule': crontab(minute=0),          # Chaque heure pile
    },
    # Rappel vendeurs escrow bientôt disponible — toutes les 12h
    'notify-pending-escrow': {
        'task':     'apps.orders.tasks.notify_pending_escrow',
        'schedule': crontab(hour='8,20', minute=0),  # 8h et 20h
    },
    # Agent sécurité IA — scan quotidien à 07h00 (UTC = 07h00 Conakry, pas de décalage)
    'security-daily-scan': {
        'task':     'core.security_agent.run_security_scan',
        'schedule': crontab(hour=7, minute=0),   # 07h00 chaque matin
    },
    # Virements livreurs hebdomadaires — chaque lundi à 07h00
    'weekly-livreur-payouts': {
        'task':     'apps.orders.tasks.weekly_livreur_payouts',
        'schedule': crontab(hour=7, minute=0, day_of_week=1),  # lundi 07h00
    },
    # Expiration annonces — chaque nuit à minuit
    'expire-listings': {
        'task':     'apps.listings.tasks.expire_listings',
        'schedule': crontab(hour=0, minute=0),                 # 00h00 chaque nuit
    },
}

