"""
Tâches Celery pour la gestion des commandes et de l'escrow.
"""
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def auto_release_escrow():
    """
    Tâche périodique (toutes les heures) :
    Libère automatiquement les fonds en escrow dont la date est dépassée.

    Règles :
    - escrow_status = HELD
    - escrow_release_at ≤ maintenant
    - escrow_admin_hold = False (l'admin n'a pas bloqué manuellement)
    - commande complétée (acheteur a confirmé) OU délai dépassé
    """
    from .models import Order

    now = timezone.now()

    orders_to_release = Order.objects.filter(
        escrow_status=Order.EscrowStatus.HELD,
        escrow_release_at__lte=now,
        escrow_admin_hold=False,
    ).select_related('seller', 'listing')

    released = 0
    for order in orders_to_release:
        try:
            order.release_escrow()
            released += 1
            logger.info("Escrow libéré automatiquement — commande %s (%s GNF)", order.id, order.amount_gnf)

            # Notifier le vendeur
            try:
                from apps.notifications.models import Notification
                Notification.send(
                    user=order.seller,
                    type=Notification.Type.ORDER_UPDATE,
                    title='💰 Fonds disponibles',
                    body=f'Les fonds de la commande « {order.listing.title} » ont été libérés. '
                         f'Votre gain net : {order.seller_payout_gnf:,} GNF.',
                    data={'order_id': str(order.id)},
                )
            except Exception as e:
                logger.warning("Notification libération escrow échouée : %s", e)

            # SMS vendeur
            try:
                from core.sms import send_sms
                send_sms(
                    str(order.seller.phone_number),
                    f'GuinéeMarché: Fonds libérés! Votre gain de {order.seller_payout_gnf:,} GNF '
                    f'pour « {order.listing.title[:30]} » est disponible.'
                )
            except Exception:
                pass

        except Exception as exc:
            logger.error("Erreur libération escrow commande %s : %s", order.id, exc, exc_info=True)

    if released:
        logger.info("auto_release_escrow : %d commande(s) libérée(s)", released)
    return released


@shared_task
def notify_pending_escrow():
    """
    Tâche périodique (toutes les 12h) :
    Rappel aux vendeurs dont les fonds seront bientôt libérés.
    """
    from .models import Order
    from datetime import timedelta

    now = timezone.now()
    # Commandes qui seront libérées dans moins de 2h
    soon = now + timedelta(hours=2)

    orders_soon = Order.objects.filter(
        escrow_status=Order.EscrowStatus.HELD,
        escrow_release_at__lte=soon,
        escrow_release_at__gt=now,
        escrow_admin_hold=False,
    ).select_related('seller', 'listing')

    for order in orders_soon:
        try:
            from apps.notifications.models import Notification
            mins_left = int((order.escrow_release_at - now).total_seconds() / 60)
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='⏰ Fonds bientôt disponibles',
                body=f'Vos fonds ({order.seller_payout_gnf:,} GNF) pour « {order.listing.title} » '
                     f'seront libérés dans environ {mins_left} minutes.',
                data={'order_id': str(order.id)},
            )
        except Exception as e:
            logger.warning("Rappel escrow échoué commande %s : %s", order.id, e)
