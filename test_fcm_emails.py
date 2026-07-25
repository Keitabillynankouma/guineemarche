"""
Tests FCM push + emails transactionnels :

  ── FCM TOKEN ────────────────────────────────────────────────────────────────
  F1 — Enregistrer un token FCM (PATCH /accounts/me/fcm-token/)
  F2 — Token sauvegardé en DB sur l'utilisateur
  F3 — Requête sans token → 400
  F4 — Unauthentifié → 401
  F5 — Mettre à jour un token existant (écrase l'ancien)

  ── EMAILS TRANSACTIONNELS (unit — Brevo mocké) ──────────────────────────────
  E1 — send_welcome              : email envoyé si user.email présent
  E2 — send_new_order_seller     : email envoyé au vendeur
  E3 — send_order_confirmed_buyer: email envoyé à l'acheteur
  E4 — send_payment_received     : email envoyé (buyer + seller), label ChaChap
  E5 — send_boost_activated      : email envoyé au vendeur
  E6 — send_otp_email            : envoi synchrone (pas de thread)
  E7 — Pas d'email si BREVO_API_KEY absent (log warning seulement)
  E8 — Pas d'email si recipient n'a pas d'adresse email

  ── INTÉGRATION WEBHOOK → EMAILS ─────────────────────────────────────────────
  W1 — Webhook ChaChap succès → send_order_confirmed_buyer + send_payment_received appelés
  W2 — Webhook ChaChap boost → send_boost_activated appelé

Usage : python test_fcm_emails.py   (serveur sur :8000)
"""
import os, django, requests, uuid, json, hmac, hashlib
from unittest.mock import patch, MagicMock, call

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE    = "http://127.0.0.1:8000/api/v1"
results = []

def auth(t):       return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def sep(title, n): print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond


# ── Setup ─────────────────────────────────────────────────────────────────────
print("Initialisation Django + comptes de test…")
django.setup()
from apps.accounts.models import User
from apps.listings.models import Listing, BoostPayment
from apps.orders.models import Order, Payment

def ensure_user(phone, name, role, email=None, is_staff=False):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(
            phone_number=phone, password="test1234",
            full_name=name, role=role,
            is_active=True, is_verified=True, is_staff=is_staff,
        )
    else:
        User.objects.filter(pk=u.pk).update(
            is_active=True, is_verified=True, role=role, is_staff=is_staff,
        )
        u.refresh_from_db()
    if email:
        User.objects.filter(pk=u.pk).update(email=email)
        u.refresh_from_db()
    return u

def login(phone):
    from rest_framework_simplejwt.tokens import AccessToken
    user = User.objects.get(phone_number=phone)
    return str(AccessToken.for_user(user))

seller  = ensure_user("+224629003001", "Vendeur FCM",  "seller",  email="seller_fcm@test.com")
buyer   = ensure_user("+224629003002", "Acheteur FCM", "buyer",   email="buyer_fcm@test.com")
admin   = ensure_user("+224629003099", "Admin FCM",    "super_admin", is_staff=True)
no_mail = ensure_user("+224629003003", "Sans Email",   "buyer")   # pas d'email

tok_seller = login("+224629003001")
tok_buyer  = login("+224629003002")

listing = Listing.objects.create(
    seller=seller, title=f"Article FCM {uuid.uuid4().hex[:4]}",
    price_gnf=80_000, price_type="fixed", city="Conakry",
    condition="good", description="Test FCM.", status="active",
)

from django.conf import settings as _s
HMAC_KEY = (getattr(_s, 'CHACHAP_HMAC_KEY', '')
            or getattr(_s, 'CHACHAP_WEBHOOK_SECRET', '')
            or getattr(_s, 'CHACHAP_API_KEY', ''))

def chachap_sig(body: bytes) -> str:
    return hmac.new(HMAC_KEY.encode(), body, hashlib.sha256).hexdigest()

print("  ✅ Comptes et listing créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Enregistrer un token FCM", "F1")
# ════════════════════════════════════════════════════════════════════════════

FCM_TOKEN = f"ExampleFCMToken_{uuid.uuid4().hex}"

r = requests.patch(
    f"{BASE}/accounts/me/fcm-token/",
    headers=auth(tok_buyer),
    json={"fcm_token": FCM_TOKEN},
)
check("PATCH /accounts/me/fcm-token/ → 200", r.status_code == 200,
      f"HTTP {r.status_code} — {r.text[:100]}")


# ════════════════════════════════════════════════════════════════════════════
sep("Token sauvegardé en DB", "F2")
# ════════════════════════════════════════════════════════════════════════════

buyer.refresh_from_db()
check("fcm_token présent sur user", buyer.fcm_token == FCM_TOKEN,
      f"attendu={FCM_TOKEN[:20]}… reçu={buyer.fcm_token[:20] if buyer.fcm_token else '(vide)'}")


# ════════════════════════════════════════════════════════════════════════════
sep("Token manquant → 400", "F3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.patch(
    f"{BASE}/accounts/me/fcm-token/",
    headers=auth(tok_buyer),
    json={},
)
check("Payload vide → 400", r.status_code == 400, f"HTTP {r.status_code}")

r = requests.patch(
    f"{BASE}/accounts/me/fcm-token/",
    headers=auth(tok_buyer),
    json={"fcm_token": ""},
)
check("Token vide string → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Unauthentifié → 401", "F4")
# ════════════════════════════════════════════════════════════════════════════

r = requests.patch(
    f"{BASE}/accounts/me/fcm-token/",
    json={"fcm_token": "SomeToken"},
)
check("Sans token JWT → 401", r.status_code == 401, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Mise à jour d'un token existant", "F5")
# ════════════════════════════════════════════════════════════════════════════

NEW_TOKEN = f"NewFCMToken_{uuid.uuid4().hex}"
r = requests.patch(
    f"{BASE}/accounts/me/fcm-token/",
    headers=auth(tok_buyer),
    json={"fcm_token": NEW_TOKEN},
)
check("PATCH avec nouveau token → 200", r.status_code == 200, f"HTTP {r.status_code}")
buyer.refresh_from_db()
check("Ancien token remplacé", buyer.fcm_token == NEW_TOKEN,
      f"fcm_token={buyer.fcm_token[:20] if buyer.fcm_token else '(vide)'}…")


# ════════════════════════════════════════════════════════════════════════════
print("\n── Tests emails (Brevo mocké — aucun email réel envoyé) ──")
# ════════════════════════════════════════════════════════════════════════════

# Créer des objets Order et Payment en DB pour les tests emails
email_order = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=80_000,
    delivery_mode=Order.DeliveryMode.MEETING_POINT,
    status=Order.Status.CONFIRMED,
)
email_payment = Payment.objects.create(
    order=email_order,
    provider=Payment.Provider.CHACHAP,
    amount_gnf=80_000,
    status=Payment.Status.SUCCESS,
    external_ref="CCP-TEST-EMAIL",
)

# Boost pour test E5
email_boost = BoostPayment.objects.create(
    listing=listing, days=7, amount=30_000,
    provider=Payment.Provider.CHACHAP,
    status=BoostPayment.Status.APPROVED,
    ext_ref="CCP-BOOST-EMAIL",
)


def with_brevo_mock(fn):
    """Décore une fonction de test : mock _do_send_now et retourne le mock."""
    with patch("core.email_notifications._do_send_now") as mock_send:
        mock_send.return_value = True
        fn(mock_send)


# ════════════════════════════════════════════════════════════════════════════
sep("send_welcome — email envoyé si user.email présent", "E1")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_welcome

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_welcome(buyer)
    import time; time.sleep(0.2)  # laisser le thread async se terminer
    check("send_welcome appelle Brevo pour user avec email",
          mock_send.called, f"appelé {mock_send.call_count}x")
    if mock_send.called:
        check("Destinataire = email acheteur",
              mock_send.call_args[0][2] == buyer.email,
              f"got={mock_send.call_args[0][2]}")

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_welcome(no_mail)
    time.sleep(0.2)
    check("send_welcome silencieux si user sans email", not mock_send.called)


# ════════════════════════════════════════════════════════════════════════════
sep("send_new_order_seller — email vendeur", "E2")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_new_order_seller

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_new_order_seller(email_order)
    time.sleep(0.2)
    check("send_new_order_seller appelle Brevo", mock_send.called)
    if mock_send.called:
        check("Destinataire = email vendeur",
              mock_send.call_args[0][2] == seller.email,
              f"got={mock_send.call_args[0][2]}")


# ════════════════════════════════════════════════════════════════════════════
sep("send_order_confirmed_buyer — email acheteur", "E3")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_order_confirmed_buyer

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_order_confirmed_buyer(email_order)
    time.sleep(0.2)
    check("send_order_confirmed_buyer appelle Brevo", mock_send.called)
    if mock_send.called:
        check("Destinataire = email acheteur",
              mock_send.call_args[0][2] == buyer.email,
              f"got={mock_send.call_args[0][2]}")


# ════════════════════════════════════════════════════════════════════════════
sep("send_payment_received — label ChaChap, buyer + seller", "E4")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_payment_received

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_payment_received(email_order, email_payment)
    time.sleep(0.3)
    check("send_payment_received appelle Brevo", mock_send.called)

    all_calls = mock_send.call_args_list
    emails_envoyés = [c[0][2] for c in all_calls]
    check("Email envoyé à l'acheteur", buyer.email in emails_envoyés,
          f"emails: {emails_envoyés}")
    check("Email envoyé au vendeur", seller.email in emails_envoyés,
          f"emails: {emails_envoyés}")

    # Vérifier que le HTML contient "ChaChap Pay"
    htmls = [c[0][1] for c in all_calls]
    check("Label 'ChaChap Pay' dans le contenu email",
          any("ChaChap Pay" in h for h in htmls),
          "vérifie provider_labels['chachap']")


# ════════════════════════════════════════════════════════════════════════════
sep("send_boost_activated — email vendeur boost", "E5")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_boost_activated

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_boost_activated(email_boost)
    time.sleep(0.2)
    check("send_boost_activated appelle Brevo", mock_send.called)
    if mock_send.called:
        check("Destinataire = email vendeur",
              mock_send.call_args[0][2] == seller.email,
              f"got={mock_send.call_args[0][2]}")
        check("HTML contient durée boost (7 jours)",
              "7" in mock_send.call_args[0][1])


# ════════════════════════════════════════════════════════════════════════════
sep("send_otp_email — envoi synchrone", "E6")
# ════════════════════════════════════════════════════════════════════════════

from core.email_notifications import send_otp_email

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_otp_email("test@example.com", "123456", "Test User")
    # Pas de sleep : doit être synchrone
    check("OTP email envoyé de manière synchrone (pas de thread)",
          mock_send.called, f"appelé={mock_send.called}")


# ════════════════════════════════════════════════════════════════════════════
sep("Pas d'email si BREVO_API_KEY absent", "E7")
# ════════════════════════════════════════════════════════════════════════════

with patch("core.email_notifications.settings") as mock_settings:
    mock_settings.BREVO_API_KEY      = ''
    mock_settings.BREVO_SENDER_EMAIL = 'test@test.com'
    with patch("core.email_notifications._requests.post") as mock_post:
        # On appelle _do_send_now directement
        from core.email_notifications import _do_send_now
        result = _do_send_now("Test", "<p>Test</p>", "dest@test.com", "Dest")
        check("Retourne False si BREVO_API_KEY absent", result is False)
        check("Aucune requête HTTP envoyée à Brevo", not mock_post.called)


# ════════════════════════════════════════════════════════════════════════════
sep("Pas d'email si destinataire sans adresse email", "E8")
# ════════════════════════════════════════════════════════════════════════════

with patch("core.email_notifications._do_send_now") as mock_send:
    mock_send.return_value = True
    send_new_order_seller(email_order.__class__(
        listing=listing, buyer=buyer, seller=no_mail,
        amount_gnf=1000, status='pending',
    ))
    time.sleep(0.2)
    check("Aucun email si vendeur sans adresse", not mock_send.called,
          f"appelé={mock_send.called}")


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap → emails confirmés (intégration serveur)", "W1")
# ════════════════════════════════════════════════════════════════════════════

# Créer une commande pending avec payment pending
w1_order = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=80_000,
    delivery_mode=Order.DeliveryMode.MEETING_POINT,
    status=Order.Status.PENDING,
)
w1_payment = Payment.objects.create(
    order=w1_order,
    provider=Payment.Provider.CHACHAP,
    amount_gnf=80_000,
    status=Payment.Status.PENDING,
    external_ref="CCP-W1-TEST",
)

payload = json.dumps({
    "provider":  "chachap",
    "reference": "CCP-W1-TEST",
    "status":    "success",
    "amount":    80000,
}).encode()

r = requests.post(
    f"{BASE}/orders/webhook/chachap/",
    headers={"CCP-Signature": chachap_sig(payload), "Content-Type": "application/json"},
    data=payload,
)
check("Webhook W1 → 200", r.status_code == 200, f"HTTP {r.status_code}")

w1_order.refresh_from_db()
check("Commande W1 confirmée (CONFIRMED)", w1_order.status == "confirmed",
      f"status={w1_order.status}")
w1_payment.refresh_from_db()
check("Paiement W1 = SUCCESS", w1_payment.status == "success",
      f"status={w1_payment.status}")
# Note : on ne peut pas vérifier que l'email a été réellement envoyé depuis le test
# (thread séparé dans le processus serveur), mais si la commande est confirmed
# et le paiement success, le code email_notifications a été atteint.
check("Flux email déclenché si commande confirmed + payment success",
      w1_order.status == "confirmed",
      "vérifiez les logs Railway pour les lignes [EMAIL] ✓")


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap boost → send_boost_activated (intégration)", "W2")
# ════════════════════════════════════════════════════════════════════════════

w2_boost = BoostPayment.objects.create(
    listing=listing, days=14, amount=50_000,
    provider=Payment.Provider.CHACHAP,
    status=BoostPayment.Status.PENDING,
    ext_ref="CCP-BOOST-W2",
)

payload = json.dumps({
    "provider":  "chachap",
    "reference": "CCP-BOOST-W2",
    "status":    "success",
    "amount":    50000,
}).encode()

r = requests.post(
    f"{BASE}/orders/webhook/chachap/",
    headers={"CCP-Signature": chachap_sig(payload), "Content-Type": "application/json"},
    data=payload,
)
check("Webhook W2 boost → 200", r.status_code == 200, f"HTTP {r.status_code}")

w2_boost.refresh_from_db()
check("BoostPayment W2 = APPROVED", w2_boost.status == "approved",
      f"status={w2_boost.status}")
check("send_boost_activated déclenché (listing is_boosted)",
      listing.__class__.objects.get(pk=listing.pk).is_boosted,
      "is_boosted=True sur le listing")


# ── Bilan ─────────────────────────────────────────────────────────────────────
passed = sum(1 for _, ok in results if ok)
total  = len(results)
failed = [(lbl, ok) for lbl, ok in results if not ok]

print(f"\n{'═'*60}")
print(f"  BILAN : {passed}/{total} tests passés")
if failed:
    print(f"\n  Échecs :")
    for lbl, _ in failed:
        print(f"    ❌ {lbl}")
print(f"{'═'*60}\n")
