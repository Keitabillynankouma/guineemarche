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
            # Compléter la commande si elle est toujours CONFIRMED (escrow auto-release)
            if order.status == Order.Status.CONFIRMED:
                order.complete()
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
                    f'Guimatrix: Fonds libérés! Votre gain de {order.seller_payout_gnf:,} GNF '
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
def weekly_livreur_payouts():
    """
    Tâche hebdomadaire (chaque lundi à 07h00) :
    Génère les récapitulatifs de virement pour tous les livreurs ayant des paiements en attente
    depuis la semaine écoulée, et notifie l'admin comptable.
    """
    from .models import LivreurWeeklyPayout
    from datetime import date, timedelta

    # Lundi de la semaine qui vient de se terminer (semaine passée = lundi précédent)
    today      = date.today()
    last_monday = today - timedelta(days=today.weekday() + 7)  # lundi semaine précédente

    count = LivreurWeeklyPayout.generate_for_week(last_monday)
    logger.info("weekly_livreur_payouts : %d récapitulatif(s) générés pour semaine du %s", count, last_monday)

    if count > 0:
        # Notifier les admins comptables
        try:
            from apps.notifications.models import Notification
            from django.contrib.auth import get_user_model
            User = get_user_model()
            admins = User.objects.filter(
                role__in=['admin', 'super_admin', 'admin_accounting'],
                is_active=True,
            )
            pending_payouts = LivreurWeeklyPayout.objects.filter(
                week_start=last_monday, status=LivreurWeeklyPayout.Status.PENDING
            )
            total_gnf = sum(p.net_gnf for p in pending_payouts)
            for admin in admins:
                Notification.send(
                    user=admin,
                    type=Notification.Type.SYSTEM,
                    title='💸 Virements livreurs à effectuer',
                    body=f'{count} livreur(s) à payer cette semaine — Total : {total_gnf:,} GNF.',
                    data={'week_start': str(last_monday)},
                )
        except Exception as e:
            logger.warning("Notification weekly payouts échouée : %s", e)

    return count


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
