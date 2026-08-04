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

            # ── Virement automatique au vendeur ──────────────────────────────
            try:
                from .models import SellerPayout
                from .payment_service import disburse_to_seller
                payout = SellerPayout.objects.filter(
                    order=order, status=SellerPayout.Status.PENDING
                ).first()
                if payout:
                    result = disburse_to_seller(str(payout.id))
                    logger.info("[ESCROW AUTO] Virement vendeur %s : %s", payout.id, result.message)
            except Exception as _pe:
                logger.warning("[ESCROW AUTO] Virement vendeur échoué commande %s : %s", order.id, _pe)

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

    # ── Virement automatique immédiat pour chaque livreur avec numéro ─────────
    if count > 0:
        from .payment_service import disburse_to_livreur
        pending_payouts = LivreurWeeklyPayout.objects.filter(
            week_start=last_monday, status=LivreurWeeklyPayout.Status.PENDING
        ).select_related('livreur')

        auto_ok = auto_fail = manual_needed = 0
        total_gnf = 0

        for payout in pending_payouts:
            total_gnf += payout.net_gnf
            try:
                result = disburse_to_livreur(str(payout.id))
                if result.success:
                    auto_ok += 1
                    logger.info("[WEEKLY PAYOUT] Livreur %s versé — réf %s", payout.livreur.full_name, result.reference)
                    # Notifier le livreur
                    try:
                        from apps.notifications.models import Notification
                        Notification.send(
                            user=payout.livreur,
                            type=Notification.Type.SYSTEM,
                            title='💰 Salaire versé',
                            body=f'Votre paiement de {payout.net_gnf:,} GNF a été envoyé sur votre compte mobile money.',
                            data={'payout_id': str(payout.id)},
                        )
                    except Exception:
                        pass
                else:
                    auto_fail += 1
                    logger.warning("[WEEKLY PAYOUT] Échec virement livreur %s : %s", payout.livreur.full_name, result.message)
            except Exception as _pe:
                manual_needed += 1
                logger.error("[WEEKLY PAYOUT] Exception virement livreur %s : %s", payout.id, _pe)

        logger.info("[WEEKLY PAYOUT] Résultat : %d auto, %d échecs, %d manuels — total %s GNF",
                    auto_ok, auto_fail, manual_needed, f"{total_gnf:,}")

        # Notifier les admins seulement si des virements manuels sont nécessaires
        if auto_fail > 0 or manual_needed > 0:
            try:
                from apps.notifications.models import Notification
                from django.contrib.auth import get_user_model
                User = get_user_model()
                admins = User.objects.filter(
                    role__in=['admin', 'super_admin', 'admin_accounting'],
                    is_active=True,
                )
                for admin in admins:
                    Notification.send(
                        user=admin,
                        type=Notification.Type.SYSTEM,
                        title='⚠️ Virements livreurs — action requise',
                        body=f'{auto_ok} virement(s) automatique(s) OK. '
                             f'{auto_fail + manual_needed} nécessitent une action manuelle.',
                        data={'week_start': str(last_monday)},
                    )
            except Exception as e:
                logger.warning("Notification weekly payouts admin échouée : %s", e)

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
            # Calcul du gain net estimé (96% du montant article, hors frais livraison)
            item_amount = order.amount_gnf - (order.delivery_fee_gnf or 0)
            estimated_payout = int(item_amount * 0.96)
            Notification.send(
                user=order.seller,
                type=Notification.Type.ORDER_UPDATE,
                title='⏰ Fonds bientôt disponibles',
                body=f'Votre gain estimé ({estimated_payout:,} GNF) pour « {order.listing.title} » '
                     f'sera libéré dans environ {mins_left} minutes.',
                data={'order_id': str(order.id)},
            )
        except Exception as e:
            logger.warning("Rappel escrow échoué commande %s : %s", order.id, e)
