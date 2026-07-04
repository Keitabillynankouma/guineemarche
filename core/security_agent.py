"""
Agent de sécurité IA — Guimatrix
Tâche Celery quotidienne qui surveille la fraude, les comptes suspects
et génère un rapport envoyé à l'admin.

Planification : tous les jours à 07h00 (Africa/Conakry)
"""
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from celery import shared_task

logger = logging.getLogger(__name__)


# ─── Collecte des données suspectes ──────────────────────────────────────────

def _collect_suspicious_listings(since):
    """Détecte les annonces potentiellement frauduleuses."""
    from apps.listings.models import Listing
    from django.db.models import Count

    suspects = []

    # 1. Prix anormalement bas (moins de 1000 GNF sauf gratuit)
    low_price = Listing.objects.filter(
        created_at__gte=since,
        status=Listing.Status.ACTIVE,
        price_gnf__gt=0,
        price_gnf__lt=1000,
    ).select_related('seller', 'category')[:20]
    for l in low_price:
        suspects.append({
            'id': str(l.id), 'title': l.title,
            'price': l.price_gnf, 'seller': l.seller.phone_number,
            'reason': 'Prix suspect (<1000 GNF)',
            'created_at': l.created_at.strftime('%d/%m %H:%M'),
        })

    # 2. Descriptions très courtes (moins de 20 caractères)
    short_desc = Listing.objects.filter(
        created_at__gte=since,
        status=Listing.Status.ACTIVE,
    ).extra(where=["LENGTH(description) < 20"])[:20]
    for l in short_desc:
        suspects.append({
            'id': str(l.id), 'title': l.title,
            'price': l.price_gnf, 'seller': l.seller.phone_number,
            'reason': 'Description trop courte',
            'created_at': l.created_at.strftime('%d/%m %H:%M'),
        })

    # 3. Vendeurs ayant publié plus de 5 annonces en 24h
    from django.db.models import Count
    bulk_sellers = Listing.objects.filter(
        created_at__gte=since,
    ).values('seller__phone_number', 'seller__id').annotate(
        count=Count('id')
    ).filter(count__gte=5).order_by('-count')

    for s in bulk_sellers:
        suspects.append({
            'id': str(s['seller__id']),
            'title': f"{s['count']} annonces en 24h",
            'seller': s['seller__phone_number'],
            'reason': f"Volume anormal : {s['count']} annonces publiées en 24h",
            'created_at': 'Dernières 24h',
        })

    return suspects


def _collect_suspicious_accounts(since):
    """Détecte les comptes suspects."""
    from apps.accounts.models import User
    suspects = []

    # 1. Comptes créés depuis moins de 24h avec annonces déjà publiées
    new_with_listings = User.objects.filter(
        created_at__gte=since,
    ).annotate(listing_count=__import__('django.db.models', fromlist=['Count']).Count('listings')).filter(
        listing_count__gte=3
    ).values('phone_number', 'full_name', 'created_at', 'listing_count')

    for u in new_with_listings:
        suspects.append({
            'phone': u['phone_number'], 'name': u['full_name'],
            'reason': f"Nouveau compte ({u['listing_count']} annonces en <24h)",
            'created_at': u['created_at'].strftime('%d/%m %H:%M'),
        })

    # 2. Comptes non vérifiés avec commandes (risque arnaque)
    from apps.orders.models import Order
    unverified_sellers = Order.objects.filter(
        created_at__gte=since,
        seller__is_verified=False,
        status=Order.Status.PENDING,
    ).select_related('seller', 'listing').values(
        'seller__phone_number', 'seller__full_name', 'listing__title'
    ).distinct()[:10]

    for o in unverified_sellers:
        suspects.append({
            'phone': o['seller__phone_number'],
            'name': o['seller__full_name'],
            'reason': f"Vendeur non vérifié avec commande en attente (annonce: {o['listing__title'][:40]})",
            'created_at': 'Dernières 24h',
        })

    return suspects


def _collect_payment_anomalies(since):
    """Détecte les anomalies de paiement."""
    from apps.orders.models import Payment
    anomalies = []

    # Paiements échoués répétés sur le même vendeur
    failed = Payment.objects.filter(
        created_at__gte=since,
        status=Payment.Status.FAILED,
    ).values('order__seller__phone_number').annotate(
        count=__import__('django.db.models', fromlist=['Count']).Count('id')
    ).filter(count__gte=3).order_by('-count')

    for f in failed:
        anomalies.append({
            'phone': f['order__seller__phone_number'],
            'reason': f"{f['count']} paiements échoués vers ce vendeur en 24h",
        })

    return anomalies


# ─── Analyse IA ──────────────────────────────────────────────────────────────

def _analyze_with_claude(suspicious_listings, suspicious_accounts, payment_anomalies):
    """Claude analyse les données et produit un rapport structuré."""
    api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return None

    if not suspicious_listings and not suspicious_accounts and not payment_anomalies:
        return "✅ Aucune anomalie détectée sur les dernières 24 heures."

    import json
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        data_summary = {
            'annonces_suspectes': suspicious_listings[:10],
            'comptes_suspects': suspicious_accounts[:10],
            'anomalies_paiement': payment_anomalies[:5],
        }

        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=800,
            system="""Tu es l'agent de sécurité de Guimatrix, une marketplace guinéenne.
Analyse les données de sécurité des dernières 24h et produis un rapport concis en français.
Format : 3 sections (Annonces, Comptes, Paiements) avec niveau de risque (🟢 Faible / 🟡 Moyen / 🔴 Élevé).
Recommande des actions concrètes. Max 400 mots.""",
            messages=[{
                'role': 'user',
                'content': f"Données à analyser :\n{json.dumps(data_summary, ensure_ascii=False, indent=2)}"
            }]
        )
        return response.content[0].text
    except Exception as e:
        logger.error("Claude security analysis failed: %s", e)
        return None


# ─── Envoi du rapport ─────────────────────────────────────────────────────────

def _send_report(report_text, suspicious_listings, suspicious_accounts, payment_anomalies, date_str):
    """Envoie le rapport par email à l'admin et le stocke en DB."""
    total_alerts = len(suspicious_listings) + len(suspicious_accounts) + len(payment_anomalies)

    # Log toujours dans Railway stdout
    logger.info(
        "=== RAPPORT SÉCURITÉ GUIMATRIX — %s ===\n"
        "Alertes totales: %d\n"
        "Annonces suspectes: %d\n"
        "Comptes suspects: %d\n"
        "Anomalies paiement: %d\n\n"
        "Analyse IA:\n%s",
        date_str, total_alerts,
        len(suspicious_listings), len(suspicious_accounts), len(payment_anomalies),
        report_text or "(Claude non disponible)"
    )

    # Email si configuré
    support_email = getattr(settings, 'ADMIN_SECURITY_EMAIL', '')
    if not support_email:
        support_email = 'bnkeita020@gmail.com'

    try:
        from django.core.mail import send_mail

        level = '🔴 ÉLEVÉ' if total_alerts >= 5 else '🟡 MOYEN' if total_alerts >= 2 else '🟢 FAIBLE'

        body_lines = [
            f"RAPPORT DE SÉCURITÉ GUIMATRIX — {date_str}",
            f"Niveau de risque global : {level}",
            f"Total alertes : {total_alerts}",
            "=" * 50,
            "",
        ]

        if report_text:
            body_lines.extend(["ANALYSE IA :", report_text, ""])

        if suspicious_listings:
            body_lines.append(f"ANNONCES SUSPECTES ({len(suspicious_listings)}):")
            for l in suspicious_listings[:5]:
                body_lines.append(f"  • {l.get('title', '')[:50]} | {l.get('reason', '')} | Vendeur: {l.get('seller', '')}")
            body_lines.append("")

        if suspicious_accounts:
            body_lines.append(f"COMPTES SUSPECTS ({len(suspicious_accounts)}):")
            for a in suspicious_accounts[:5]:
                body_lines.append(f"  • {a.get('phone', '')} ({a.get('name', '')}) — {a.get('reason', '')}")
            body_lines.append("")

        if payment_anomalies:
            body_lines.append(f"ANOMALIES PAIEMENT ({len(payment_anomalies)}):")
            for p in payment_anomalies[:5]:
                body_lines.append(f"  • {p.get('phone', '')} — {p.get('reason', '')}")

        body_lines.extend([
            "",
            "─" * 50,
            "Guimatrix Security Agent | Rapport automatique quotidien",
            f"Admin : https://api.guimatrix.com/gm-backoffice-9f3a2e/",
        ])

        send_mail(
            subject=f"[Guimatrix Sécurité] {level} — {total_alerts} alerte(s) — {date_str}",
            message='\n'.join(body_lines),
            from_email='security@guimatrix.com',
            recipient_list=[support_email],
            fail_silently=True,
        )
        logger.info("Rapport sécurité envoyé à %s", support_email)
    except Exception as e:
        logger.warning("Envoi rapport sécurité échoué: %s", e)


# ─── Tâche Celery principale ──────────────────────────────────────────────────

@shared_task(name='core.security_agent.run_security_scan', bind=True, max_retries=2)
def run_security_scan(self):
    """
    Agent de sécurité quotidien.
    Planifié à 07h00 Africa/Conakry via CELERY_BEAT_SCHEDULE.
    """
    now = timezone.now()
    since = now - timedelta(hours=24)
    date_str = now.strftime('%d/%m/%Y')

    logger.info("[SecurityAgent] Démarrage scan — %s", date_str)

    try:
        suspicious_listings  = _collect_suspicious_listings(since)
        suspicious_accounts  = _collect_suspicious_accounts(since)
        payment_anomalies    = _collect_payment_anomalies(since)

        report_text = _analyze_with_claude(
            suspicious_listings, suspicious_accounts, payment_anomalies
        )

        _send_report(
            report_text, suspicious_listings, suspicious_accounts,
            payment_anomalies, date_str
        )

        logger.info(
            "[SecurityAgent] Scan terminé — %d alertes totales",
            len(suspicious_listings) + len(suspicious_accounts) + len(payment_anomalies)
        )

    except Exception as exc:
        logger.error("[SecurityAgent] Erreur critique: %s", exc, exc_info=True)
        raise self.retry(exc=exc, countdown=300)  # retry dans 5 min
