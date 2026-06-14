"""
Tâches Celery pour les annonces.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def moderate_listing_task(self, listing_id):
    """
    Modération IA asynchrone d'une annonce.
    Appelée après création — ne bloque pas la réponse HTTP du vendeur.
    """
    try:
        from .models import Listing
        from .moderation import moderate_listing
        from apps.notifications.models import Notification
        from core.sms import send_sms

        listing = Listing.objects.select_related('seller', 'category').get(id=listing_id)

        # Déjà traitée (double appel possible)
        if listing.status != Listing.Status.DRAFT:
            return

        category_name = listing.category.name if listing.category else 'Non définie'
        mod = moderate_listing(
            listing.title,
            listing.description,
            listing.price_gnf,
            category_name,
        )

        decision = mod.get('decision', 'approve')
        reason   = mod.get('reason', '')

        if decision == 'reject':
            listing.status = Listing.Status.SUSPENDED
            listing.save(update_fields=['status'])
            logger.info("Annonce %s REJETÉE : %s", listing_id, reason)

            # Notifier le vendeur
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='❌ Annonce refusée',
                body=f'Votre annonce "{listing.title}" a été refusée : {reason}. '
                     f'Contactez le support si vous pensez qu\'il s\'agit d\'une erreur.',
                data={'listing_id': str(listing.id)},
            )
            # SMS au vendeur
            try:
                phone = str(listing.seller.phone_number)
                send_sms(
                    phone,
                    f'GuinéeMarché : Votre annonce "{listing.title[:30]}" a été refusée. '
                    f'Raison : {reason}. Contactez le support au +224622411238.'
                )
            except Exception as sms_err:
                logger.warning("SMS rejet échoué : %s", sms_err)

        elif decision == 'review':
            listing.status = Listing.Status.DRAFT
            listing.save(update_fields=['status'])
            logger.info("Annonce %s EN RÉVISION : %s", listing_id, reason)

            # Notifier le vendeur
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='⏳ Annonce en cours de vérification',
                body=f'Votre annonce "{listing.title}" est en cours de vérification par notre équipe. '
                     f'Elle sera publiée ou refusée sous 24h.',
                data={'listing_id': str(listing.id)},
            )

        else:
            listing.status = Listing.Status.ACTIVE
            listing.save(update_fields=['status'])
            logger.info("Annonce %s APPROUVÉE", listing_id)

    except Exception as exc:
        logger.error("Erreur modération tâche %s : %s", listing_id, exc)
        # Fail-open : approuver l'annonce si la tâche échoue complètement
        try:
            from .models import Listing
            Listing.objects.filter(id=listing_id, status=Listing.Status.DRAFT).update(
                status=Listing.Status.ACTIVE
            )
        except Exception:
            pass
        raise self.retry(exc=exc)
