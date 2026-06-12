"""
Commande Django : python manage.py expire_listings
À appeler via un Render Cron Job quotidien.
- Expire les annonces dont expires_at < maintenant
- Expire les boosts dont expires_at < maintenant (remet is_boosted=False)
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.listings.models import Listing


class Command(BaseCommand):
    help = 'Expire les annonces et boosts dont la date est dépassée.'

    def handle(self, *args, **options):
        now = timezone.now()

        # 1. Expirer les annonces dont expires_at est dépassé
        expired = Listing.objects.filter(
            status=Listing.Status.ACTIVE,
            expires_at__isnull=False,
            expires_at__lt=now,
        ).update(status=Listing.Status.EXPIRED)

        # 2. Désactiver les boosts expirés (annonces repassées active sans boost)
        unboosted = Listing.objects.filter(
            is_boosted=True,
            expires_at__isnull=False,
            expires_at__lt=now,
        ).update(is_boosted=False)

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ {expired} annonce(s) expirée(s), {unboosted} boost(s) désactivé(s).'
            )
        )
