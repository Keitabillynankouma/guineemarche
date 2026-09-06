# Celery app — chargée uniquement si un worker Celery est actif
# (les Cron Jobs Render utilisent des commandes Django directes, pas Celery)
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except Exception:
    pass
