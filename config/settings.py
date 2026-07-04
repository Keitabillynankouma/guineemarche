from pathlib import Path
import dj_database_url
import os
from datetime import timedelta
import cloudinary
from decouple import config as env
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
import logging




BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# En prod, définir ALLOWED_HOSTS=guineemarche.onrender.com dans les variables Render
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
_base_hosts = ['guineemarche.onrender.com', 'www.guineemarche.com']
ALLOWED_HOSTS = (
    list({*_allowed_hosts_env.split(','), *_base_hosts})
    if _allowed_hosts_env
    else (['*'] if DEBUG else _base_hosts)
)
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

if _USE_CLOUDINARY:
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
    #'django.middleware.csrf.CsrfViewMiddleware',
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
    # Si JWT_SIGNING_KEY n'est pas défini, on étend SECRET_KEY à 64 chars via SHA256
    'SIGNING_KEY': os.environ.get(
        'JWT_SIGNING_KEY',
        __import__('hashlib').sha256(
            os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production').encode()
        ).hexdigest()  # toujours 64 hex chars (256 bits) — jamais trop court
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
        'anon':  '200/day',
        'user':  '1000/day',
        'otp':   '5/hour',
        'login': '10/hour',
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
    "https://guineemarche.com",
    "https://www.guineemarche.com",
    "https://guineemarche-production.up.railway.app",
    "https://guineemarche-frontend-production.up.railway.app",
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

# ── Sentry — monitoring erreurs + performance + sécurité ──────────────────────
SENTRY_DSN = env('SENTRY_DSN', default='')

if SENTRY_DSN:
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

# ── Paycard Guinée — agrégateur Mobile Money (Orange Money GN + MTN MoMo GN) ─
# Configurer dans Railway quand tu reçois les clés Paycard :
PAYCARD_API_KEY     = env('PAYCARD_API_KEY', default='')
PAYCARD_SECRET_KEY  = env('PAYCARD_SECRET_KEY', default='')
PAYCARD_MERCHANT_ID = env('PAYCARD_MERCHANT_ID', default='')
PAYCARD_SANDBOX     = env('PAYCARD_SANDBOX', default=str(DEBUG)).lower() in ('true', '1', 'yes')
# URL Railway à communiquer à Paycard comme callback webhook :
# https://api.guimatrix.com/api/v1/orders/webhook/paycard/
PAYCARD_WEBHOOK_URL = env('PAYCARD_WEBHOOK_URL', default='https://api.guimatrix.com/api/v1/orders/webhook/paycard/')

# ── Brevo (ex-Sendinblue) — Email transactionnel ──────────────────────────────
# Créer un compte sur brevo.com → Settings → SMTP & API → SMTP
# Copier SMTP Login et SMTP Password dans Railway :
# ── Email — Gmail (immédiat) ou Brevo (production) ────────────────────────────
# Gmail  : BREVO_SMTP_USER=bnkeita020@gmail.com  EMAIL_HOST=smtp.gmail.com
# Brevo  : BREVO_SMTP_USER=xxx@smtp-brevo.com    EMAIL_HOST=smtp-relay.brevo.com
# Les deux utilisent port 587 + TLS
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = env('EMAIL_HOST', default='smtp.gmail.com')  # smtp.gmail.com ou smtp-relay.brevo.com
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = env('BREVO_SMTP_USER', default='')      # ton email Gmail ou login Brevo
EMAIL_HOST_PASSWORD = env('BREVO_SMTP_PASSWORD', default='')  # mot de passe d'application Google ou clé Brevo
DEFAULT_FROM_EMAIL  = env('DEFAULT_FROM_EMAIL', default='Guimatrix <noreply@guimatrix.com>')
ADMIN_EMAIL         = env('ADMIN_EMAIL', default='bnkeita020@gmail.com')

# Si pas de config email → console (logs Railway) — rien ne plante
if not EMAIL_HOST_USER:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

CSRF_COOKIE_SECURE = True
CSRF_USE_SESSIONS = False
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
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
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
}

