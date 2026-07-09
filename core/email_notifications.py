"""
Service d'emails transactionnels Guimatrix — via Brevo SMTP.
Tous les emails sont en français, mobile-friendly, avec le design Guimatrix.

Appeler ces fonctions de manière asynchrone (thread) pour ne pas bloquer les requêtes.
"""
import logging
import threading
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Couleurs Guimatrix ────────────────────────────────────────────────────────
GREEN  = '#16a34a'
DARK   = '#111827'
GRAY   = '#6b7280'
LIGHT  = '#f9fafb'
BORDER = '#e5e7eb'


def _send(subject: str, html: str, recipient_email: str, recipient_name: str = ''):
    """Envoie un email en arrière-plan (non bloquant)."""
    if not recipient_email or '@' not in recipient_email:
        logger.debug("[EMAIL] Destinataire sans email valide — ignoré (%s)", recipient_name)
        return

    def _do_send():
        try:
            send_mail(
                subject=subject,
                message='',           # texte brut vide — on envoie uniquement HTML
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                html_message=html,
                fail_silently=False,
            )
            logger.info("[EMAIL] ✓ Envoyé à %s — %s", recipient_email, subject)
        except Exception as exc:
            logger.warning("[EMAIL] ✗ Échec %s → %s : %s", recipient_email, subject, exc)

    threading.Thread(target=_do_send, daemon=True).start()


# ── Template de base ──────────────────────────────────────────────────────────

def _base(title: str, content: str, cta_url: str = '', cta_label: str = '') -> str:
    cta_block = ''
    if cta_url and cta_label:
        cta_block = f'''
        <div style="text-align:center;margin:28px 0;">
          <a href="{cta_url}"
             style="background:{GREEN};color:#fff;text-decoration:none;
                    padding:13px 28px;border-radius:10px;font-weight:600;
                    font-size:15px;display:inline-block;">
            {cta_label}
          </a>
        </div>'''
    return f'''<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="margin:0;padding:0;background:{LIGHT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:{DARK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:{LIGHT};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;border:1px solid {BORDER};overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:{GREEN};padding:24px 32px;text-align:center;">
          <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
            Guimatrix
          </span>
          <span style="color:rgba(255,255,255,0.7);font-size:13px;display:block;margin-top:2px;">
            La marketplace guinéenne
          </span>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:{DARK};">{title}</h1>
          {content}
          {cta_block}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid {BORDER};text-align:center;">
          <p style="margin:0;font-size:12px;color:{GRAY};">
            © Guimatrix · <a href="https://guimatrix.com" style="color:{GREEN};text-decoration:none;">guimatrix.com</a>
            · <a href="https://guimatrix.com/contact" style="color:{GRAY};text-decoration:none;">Support</a>
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">
            Vous recevez cet email car vous avez un compte Guimatrix.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>'''


def _row(label: str, value: str) -> str:
    return f'''
    <tr>
      <td style="padding:8px 0;color:{GRAY};font-size:14px;width:40%;">{label}</td>
      <td style="padding:8px 0;font-weight:600;font-size:14px;">{value}</td>
    </tr>'''


def _box(content: str, color: str = LIGHT) -> str:
    return f'<div style="background:{color};border-radius:10px;padding:16px 20px;margin:16px 0;">{content}</div>'


def _fmt(amount: int) -> str:
    return f"{amount:,} GNF".replace(',', ' ')


# ── 1. Email de bienvenue ─────────────────────────────────────────────────────

def send_welcome(user) -> None:
    email = getattr(user, 'email', '') or ''
    name  = getattr(user, 'full_name', '') or 'cher utilisateur'
    if not email:
        return

    content = f'''
    <p style="color:{GRAY};font-size:15px;line-height:1.6;">
      Bonjour <strong>{name}</strong>,<br><br>
      Bienvenue sur <strong>Guimatrix</strong>, la marketplace des Guinéens.
      Vous pouvez dès maintenant acheter, vendre, et échanger en toute sécurité.
    </p>
    {_box(f'''
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;">🚀 Par où commencer ?</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:{GRAY};line-height:1.8;">
        <li>Parcourez les annonces disponibles</li>
        <li>Publiez votre première annonce gratuitement</li>
        <li>Complétez votre profil pour inspirer confiance</li>
      </ul>
    ''')}'''

    html = _base(
        title=f'Bienvenue sur Guimatrix, {name} ! 🎉',
        content=content,
        cta_url='https://guimatrix.com',
        cta_label='Découvrir Guimatrix →',
    )
    _send(f'Bienvenue sur Guimatrix, {name} !', html, email, name)


# ── 2. Nouvelle commande reçue (vendeur) ─────────────────────────────────────

def send_new_order_seller(order) -> None:
    try:
        email = getattr(order.seller, 'email', '') or ''
        name  = getattr(order.seller, 'full_name', '') or 'Vendeur'
        buyer_name = getattr(order.buyer, 'full_name', 'Acheteur')
        listing_title = getattr(order.listing, 'title', 'Votre annonce') if order.listing_id else 'Annonce'

        content = f'''
        <p style="color:{GRAY};font-size:15px;">
          Bonjour <strong>{name}</strong>, vous avez reçu une nouvelle commande !
        </p>
        {_box(f'''
          <table width="100%" cellpadding="0" cellspacing="0">
            {_row("Acheteur", buyer_name)}
            {_row("Annonce", listing_title[:60])}
            {_row("Montant", _fmt(order.amount_gnf))}
            {_row("Réf. commande", str(order.id)[:8].upper())}
          </table>
        ''')}
        <p style="color:{GRAY};font-size:14px;">
          Connectez-vous pour confirmer ou contacter l'acheteur.
        </p>'''

        html = _base(
            title='🛒 Nouvelle commande reçue',
            content=content,
            cta_url='https://guimatrix.com/orders',
            cta_label='Voir la commande →',
        )
        _send('🛒 Nouvelle commande — Guimatrix', html, email, name)
    except Exception as e:
        logger.warning("[EMAIL] send_new_order_seller error: %s", e)


# ── 3. Commande confirmée par le vendeur (acheteur) ──────────────────────────

def send_order_confirmed_buyer(order) -> None:
    try:
        email = getattr(order.buyer, 'email', '') or ''
        name  = getattr(order.buyer, 'full_name', '') or 'Acheteur'
        seller_name   = getattr(order.seller, 'full_name', 'Le vendeur')
        listing_title = getattr(order.listing, 'title', 'votre article') if order.listing_id else 'votre article'

        content = f'''
        <p style="color:{GRAY};font-size:15px;">
          Bonjour <strong>{name}</strong>,<br>
          <strong>{seller_name}</strong> a confirmé votre commande.
        </p>
        {_box(f'''
          <table width="100%" cellpadding="0" cellspacing="0">
            {_row("Article", listing_title[:60])}
            {_row("Montant", _fmt(order.amount_gnf))}
            {_row("Statut", "✅ Confirmée")}
          </table>
        ''', '#f0fdf4')}
        <p style="color:{GRAY};font-size:14px;">
          Vos fonds sont sécurisés en escrow et seront libérés au vendeur après réception.
        </p>'''

        html = _base(
            title='✅ Commande confirmée',
            content=content,
            cta_url='https://guimatrix.com/orders',
            cta_label='Voir ma commande →',
        )
        _send('✅ Votre commande est confirmée — Guimatrix', html, email, name)
    except Exception as e:
        logger.warning("[EMAIL] send_order_confirmed_buyer error: %s", e)


# ── 4. Paiement reçu (vendeur + acheteur) ────────────────────────────────────

def send_payment_received(order, payment) -> None:
    try:
        provider_labels = {
            'orange_money': 'Orange Money',
            'mtn_momo':     'MTN Mobile Money',
            'card':         'Carte Visa (Paycard)',
            'cash':         'Espèces',
        }
        provider_label = provider_labels.get(payment.provider, payment.provider)
        listing_title  = getattr(order.listing, 'title', 'article') if order.listing_id else 'article'

        # Email acheteur
        buyer_email = getattr(order.buyer, 'email', '') or ''
        buyer_name  = getattr(order.buyer, 'full_name', '') or 'Acheteur'
        if buyer_email:
            content = f'''
            <p style="color:{GRAY};font-size:15px;">
              Bonjour <strong>{buyer_name}</strong>, votre paiement a bien été reçu.
            </p>
            {_box(f'''
              <table width="100%" cellpadding="0" cellspacing="0">
                {_row("Article", listing_title[:60])}
                {_row("Montant payé", _fmt(payment.amount_gnf))}
                {_row("Mode de paiement", provider_label)}
                {_row("Réf. transaction", str(payment.external_ref or payment.id)[:12].upper())}
              </table>
            ''', '#f0fdf4')}'''
            html = _base(
                title='💰 Paiement confirmé',
                content=content,
                cta_url='https://guimatrix.com/orders',
                cta_label='Voir mes commandes →',
            )
            _send('💰 Paiement confirmé — Guimatrix', html, buyer_email, buyer_name)

        # Email vendeur
        seller_email = getattr(order.seller, 'email', '') or ''
        seller_name  = getattr(order.seller, 'full_name', '') or 'Vendeur'
        if seller_email:
            payout = getattr(order, 'seller_payout_gnf', 0) or 0
            content = f'''
            <p style="color:{GRAY};font-size:15px;">
              Bonjour <strong>{seller_name}</strong>, un acheteur vient de payer votre annonce.
            </p>
            {_box(f'''
              <table width="100%" cellpadding="0" cellspacing="0">
                {_row("Article vendu", listing_title[:60])}
                {_row("Montant total", _fmt(payment.amount_gnf))}
                {_row("Votre gain net", _fmt(payout) if payout else "Calculé après livraison")}
                {_row("Mode de paiement", provider_label)}
              </table>
            ''', '#f0fdf4')}
            <p style="color:{GRAY};font-size:14px;">
              Les fonds sont en escrow sécurisé et vous seront versés après confirmation de réception par l'acheteur.
            </p>'''
            html = _base(
                title='💰 Paiement reçu pour votre annonce',
                content=content,
                cta_url='https://guimatrix.com/orders',
                cta_label='Voir mes ventes →',
            )
            _send('💰 Paiement reçu — Guimatrix', html, seller_email, seller_name)
    except Exception as e:
        logger.warning("[EMAIL] send_payment_received error: %s", e)


# ── 5. Fonds libérés (vendeur) ────────────────────────────────────────────────

def send_escrow_released(order) -> None:
    try:
        email = getattr(order.seller, 'email', '') or ''
        name  = getattr(order.seller, 'full_name', '') or 'Vendeur'
        listing_title = getattr(order.listing, 'title', 'votre article') if order.listing_id else 'votre article'
        payout = getattr(order, 'seller_payout_gnf', order.amount_gnf)

        content = f'''
        <p style="color:{GRAY};font-size:15px;">
          Bonjour <strong>{name}</strong>, l'acheteur a confirmé la réception.
          Vos fonds sont maintenant disponibles.
        </p>
        {_box(f'''
          <table width="100%" cellpadding="0" cellspacing="0">
            {_row("Article", listing_title[:60])}
            {_row("Fonds libérés", _fmt(payout))}
            {_row("Statut", "✅ Disponible")}
          </table>
        ''', '#f0fdf4')}'''

        html = _base(
            title='🎉 Vos fonds sont disponibles !',
            content=content,
            cta_url='https://guimatrix.com/orders',
            cta_label='Voir mes ventes →',
        )
        _send('🎉 Fonds disponibles — Guimatrix', html, email, name)
    except Exception as e:
        logger.warning("[EMAIL] send_escrow_released error: %s", e)


# ── 6. Commande annulée (les deux parties) ───────────────────────────────────

def send_order_cancelled(order, cancelled_by_user) -> None:
    try:
        listing_title = getattr(order.listing, 'title', 'article') if order.listing_id else 'article'
        other = order.seller if cancelled_by_user == order.buyer else order.buyer
        other_email = getattr(other, 'email', '') or ''
        other_name  = getattr(other, 'full_name', '') or 'Utilisateur'
        by_name     = getattr(cancelled_by_user, 'full_name', 'L\'autre partie')

        content = f'''
        <p style="color:{GRAY};font-size:15px;">
          Bonjour <strong>{other_name}</strong>,<br>
          La commande pour <strong>« {listing_title[:60]} »</strong> a été annulée par <strong>{by_name}</strong>.
        </p>
        {_box(f'<p style="margin:0;font-size:14px;color:{GRAY};">Si vous avez un paiement en attente, il sera remboursé selon votre mode de paiement.</p>')}'''

        html = _base(
            title='❌ Commande annulée',
            content=content,
            cta_url='https://guimatrix.com',
            cta_label='Voir les annonces →',
        )
        _send('❌ Commande annulée — Guimatrix', html, other_email, other_name)
    except Exception as e:
        logger.warning("[EMAIL] send_order_cancelled error: %s", e)


# ── 7. Litige ouvert (vendeur) ────────────────────────────────────────────────

def send_dispute_opened(order) -> None:
    try:
        email = getattr(order.seller, 'email', '') or ''
        name  = getattr(order.seller, 'full_name', '') or 'Vendeur'
        listing_title = getattr(order.listing, 'title', 'votre article') if order.listing_id else 'votre article'

        content = f'''
        <p style="color:{GRAY};font-size:15px;">
          Bonjour <strong>{name}</strong>,<br>
          Un litige a été ouvert par l'acheteur pour la commande
          <strong>« {listing_title[:60]} »</strong>.
        </p>
        {_box(f'''
          <p style="margin:0;font-size:14px;color:#92400e;">
            ⚠️ Notre équipe va examiner le litige. Les fonds restent bloqués en escrow
            jusqu'à résolution. Vous pouvez envoyer vos éléments de preuve via le chat.
          </p>
        ''', '#fffbeb')}'''

        html = _base(
            title='⚠️ Litige ouvert sur votre vente',
            content=content,
            cta_url='https://guimatrix.com/orders',
            cta_label='Voir le litige →',
        )
        _send('⚠️ Litige ouvert — Guimatrix', html, email, name)
    except Exception as e:
        logger.warning("[EMAIL] send_dispute_opened error: %s", e)


# ── 8. Litige résolu (acheteur + vendeur) ────────────────────────────────────

def send_dispute_resolved(order, winner: str) -> None:
    """winner : 'buyer' ou 'seller'"""
    try:
        listing_title = getattr(order.listing, 'title', 'article') if order.listing_id else 'article'

        for role, user in [('buyer', order.buyer), ('seller', order.seller)]:
            email = getattr(user, 'email', '') or ''
            name  = getattr(user, 'full_name', '') or role

            if role == winner:
                outcome = f'Le litige a été résolu en <strong>votre faveur</strong>.'
                detail  = ('Vous serez remboursé.' if role == 'buyer'
                           else f'Les fonds ({_fmt(order.seller_payout_gnf)}) vous sont versés.')
                emoji   = '✅'
            else:
                outcome = 'Le litige a été résolu en faveur de l\'autre partie.'
                detail  = ('Les fonds ont été versés au vendeur.' if role == 'buyer'
                           else 'L\'acheteur a été remboursé.')
                emoji   = 'ℹ️'

            content = f'''
            <p style="color:{GRAY};font-size:15px;">
              Bonjour <strong>{name}</strong>,<br>
              Le litige pour <strong>« {listing_title[:60]} »</strong> a été résolu.
            </p>
            {_box(f'<p style="margin:0;font-size:14px;">{emoji} {outcome}<br>{detail}</p>',
                  '#f0fdf4' if role == winner else LIGHT)}'''

            html = _base(
                title=f'{emoji} Litige résolu',
                content=content,
                cta_url='https://guimatrix.com/orders',
                cta_label='Voir mes commandes →',
            )
            _send(f'{emoji} Litige résolu — Guimatrix', html, email, name)
    except Exception as e:
        logger.warning("[EMAIL] send_dispute_resolved error: %s", e)


# ── OTP par email (inscription diaspora) ──────────────────────────────────────

def send_otp_email(recipient_email: str, code: str, name: str = '') -> None:
    """
    Envoie le code OTP de vérification par email.
    Utilisé pour l'inscription diaspora (sans numéro guinéen).
    """
    greeting = f'Bonjour <strong>{name}</strong>' if name else 'Bonjour'
    content = f'''
    <p style="color:{GRAY};font-size:15px;line-height:1.6;">
      {greeting},<br><br>
      Voici votre code de vérification pour activer votre compte Guimatrix.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <div style="display:inline-block;background:#f0fdf4;border:2px solid #86efac;
                  border-radius:16px;padding:20px 40px;">
        <span style="font-size:44px;letter-spacing:14px;font-weight:800;
                     color:{DARK};font-family:monospace;">{code}</span>
      </div>
    </div>
    <p style="color:{GRAY};font-size:13px;text-align:center;">
      ⏱️ Ce code expire dans <strong>30 minutes</strong>.<br>
      Ne le partagez jamais — Guimatrix ne vous le demandera pas.
    </p>
    '''
    html = _base(
        title='Vérifiez votre adresse email',
        content=content,
    )
    _send(
        subject='🔐 Votre code Guimatrix',
        html=html,
        recipient_email=recipient_email,
        recipient_name=name,
    )
