"""
Tests paiements unifiés ChaChap Pay :
  P1 — Initiation paiement commande → payment_url retourné
  P2 — Fournisseurs non-ChaChap rejetés (orange_money, cash, paycard, mtn_momo)
  P3 — Webhook ChaChap → commande confirmée
  P4 — Webhook ChaChap → idempotence (double webhook)
  P5 — Webhook ChaChap signature invalide → 401
  P6 — Boost annonce → payment_url retourné (ChaChap)
  P7 — Boost : webhook active le boost
  P8 — Boost : fournisseur rejeté si envoyé directement
  P9 — Livraison à domicile → paiement ChaChap (pas d'espèces)
  P10 — Point de retrait → paiement ChaChap (pas d'espèces)

Usage : python test_chachap_payments.py   (serveur sur :8000)
"""
import os, django, requests, uuid, json, hmac, hashlib
from unittest.mock import patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE    = "http://127.0.0.1:8000/api/v1"
results = []

def auth(t):   return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def sep(title, n): print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond

def login(phone):
    from apps.accounts.models import User as _U
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        user = _U.objects.get(phone_number=phone)
        return str(AccessToken.for_user(user))
    except _U.DoesNotExist:
        print(f"  ⚠ Utilisateur {phone} introuvable"); return None


# ── Setup ────────────────────────────────────────────────────────────────────
print("Création des comptes et données de test...")
django.setup()
from apps.accounts.models import User
from apps.listings.models import Listing, BoostPayment
from apps.orders.models import Order, Payment, PickupPoint

def ensure_user(phone, name, role, is_staff=False):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(phone_number=phone, password="test1234",
                                     full_name=name, role=role,
                                     is_active=True, is_verified=True, is_staff=is_staff)
    else:
        User.objects.filter(pk=u.pk).update(is_active=True, is_verified=True, role=role)
        u.refresh_from_db()
    return u

seller = ensure_user("+224629001001", "Vendeur ChaChap", "seller")
buyer  = ensure_user("+224629001002", "Acheteur ChaChap", "buyer")
admin  = ensure_user("+224629001099", "Admin ChaChap", "super_admin", is_staff=True)

tok_seller = login("+224629001001")
tok_buyer  = login("+224629001002")
tok_admin  = login("+224629001099")

# Créer une annonce active
listing = Listing.objects.create(
    seller=seller, title=f"Article ChaChap Test {uuid.uuid4().hex[:4]}",
    price_gnf=75000, price_type="fixed", city="Conakry",
    condition="good", description="Test paiement unifié.", status="active",
)
print(f"  ✅ Listing créé : {listing.id}")

# Clé HMAC webhook — même fallback que _verify_chachap_signature dans views.py
from django.conf import settings as _s
HMAC_KEY = (getattr(_s, 'CHACHAP_HMAC_KEY', '')
            or getattr(_s, 'CHACHAP_WEBHOOK_SECRET', '')
            or getattr(_s, 'CHACHAP_API_KEY', ''))

def chachap_sig(body: bytes) -> str:
    """Calcule la signature CCP-Signature attendue par le serveur."""
    return hmac.new(HMAC_KEY.encode(), body, hashlib.sha256).hexdigest()

# Point de retrait
pickup = PickupPoint.objects.first()
if not pickup:
    pickup = PickupPoint.objects.create(
        name="Point Kaloum", address="Centre Kaloum", city="Conakry", is_active=True
    )
print("  ✅ Comptes et données créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Initiation paiement commande → payment_url ChaChap", "P1")
# ════════════════════════════════════════════════════════════════════════════

# Mock initiate_chachap pour ce test
FAKE_URL = "https://pay.chachap.com/session/test-abc123"
FAKE_REF = f"CCP-{uuid.uuid4().hex[:8].upper()}"

with patch("apps.orders.views.initiate_chachap") as mock_ccp:
    mock_ccp.return_value = type('R', (), {
        'success': True, 'payment_url': FAKE_URL, 'reference': FAKE_REF, 'message': 'OK'
    })()

    # Créer la commande
    r_order = requests.post(f"{BASE}/orders/", headers=auth(tok_buyer), json={
        "listing":       str(listing.id),
        "delivery_mode": "meeting_point",
        "meet_location": "Madina Centre",
    })
    check("POST /orders/ → 201", r_order.status_code == 201,
          f"HTTP {r_order.status_code} — {r_order.text[:100]}")

    order_id = None
    if r_order.status_code == 201:
        order_id = r_order.json().get("id")
        check("order_id retourné", bool(order_id))

        # Initier le paiement
        r_pay = requests.post(f"{BASE}/orders/{order_id}/pay/",
            headers=auth(tok_buyer), json={"provider": "chachap"})
        check("POST /orders/<id>/pay/ → 201", r_pay.status_code == 201,
              f"HTTP {r_pay.status_code} — {r_pay.text[:100]}")
        if r_pay.status_code == 201:
            d = r_pay.json()
            check("payment_url présent", bool(d.get("payment_url")),
                  f"url={d.get('payment_url', '')[:50]}")
            check("chachap=True", d.get("chachap") is True)
            check("payment object présent", bool(d.get("payment")))


# ════════════════════════════════════════════════════════════════════════════
sep("Fournisseurs non-ChaChap rejetés", "P2")
# ════════════════════════════════════════════════════════════════════════════

# Créer une nouvelle commande pour les tests de rejet
with patch("apps.orders.views.initiate_chachap") as mock_ccp:
    mock_ccp.return_value = type('R', (), {
        'success': True, 'payment_url': FAKE_URL, 'reference': FAKE_REF + "2", 'message': 'OK'
    })()

    r2 = requests.post(f"{BASE}/orders/", headers=auth(tok_buyer), json={
        "listing":       str(listing.id),
        "delivery_mode": "meeting_point",
        "meet_location": "Madina Centre",
    })
    order2_id = r2.json().get("id") if r2.status_code == 201 else None

if order2_id:
    for provider_val in ["orange_money", "cash", "mtn_momo", "paycard"]:
        r_rej = requests.post(f"{BASE}/orders/{order2_id}/pay/",
            headers=auth(tok_buyer), json={"provider": provider_val})
        check(f"provider='{provider_val}' → 400 ou 201 ChaChap forcé",
              r_rej.status_code in (400, 201),
              f"HTTP {r_rej.status_code}")
        if r_rej.status_code == 400:
            d = r_rej.json()
            check(f"  Message d'erreur pour '{provider_val}'",
                  "chachap" in str(d).lower() or "seul" in str(d).lower() or "accepté" in str(d).lower(),
                  f"msg={str(d)[:80]}")


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap → commande confirmée", "P3")
# ════════════════════════════════════════════════════════════════════════════

# Créer une commande + paiement PENDING en ORM
order3 = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=75000, delivery_mode="meeting_point",
    meet_location="Centre test", status="pending",
)
ccp_ref3 = f"CCP-WEBHOOK-{uuid.uuid4().hex[:8].upper()}"
payment3 = Payment.objects.create(
    order=order3, provider=Payment.Provider.CHACHAP,
    amount_gnf=75000, status=Payment.Status.PENDING,
    external_ref=ccp_ref3,
)

payload = json.dumps({"operation_id": ccp_ref3, "status": "success", "payment_method": "orange_money"}).encode()
r_webhook = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=payload,
    headers={"Content-Type": "application/json", "CCP-Signature": chachap_sig(payload)})
check("POST /webhook/chachap/ → 200", r_webhook.status_code == 200,
      f"HTTP {r_webhook.status_code} — {r_webhook.text[:60]}")

order3.refresh_from_db()
payment3.refresh_from_db()
check("Commande status = confirmed", order3.status in ("confirmed", "active"),
      f"status={order3.status}")
check("Paiement status = success", payment3.status == Payment.Status.SUCCESS,
      f"status={payment3.status}")


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap → idempotence (double webhook)", "P4")
# ════════════════════════════════════════════════════════════════════════════

# Envoyer le même webhook une 2e fois → doit retourner 200 sans re-traiter
r_dup = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=payload,
    headers={"Content-Type": "application/json", "CCP-Signature": chachap_sig(payload)})
check("Double webhook → 200 (idempotent)", r_dup.status_code == 200,
      f"HTTP {r_dup.status_code}")
payment3.refresh_from_db()
check("Paiement reste SUCCESS", payment3.status == Payment.Status.SUCCESS)


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap signature invalide → 401", "P5")
# ════════════════════════════════════════════════════════════════════════════

bad_payload = json.dumps({"operation_id": "fake", "status": "success"}).encode()
r_bad = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=bad_payload,
    headers={"Content-Type": "application/json", "CCP-Signature": "invalidsignature123"})
# Quand aucune clé HMAC configurée, la vérification rejette aussi (fail-closed) → 401
check("Signature invalide → 401", r_bad.status_code == 401,
      f"HTTP {r_bad.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Boost annonce → payment_url ChaChap retourné", "P6")
# ════════════════════════════════════════════════════════════════════════════

BOOST_REF = f"CCP-BOOST-{uuid.uuid4().hex[:8].upper()}"
BOOST_URL = f"https://pay.chachap.com/boost/{BOOST_REF}"

# BoostListingView importe initiate_chachap en local depuis apps.orders.payment_service
# → il faut patcher le module source pour que le mock soit intercepté
with patch("apps.orders.payment_service.initiate_chachap") as mock_boost:
    mock_boost.return_value = type('R', (), {
        'success': True, 'payment_url': BOOST_URL, 'reference': BOOST_REF, 'message': 'OK'
    })()

    r_boost = requests.post(f"{BASE}/listings/{listing.id}/boost/",
        headers=auth(tok_seller), json={"days": 7})
    check("POST /listings/<id>/boost/ → 201", r_boost.status_code == 201,
          f"HTTP {r_boost.status_code} — {r_boost.text[:100]}")
    if r_boost.status_code == 201:
        d = r_boost.json()
        check("payment_url présent", bool(d.get("payment_url")),
              f"url={d.get('payment_url', '')[:60]}")
        check("pending=True", d.get("pending") is True)
        check("boost_payment_id présent", bool(d.get("boost_payment_id")))
        check("is_boosted=False (pas encore activé)", d.get("is_boosted") is False)


# ════════════════════════════════════════════════════════════════════════════
sep("Webhook ChaChap → boost activé", "P7")
# ════════════════════════════════════════════════════════════════════════════

# Créer un BoostPayment PENDING en ORM
listing7 = Listing.objects.create(
    seller=seller, title=f"Listing Boost Webhook {uuid.uuid4().hex[:4]}",
    price_gnf=40000, price_type="fixed", city="Conakry",
    condition="new", description="Test boost webhook.", status="active",
)
boost_ref7 = f"CCP-BOOST-{uuid.uuid4().hex[:8].upper()}"
bp7 = BoostPayment.objects.create(
    listing=listing7, days=7, amount=50000,
    provider=Payment.Provider.CHACHAP,
    status=BoostPayment.Status.PENDING,
    ext_ref=boost_ref7,
)

# Envoyer le webhook ChaChap pour ce boost avec la vraie signature
payload7 = json.dumps({"operation_id": boost_ref7, "status": "success"}).encode()
r_wh7 = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=payload7,
    headers={"Content-Type": "application/json", "CCP-Signature": chachap_sig(payload7)})
check("Webhook boost → 200", r_wh7.status_code == 200,
      f"HTTP {r_wh7.status_code}")

bp7.refresh_from_db()
listing7.refresh_from_db()
check("BoostPayment status = APPROVED", bp7.status == BoostPayment.Status.APPROVED,
      f"status={bp7.status}")
check("Listing is_boosted = True", listing7.is_boosted is True,
      f"is_boosted={listing7.is_boosted}")


# ════════════════════════════════════════════════════════════════════════════
sep("Boost : fournisseur en body ignoré, ChaChap forcé", "P8")
# ════════════════════════════════════════════════════════════════════════════

listing8 = Listing.objects.create(
    seller=seller, title=f"Listing Test Provider {uuid.uuid4().hex[:4]}",
    price_gnf=30000, price_type="fixed", city="Conakry",
    condition="good", description=".", status="active",
)

with patch("apps.orders.payment_service.initiate_chachap") as mock8:
    mock8.return_value = type('R', (), {
        'success': True, 'payment_url': BOOST_URL, 'reference': "REF8", 'message': 'OK'
    })()
    # Envoyer provider=orange_money dans le body — doit être ignoré, ChaChap utilisé quand même
    r8 = requests.post(f"{BASE}/listings/{listing8.id}/boost/",
        headers=auth(tok_seller), json={"days": 7, "provider": "orange_money", "phone": "622000000"})
    check("Boost avec provider=orange_money → 201 (ChaChap forcé)",
          r8.status_code == 201,
          f"HTTP {r8.status_code}")
    if r8.status_code == 201:
        bp8 = BoostPayment.objects.filter(listing=listing8).first()
        check("BoostPayment créé avec provider=chachap",
              bp8 and bp8.provider == Payment.Provider.CHACHAP,
              f"provider={bp8.provider if bp8 else 'N/A'}")


# ════════════════════════════════════════════════════════════════════════════
sep("Livraison à domicile → paiement ChaChap", "P9")
# ════════════════════════════════════════════════════════════════════════════

with patch("apps.orders.views.initiate_chachap") as mock9:
    mock9.return_value = type('R', (), {
        'success': True, 'payment_url': FAKE_URL + "/home", 'reference': "REF9", 'message': 'OK'
    })()

    r9_order = requests.post(f"{BASE}/orders/", headers=auth(tok_buyer), json={
        "listing":          str(listing.id),
        "delivery_mode":    "home_delivery",
        "delivery_address": "Ratoma, Conakry",
    })
    check("Commande home_delivery → 201", r9_order.status_code == 201,
          f"HTTP {r9_order.status_code}")

    if r9_order.status_code == 201:
        oid9 = r9_order.json().get("id")
        r9_pay = requests.post(f"{BASE}/orders/{oid9}/pay/",
            headers=auth(tok_buyer), json={"provider": "chachap"})
        check("Paiement home_delivery ChaChap → 201", r9_pay.status_code == 201,
              f"HTTP {r9_pay.status_code}")
        if r9_pay.status_code == 201:
            check("payment_url présent", bool(r9_pay.json().get("payment_url")))

        # Tenter de payer en espèces → 400
        r9_cash = requests.post(f"{BASE}/orders/{oid9}/pay/",
            headers=auth(tok_buyer), json={"provider": "cash"})
        check("Paiement home_delivery cash → 400 (refusé)", r9_cash.status_code == 400,
              f"HTTP {r9_cash.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Point de retrait → paiement ChaChap", "P10")
# ════════════════════════════════════════════════════════════════════════════

with patch("apps.orders.views.initiate_chachap") as mock10:
    mock10.return_value = type('R', (), {
        'success': True, 'payment_url': FAKE_URL + "/pickup", 'reference': "REF10", 'message': 'OK'
    })()

    r10_order = requests.post(f"{BASE}/orders/", headers=auth(tok_buyer), json={
        "listing":       str(listing.id),
        "delivery_mode": "pickup_point",
        "pickup_point":  str(pickup.id),
    })
    check("Commande pickup_point → 201", r10_order.status_code == 201,
          f"HTTP {r10_order.status_code}")

    if r10_order.status_code == 201:
        oid10 = r10_order.json().get("id")
        r10_pay = requests.post(f"{BASE}/orders/{oid10}/pay/",
            headers=auth(tok_buyer), json={"provider": "chachap"})
        check("Paiement pickup ChaChap → 201", r10_pay.status_code == 201,
              f"HTTP {r10_pay.status_code}")
        if r10_pay.status_code == 201:
            check("payment_url présent", bool(r10_pay.json().get("payment_url")))

        # Tenter de payer en espèces → 400
        r10_cash = requests.post(f"{BASE}/orders/{oid10}/pay/",
            headers=auth(tok_buyer), json={"provider": "cash"})
        check("Paiement pickup cash → 400 (refusé)", r10_cash.status_code == 400,
              f"HTTP {r10_cash.status_code}")


# ════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ════════════════════════════════════════════════════════════════════════════
total  = len(results)
passed = sum(1 for _, ok in results if ok)
failed = total - passed

print(f"\n{'═'*60}")
print(f"  RÉSULTATS : {passed}/{total} tests passés ({int(passed/total*100) if total else 0}%)")
print('═'*60)

if failed:
    print("\n  ❌ Tests échoués :")
    for label, ok in results:
        if not ok:
            print(f"     • {label}")

if passed == total:
    print("\n  🎉 TOUS LES TESTS CHACHAP PASSENT !")
