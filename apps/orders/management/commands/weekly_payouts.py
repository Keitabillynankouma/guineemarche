"""
Commande Django : python manage.py weekly_payouts
Render Cron Job — chaque lundi à 07h00 : 0 7 * * 1
Génère et déclenche les virements hebdomadaires livreurs.
"""
from django.core.management.base import BaseCommand
from apps.orders.tasks import weekly_livreur_payouts


class Command(BaseCommand):
    help = 'Génère les virements hebdomadaires livreurs.'

    def handle(self, *args, **options):
        count = weekly_livreur_payouts()
        self.stdout.write(self.style.SUCCESS(
            f'✅ weekly_payouts : {count} virement(s) générés.'
        ))
