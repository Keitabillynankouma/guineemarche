"""
Commande Django : python manage.py notify_escrow
Render Cron Job — toutes les 12h : 0 0,12 * * *
Rappelle les vendeurs dont les fonds seront libérés dans 2h.
"""
from django.core.management.base import BaseCommand
from apps.orders.tasks import notify_pending_escrow


class Command(BaseCommand):
    help = 'Envoie des rappels escrow aux vendeurs.'

    def handle(self, *args, **options):
        notify_pending_escrow()
        self.stdout.write(self.style.SUCCESS('✅ notify_escrow : rappels envoyés.'))
