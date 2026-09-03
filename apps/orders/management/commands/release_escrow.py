"""
Commande Django : python manage.py release_escrow
Render Cron Job — toutes les heures : 0 * * * *
Libère automatiquement les fonds en escrow dont le délai est dépassé
et déclenche le virement au vendeur.
"""
from django.core.management.base import BaseCommand
from apps.orders.tasks import auto_release_escrow


class Command(BaseCommand):
    help = 'Libère les fonds escrow expirés et vire les vendeurs.'

    def handle(self, *args, **options):
        released = auto_release_escrow()
        self.stdout.write(self.style.SUCCESS(
            f'✅ release_escrow : {released} commande(s) libérée(s).'
        ))
