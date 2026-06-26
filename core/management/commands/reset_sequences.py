"""
Commande Django : réinitialise les séquences PostgreSQL après une migration de données.
Utilise sqlsequencereset pour chaque app installée.
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.apps import apps
from django.db import connection


class Command(BaseCommand):
    help = 'Réinitialise toutes les séquences PostgreSQL après migration de données'

    def handle(self, *args, **options):
        app_labels = [app.label for app in apps.get_app_configs()]

        with connection.cursor() as cursor:
            for app_label in app_labels:
                try:
                    from io import StringIO
                    from django.core.management import call_command
                    out = StringIO()
                    call_command('sqlsequencereset', app_label, stdout=out, no_color=True)
                    sql = out.getvalue().strip()
                    if sql:
                        # Exécuter chaque instruction SQL séparément
                        for statement in sql.split(';'):
                            statement = statement.strip()
                            if statement and not statement.startswith('--') and statement.lower() != 'begin' and statement.lower() != 'commit':
                                cursor.execute(statement)
                        self.stdout.write(f'  ✓ {app_label}')
                except Exception as e:
                    self.stdout.write(f'  ✗ {app_label}: {e}')

        self.stdout.write(self.style.SUCCESS('Séquences réinitialisées.'))
