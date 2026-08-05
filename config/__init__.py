# Assure que l'app Celery est chargée dès le démarrage de Django
from .celery import app as celery_app

__all__ = ('celery_app',)
