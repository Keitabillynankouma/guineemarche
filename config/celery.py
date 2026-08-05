import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('guineemarche')

# Charge la configuration depuis Django settings (clés préfixées CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Découvre automatiquement les tâches dans tous les apps installées
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
