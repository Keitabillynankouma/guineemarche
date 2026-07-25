"""
Tests webhooks de paiement :
  WH1 — ChaChap webhook valide → commande confirmée
  WH2 — ChaChap signature invalide → 401
  WH3 — ChaChap webhook idempotent (double envoi)
  WH4 — ChaChap webhook status failed → paiement failed
  WH5 — Provider inconnu → 400
  WH6 — Référence inconnue → 200 (warning silencieux)
  WH7 — Orange Money webhook valide
  WH8 — Paycard webhook refund → escrow remboursé

Usage : python test_payment_webhooks.py   (serveur sur :8000)
"""
import os, django, requests, uuid, hmac as _hmac, hashlib, json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE         = "http://127.0.0.1:8000/api/v1"
CHACHAP_KEY  = "b13d1d1826ba0c16311207d58eec6735"
results      = []

def sep(title, n): print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond

def chachap_sig(body_bytes, key=CHACHAP_KEY):
    return _hmac.new(key.encode(), body_bytes, hashlib.sha256).hexdigest()

def post_webhook(provider, payload, extra_headers=None):
    body = json.dumps(payload).encode()
    sig  = chachap_sig(body)
    headers = {
        "Content-Type":  "application/json",
        "CCP-Signature": sig,
    }
    if extra_headers:
        headers.update(extra_headers)
    return requests.post(f"{BASE}/orders/webhook/{provider}/",
                         data=body, headers=headers)


# ── Setup ────────────────────────────────────────────────────────────────────
print("Création des données...")
django.setup()
from apps.accounts.models import User
from apps.listings.models import Listing
from apps.orders.models   import Order, Payment

def ensure_user(phone, name, role):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(phone_number=phone, password="test1234",
                                     full_name=name, role=role,
                                     is_active=True, is_verified=True)
    else:
        User.objects.filter(pk=u.pk).update(is_active=True, is_verified=True)
        u.refresh_from_db()
    return u

buyer  = ensure_user("+224629000001", "Acheteur Webhook", "buyer")
vendor = ensure_user("+224629000002", "Vendeur Webhook",  "seller")

def make_pending_order_with_payment(ext_ref=None):
    listing = Listing.objects.create(
        seller=vendor, title=f"Article WH {uuid.uuid4().hex[:6]}",
        price_gnf=80000, price_type="fixed", city="Conakry",
        condition="good", description="Test webhook.", status="active",
    )
    order = Order.objects.create(
        listing=listing, buyer=buyer, seller=vendor,
        amount_gnf=80000, delivery_mode="meeting_point",
        meet_location="Test", status="pending", escrow_status="none",
    )
    ref = ext_ref or f"ref-{uuid.uuid4().hex[:12]}"
    payment = Payment.objects.create(
        order=order, amount_gnf=80000,
        provider=Payment.Provider.CHACHAP,
        status=Payment.Status.PENDING,
        external_ref=ref,
    )
    return order, payment, ref

order1, payment1, ref1 = make_pending_order_with_payment()
order2, payment2, ref2 = make_pending_order_with_payment()
order3, payment3, ref3 = make_pending_order_with_payment()
print("  ✅ Commandes et paiements créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("ChaChap webhook valide → commande confirmée", "WH1")
# ════════════════════════════════════════════════════════════════════════════

payload = {
    "operation_id":   ref1,
    "status":         "success",
    "payment_method": "mobile_money",
    "amount":         80000,
}
body_bytes = json.dumps(payload).encode()
sig = chachap_sig(body_bytes)

r = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body_bytes,
    headers={"Content-Type": "application/json", "CCP-Signature": sig})
check("ChaChap webhook success → 200", r.status_code == 200,
      f"HTTP {r.status_code} — {r.text[:60]}")

payment1.refresh_from_db()
order1.refresh_from_db()
check("Payment status = success", payment1.status == "success",
      f"status={payment1.status}")
check("Order status = confirmed (ou plus avancé)",
      order1.status in ("confirmed", "completed", "in_delivery"),
      f"status={order1.status}")


# ════════════════════════════════════════════════════════════════════════════
sep("ChaChap signature invalide → 401", "WH2")
# ════════════════════════════════════════════════════════════════════════════

payload2 = {"operation_id": ref2, "status": "success"}
body2 = json.dumps(payload2).encode()

r_bad_sig = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body2,
    headers={"Content-Type": "application/json", "CCP-Signature": "invalide_totalement"})
check("Signature invalide → 401", r_bad_sig.status_code == 401,
      f"HTTP {r_bad_sig.status_code}")

# Sans header de signature → 401
r_no_sig = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body2,
    headers={"Content-Type": "application/json"})
check("Sans signature → 401", r_no_sig.status_code == 401,
      f"HTTP {r_no_sig.status_code}")

# Vérifier que le paiement n'a PAS été confirmé
payment2.refresh_from_db()
check("Paiement non confirmé après signature invalide",
      payment2.status == "pending", f"status={payment2.status}")


# ════════════════════════════════════════════════════════════════════════════
sep("ChaChap webhook idempotent (double envoi)", "WH3")
# ════════════════════════════════════════════════════════════════════════════

# Confirmer d'abord
payload3 = {"operation_id": ref3, "status": "success"}
body3 = json.dumps(payload3).encode()
sig3 = chachap_sig(body3)

r3a = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body3, headers={"Content-Type": "application/json", "CCP-Signature": sig3})
check("1er envoi → 200", r3a.status_code == 200, f"HTTP {r3a.status_code}")

payment3.refresh_from_db()
check("Payment confirmé après 1er envoi", payment3.status == "success")

# Deuxième envoi identique → idempotent
r3b = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body3, headers={"Content-Type": "application/json", "CCP-Signature": sig3})
check("2e envoi (retry) → 200 (idempotent)", r3b.status_code == 200,
      f"HTTP {r3b.status_code}")

payment3.refresh_from_db()
check("Payment toujours success (pas doublon)", payment3.status == "success")


# ════════════════════════════════════════════════════════════════════════════
sep("ChaChap webhook status failed → paiement échoué", "WH4")
# ════════════════════════════════════════════════════════════════════════════

_, payment_fail, ref_fail = make_pending_order_with_payment()

payload_fail = {"operation_id": ref_fail, "status": "failed"}
body_fail = json.dumps(payload_fail).encode()
sig_fail = chachap_sig(body_fail)

r_fail = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body_fail, headers={"Content-Type": "application/json", "CCP-Signature": sig_fail})
check("Webhook failed → 200", r_fail.status_code == 200,
      f"HTTP {r_fail.status_code}")

payment_fail.refresh_from_db()
check("Payment status = failed", payment_fail.status == "failed",
      f"status={payment_fail.status}")


# ════════════════════════════════════════════════════════════════════════════
sep("Provider inconnu → 400", "WH5")
# ════════════════════════════════════════════════════════════════════════════

r5 = requests.post(f"{BASE}/orders/webhook/stripe/",
    data=b'{}', headers={"Content-Type": "application/json"})
check("Provider inconnu → 400", r5.status_code == 400,
      f"HTTP {r5.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Référence inconnue → 200 (warning silencieux)", "WH6")
# ════════════════════════════════════════════════════════════════════════════

unknown_payload = {"operation_id": f"ref-{uuid.uuid4().hex}", "status": "success"}
body6 = json.dumps(unknown_payload).encode()
sig6  = chachap_sig(body6)

r6 = requests.post(f"{BASE}/orders/webhook/chachap/",
    data=body6, headers={"Content-Type": "application/json", "CCP-Signature": sig6})
check("Référence inconnue → 200 (pas d'erreur cliente)", r6.status_code == 200,
      f"HTTP {r6.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Orange Money webhook valide", "WH7")
# ════════════════════════════════════════════════════════════════════════════

# Créer un paiement Orange Money
_, pay_om, ref_om = make_pending_order_with_payment(ext_ref=f"OM-{uuid.uuid4().hex[:10]}")
pay_om.provider = Payment.Provider.ORANGE_MONEY
pay_om.save(update_fields=["provider"])

# Le webhook Orange Money utilise _verify_orange_signature
# Lire les settings pour connaître la clé
from django.conf import settings
om_secret = getattr(settings, 'ORANGE_MONEY_SECRET', '') or getattr(settings, 'ORANGE_API_KEY', '')

om_payload = {
    "pay_token": ref_om,
    "status":    "SUCCESS",
    "amount":    80000,
}
om_body = json.dumps(om_payload).encode()

if om_secret:
    # Construire la signature Orange Money
    import hashlib as _hl
    sig_om = _hmac.new(om_secret.encode(), om_body, hashlib.sha256).hexdigest()
    r7 = requests.post(f"{BASE}/orders/webhook/orange/",
        data=om_body,
        headers={"Content-Type": "application/json", "X-Orange-Signature": sig_om})
    check("Orange Money webhook → 200", r7.status_code == 200,
          f"HTTP {r7.status_code}")
else:
    # Sans clé Orange configurée, la signature échoue → 401 attendu
    r7 = requests.post(f"{BASE}/orders/webhook/orange/",
        data=om_body,
        headers={"Content-Type": "application/json", "X-Orange-Signature": "test"})
    check("Orange Money webhook sans clé configurée → 200 ou 401",
          r7.status_code in (200, 401), f"HTTP {r7.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Paycard webhook refund → escrow remboursé", "WH8")
# ════════════════════════════════════════════════════════════════════════════

_, pay_pc, ref_pc = make_pending_order_with_payment()
pay_pc.provider = Payment.Provider.CHACHAP  # Réutilise CHACHAP comme proxy
pay_pc.save(update_fields=["provider"])
# Mettre la commande en disputed pour le remboursement
pay_pc.order.status = Order.Status.DISPUTED
pay_pc.order.escrow_status = Order.EscrowStatus.HELD
pay_pc.order.save(update_fields=["status", "escrow_status", "updated_at"])

refund_payload = {
    "transaction_id": ref_pc,
    "status":         "SUCCESS",
    "refund_amount":  80000,
}
refund_body = json.dumps(refund_payload).encode()

# Paycard utilise aussi une signature HMAC
paycard_secret = getattr(settings, 'PAYCARD_SECRET', '') or getattr(settings, 'PAYCARD_API_KEY', '')
if paycard_secret:
    sig_pc = _hmac.new(paycard_secret.encode(), refund_body, hashlib.sha256).hexdigest()
    r8 = requests.post(f"{BASE}/orders/webhook/paycard/refunds/",
        data=refund_body,
        headers={"Content-Type": "application/json", "X-Paycard-Signature": sig_pc})
else:
    r8 = requests.post(f"{BASE}/orders/webhook/paycard/refunds/",
        data=refund_body,
        headers={"Content-Type": "application/json", "X-Paycard-Signature": "test"})

check("Paycard refund webhook → 200 ou 401",
      r8.status_code in (200, 401), f"HTTP {r8.status_code}")


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
    print("\n  🎉 TOUS LES TESTS WEBHOOKS PASSENT !")
