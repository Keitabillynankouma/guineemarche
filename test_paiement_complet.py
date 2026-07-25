"""
Test complet du paiement ChaChap Pay — à lancer pendant que runserver tourne.
Usage : python test_paiement_complet.py
"""
import requests
import json
import hmac
import hashlib
import django
import os
import sys

BASE = "http://127.0.0.1:8000/api/v1"

# ── 1. Setup Django pour manipuler la DB directement ─────────────────────────
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("SECRET_KEY", "dev-secret-key-guimatrix-local-2024-xK9mP2nQ")

# ── Clés ChaChap Pay TEST ─────────────────────────────────────────────────────
CHACHAP_HMAC_KEY = "b13d1d1826ba0c16311207d58eec6735"
CHACHAP_API_KEY  = "ebae0e063b0108451c4dfae798bba742411de12ff302b9391705d0dbfd9bea92"

def login(phone, password):
    r = requests.post(f"{BASE}/accounts/login/",
        json={"phone_number": phone, "password": password})
    if r.status_code == 200:
        return r.json()["tokens"]["access"]
    print(f"  ❌ Login échoué ({phone}): {r.text}")
    return None

def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def sep(title):
    print(f"\n{'─'*55}\n  {title}\n{'─'*55}")


# ═══════════════════════════════════════════════════════
sep("ÉTAPE 1 — Login acheteur (admin)")
buyer_token = login("+224620000000", "test1234")
if not buyer_token:
    sys.exit(1)
print(f"  ✅ Token acheteur obtenu")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 2 — Login vendeur")
vendor_token = login("+224620000001", "test1234")
if not vendor_token:
    sys.exit(1)
print(f"  ✅ Token vendeur obtenu")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 3 — Créer une annonce (vendeur)")
r = requests.post(f"{BASE}/listings/",
    headers=auth(vendor_token),
    json={
        "title":       "Test ChaChap Pay - iPhone 12",
        "price_gnf":   500000,
        "price_type":  "fixed",
        "city":        "Conakry",
        "condition":   "new",
        "description": "Annonce de test pour valider le paiement ChaChap Pay",
    }
)
if r.status_code not in (200, 201):
    print(f"  ❌ Création annonce échouée: {r.text}")
    sys.exit(1)

listing = r.json()
listing_id = listing.get("id") or listing.get("listing", {}).get("id")
print(f"  ✅ Annonce créée — ID: {listing_id}")
print(f"     Statut: {listing.get('status', '?')}")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 4 — Forcer le statut ACTIVE (bypass modération locale)")
django.setup()
from apps.listings.models import Listing
try:
    lst = Listing.objects.get(pk=listing_id)
    lst.status = Listing.Status.ACTIVE
    lst.save(update_fields=["status"])
    print(f"  ✅ Annonce mise en ACTIVE")
except Exception as e:
    print(f"  ❌ Erreur activation annonce: {e}")
    sys.exit(1)

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 5 — Créer une commande (acheteur)")
r = requests.post(f"{BASE}/orders/",
    headers=auth(buyer_token),
    json={
        "listing":       listing_id,
        "delivery_mode": "meeting_point",
        "meet_location": "Kaloum centre - devant la mairie",
    }
)
if r.status_code not in (200, 201):
    print(f"  ❌ Création commande échouée: {r.text}")
    sys.exit(1)

order = r.json()
order_id = order.get("id")
print(f"  ✅ Commande créée — ID: {order_id}")
print(f"     Montant: {order.get('amount_gnf', 0):,} GNF")
print(f"     Statut:  {order.get('status', '?')}")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 6 — Initier le paiement ChaChap Pay (vraie clé API test)")
r = requests.post(f"{BASE}/orders/{order_id}/pay/",
    headers=auth(buyer_token),
    json={"provider": "chachap", "phone_number": "+224620000000"}
)
pay_data = r.json()
print(f"  HTTP {r.status_code}")
print(f"  Réponse: {json.dumps(pay_data, indent=2, ensure_ascii=False)}")

payment_url = pay_data.get("payment_url", "")
external_ref = pay_data.get("external_ref", "")

if r.status_code in (200, 201) and payment_url:
    print(f"\n  🎉 SUCCÈS — URL de paiement ChaChap:")
    print(f"  👉 {payment_url}")
    print(f"\n  Ouvre cette URL dans ton navigateur pour payer en mode test.")
    print(f"  external_ref (operation_id): {external_ref}")
elif r.status_code in (200, 201):
    print(f"\n  ✅ Paiement initié (simulation locale) — external_ref: {external_ref}")
else:
    print(f"\n  ⚠️  Échec paiement — HTTP {r.status_code}")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 7 — Simuler confirmation webhook ChaChap")
input("\n  Appuie sur ENTRÉE pour simuler la confirmation du paiement...\n  (ou paye via l'URL ci-dessus si disponible)\n")

# Quand external_ref est vide (API ChaChap inaccessible localement),
# la simulation stocke l'order_id comme external_ref.
# On envoie donc order_id → le webhook trouve le paiement via order__id=ref.
op_id = external_ref or order_id
payload = json.dumps({
    "operation_id":   op_id,
    "status":         "SUCCESS",
    "amount":         500000,
    "currency":       "GNF",
    "payment_method": "orange_money",
    "phone":          "+224620000000",
}, separators=(',', ':')).encode()

signature = hmac.new(CHACHAP_HMAC_KEY.encode(), payload, hashlib.sha256).hexdigest()

r = requests.post(
    f"{BASE}/orders/webhook/chachap/",
    data=payload,
    headers={"Content-Type": "application/json", "CCP-Signature": signature}
)
print(f"  HTTP {r.status_code} — {r.text}")

if r.status_code == 200:
    print("  ✅ Webhook accepté")
else:
    print("  ❌ Webhook rejeté")

# ═══════════════════════════════════════════════════════
sep("ÉTAPE 8 — Vérifier le statut final de la commande")
r = requests.get(f"{BASE}/orders/{order_id}/", headers=auth(buyer_token))
order_final = r.json()
print(f"  Statut commande : {order_final.get('status', '?')}")
print(f"  Escrow status  : {order_final.get('escrow_status', '?')}")
print(f"  Escrow libéré  : {order_final.get('escrow_release_at', '?')}")
payments = order_final.get("payments", [])
if payments:
    p = payments[-1]
    print(f"  Paiement       : {p.get('provider')} — {p.get('status')} — ref: {p.get('external_ref', '')}")

expected_status = "confirmed"
if order_final.get("status") == expected_status:
    print(f"\n  🎉 TEST RÉUSSI — commande confirmée, escrow actif !")
else:
    print(f"\n  ⚠️  Statut inattendu: {order_final.get('status')} (attendu: {expected_status})")
    print(f"  Détails: {json.dumps(order_final, indent=2, ensure_ascii=False)[:500]}")
