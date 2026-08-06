"""
Tâches Celery pour les annonces.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def expire_listings():
    """
    Tâche quotidienne (minuit) :
    1. Expire les annonces dont expires_at est dépassé.
    2. Désactive le boost des annonces dont boost_expires_at est dépassé
       (sans expirer l'annonce elle-même si elle est permanente).
    """
    from .models import Listing
    from apps.notifications.models import Notification

    now = timezone.now()

    # ── 1. Expiration annonces avec date d'expiration explicite ──────────────
    expired = Listing.objects.filter(
        status=Listing.Status.ACTIVE,
        expires_at__lt=now,
        expires_at__isnull=False,
    )
    count = 0
    for listing in expired.select_related('seller'):
        listing.status = Listing.Status.EXPIRED
        listing.save(update_fields=['status', 'updated_at'])
        count += 1
        try:
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='⏰ Annonce expirée',
                body=f'Votre annonce « {listing.title} » a expiré. Republiez-la pour continuer à vendre.',
                data={'listing_id': str(listing.id)},
            )
        except Exception as _e:
            logger.warning("Notification expiration annonce %s : %s", listing.id, _e)

    if count:
        logger.info("expire_listings : %d annonce(s) expirée(s)", count)

    # ── 2. Fin de boost (boost_expires_at dépassé) — annonce reste ACTIVE ───
    # On désactive uniquement le flag is_boosted sans toucher au statut.
    boost_expired = Listing.objects.filter(
        is_boosted=True,
        boost_expires_at__lt=now,
        boost_expires_at__isnull=False,
    )
    boost_count = 0
    for listing in boost_expired.select_related('seller'):
        listing.is_boosted = False
        listing.save(update_fields=['is_boosted', 'updated_at'])
        boost_count += 1
        try:
            Notification.send(
                user=listing.seller,
                type=Notification.Type.SYSTEM,
                title='⚡ Boost terminé',
                body=f'Le boost de votre annonce « {listing.title} » est terminé. '
                     f'Relancez un boost pour rester en tête des résultats.',
                data={'listing_id': str(listing.id)},
            )
        except Exception as _e:
            logger.warning("Notification fin boost annonce %s : %s", listing.id, _e)

    if boost_count:
        logger.info("expire_listings : %d boost(s) terminé(s)", boost_count)

    return count


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
                    f'Guimatrix : Votre annonce "{listing.title[:30]}" a été refusée. '
                    f'Raison : {reason}. Contactez le support au +224622411238.'
                )
            except Exception as sms_err:
                logger.warning("SMS rejet échoué : %s", sms_err)

        elif decision == 'review':
            # Auto-publication activée → publier immédiatement (l'admin peut suspendre manuellement)
            from core.site_settings import SiteSettings
            auto = SiteSettings.flag('auto_approve_listings', default=True)
            if auto:
                listing.status = Listing.Status.ACTIVE
                listing.save(update_fields=['status'])
                logger.info("Annonce %s AUTO-APPROUVÉE (review)", listing_id)
            else:
                listing.status = Listing.Status.DRAFT
                listing.save(update_fields=['status'])
                logger.info("Annonce %s EN RÉVISION : %s", listing_id, reason)
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
        # SÉCURITÉ : fail-closed — laisser en DRAFT (en attente admin) si la modération échoue.
        # Ne jamais publier automatiquement en cas d'erreur, même si cela retarde les vendeurs.
        # Le retry Celery va relancer la tâche automatiquement.
        raise self.retry(exc=exc)
