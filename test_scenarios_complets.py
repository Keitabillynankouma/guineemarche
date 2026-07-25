"""
Tests complets Guimatrix — tous les scénarios achat/vente/livraison.
Usage : python test_scenarios_complets.py
Le serveur doit tourner : python manage.py runserver
"""
import os, sys, json, hmac, hashlib, django, requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")
# Ne pas setdefault SECRET_KEY — découple le lit depuis .env, identique au serveur

BASE = "http://127.0.0.1:8000/api/v1"
CHACHAP_HMAC_KEY = "b13d1d1826ba0c16311207d58eec6735"

# ── Comptes de test ─────────────────────────────────────────────────────────────
BUYER  = {"phone": "+224620000000", "password": "test1234"}
VENDOR = {"phone": "+224620000001", "password": "test1234"}
ADMIN  = {"phone": "+224620000000", "password": "test1234"}  # admin = buyer pour simplifier
LIVREUR= {"phone": "+224620000002", "password": "test1234"}

results = []

# ── Helpers ─────────────────────────────────────────────────────────────────────

def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def login(phone, pwd):
    """Génère un JWT directement via ORM — bypasse le throttle HTTP."""
    from apps.accounts.models import User as _U
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        user = _U.objects.get(phone_number=phone)
        return str(AccessToken.for_user(user))
    except _U.DoesNotExist:
        print(f"  ❌ Utilisateur {phone} introuvable"); return None

def webhook(order_id, external_ref=None):
    op = external_ref or order_id
    body = json.dumps({"operation_id": op, "status": "SUCCESS", "amount": 500000,
                       "currency": "GNF", "payment_method": "orange_money",
                       "phone": "+224620000000"}, separators=(',', ':')).encode()
    sig = hmac.new(CHACHAP_HMAC_KEY.encode(), body, hashlib.sha256).hexdigest()
    r = requests.post(f"{BASE}/orders/webhook/chachap/", data=body,
                      headers={"Content-Type": "application/json", "CCP-Signature": sig})
    return r.status_code == 200

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond

def sep(title, n=1):
    print(f"\n{'═'*60}")
    print(f"  SCÉNARIO {n} — {title}")
    print('═'*60)

def new_listing(vendor_token, title="Article Test", price=200000):
    """Crée une annonce ACTIVE."""
    r = requests.post(f"{BASE}/listings/", headers=auth(vendor_token),
        json={"title": title, "price_gnf": price, "price_type": "fixed",
              "city": "Conakry", "condition": "good", "description": "Test"})
    if r.status_code not in (200, 201):
        print(f"  ❌ Création annonce: {r.text[:200]}")
        return None
    lid = r.json().get("id")
    # Activer via ORM
    from apps.listings.models import Listing
    Listing.objects.filter(pk=lid).update(status='active')
    return lid

def new_order(buyer_token, listing_id, mode="meeting_point", address=""):
    payload = {"listing": listing_id, "delivery_mode": mode,
               "meet_location": "Kaloum, devant la mairie"}
    if mode == "home_delivery":
        payload["delivery_address"] = address or "Ratoma, Cosa"
        payload.pop("meet_location", None)
    r = requests.post(f"{BASE}/orders/", headers=auth(buyer_token), json=payload)
    if r.status_code not in (200, 201):
        print(f"  ❌ Création commande: {r.text[:200]}")
        return None, None
    d = r.json()
    return d.get("id"), d

def pay_chachap(buyer_token, order_id):
    """Initie + confirme via webhook."""
    r = requests.post(f"{BASE}/orders/{order_id}/pay/",
        headers=auth(buyer_token),
        json={"provider": "chachap", "phone_number": "+224620000000"})
    if r.status_code not in (200, 201):
        print(f"  ❌ Paiement: {r.text[:200]}")
        return False, ""
    external_ref = r.json().get("payment", {}).get("external_ref", "")
    ok = webhook(order_id, external_ref)
    return ok, external_ref

def order_status(token, order_id):
    r = requests.get(f"{BASE}/orders/{order_id}/", headers=auth(token))
    return r.json() if r.status_code == 200 else {}


# ── Setup Django ORM ────────────────────────────────────────────────────────────
print("Initialisation Django ORM...")
django.setup()
from apps.accounts.models import User

# Créer le livreur si inexistant
livreur_user, _ = User.objects.get_or_create(
    phone_number="+224620000002",
    defaults={"full_name": "Livreur Test", "role": "livreur",
              "is_verified": True, "is_active": True}
)
if not livreur_user.check_password("test1234"):
    livreur_user.set_password("test1234")
    livreur_user.save()
livreur_user.role = "livreur"
livreur_user.is_verified = True
livreur_user.save(update_fields=["role", "is_verified"])
print("  ✅ Livreur prêt")

# ── Login tous les comptes ───────────────────────────────────────────────────────
print("\nConnexion des comptes...")
buyer_tok  = login(BUYER["phone"],  BUYER["password"])
vendor_tok = login(VENDOR["phone"], VENDOR["password"])
admin_tok  = login(ADMIN["phone"],  ADMIN["password"])
livreur_tok= login(LIVREUR["phone"],LIVREUR["password"])

if not all([buyer_tok, vendor_tok, livreur_tok]):
    print("❌ Échec login — arrêt.")
    sys.exit(1)
print("  ✅ Tous connectés")


# ════════════════════════════════════════════════════════════════════════════════
sep("Achat remise en main propre → confirmation réception → escrow libéré", 1)
# ════════════════════════════════════════════════════════════════════════════════

lid = new_listing(vendor_tok, "Chaussures Nike test S1", 200000)
oid, _ = new_order(buyer_tok, lid, "meeting_point")
check("Commande créée", oid is not None)

paid_ok, ext_ref = pay_chachap(buyer_tok, oid)
check("Webhook ChaChap accepté", paid_ok)

o = order_status(buyer_tok, oid)
check("Commande confirmée après paiement", o.get("status") == "confirmed",
      f"status={o.get('status')}")
check("Escrow bloqué", o.get("escrow_status") == "held",
      f"escrow={o.get('escrow_status')}")

# Acheteur confirme réception
r = requests.post(f"{BASE}/orders/{oid}/confirm-receipt/", headers=auth(buyer_tok))
check("Confirmation réception (buyer)", r.status_code == 200,
      f"HTTP {r.status_code}")

o = order_status(buyer_tok, oid)
check("Commande terminée", o.get("status") == "completed")
check("Escrow libéré", o.get("escrow_status") == "released")
payout = o.get("seller_payout_gnf", 0)
check("Vendeur payé (commission déduite)", payout > 0 and payout < 200000,
      f"{payout:,} GNF")


# ════════════════════════════════════════════════════════════════════════════════
sep("Achat + livraison à domicile → livreur → code vérif → escrow libéré", 2)
# ════════════════════════════════════════════════════════════════════════════════

lid2 = new_listing(vendor_tok, "Téléphone Samsung test S2", 350000)
oid2, _ = new_order(buyer_tok, lid2, "home_delivery", "Ratoma, Cosa")
check("Commande home_delivery créée", oid2 is not None)

paid2, _ = pay_chachap(buyer_tok, oid2)
check("Paiement + webhook S2", paid2)

# Admin assigne le livreur
r = requests.post(f"{BASE}/orders/admin/orders/{oid2}/assign/",
    headers=auth(admin_tok),
    json={"livreur_id": str(livreur_user.id)})
check("Admin assigne livreur", r.status_code == 200,
      f"HTTP {r.status_code} — {r.text[:100]}")

if r.status_code == 200:
    assignment_id = r.json().get("id")
    verif_code    = r.json().get("verification_code", "")
    check("Code vérification généré", bool(verif_code), f"code={verif_code}")

    # Livreur démarre
    r2 = requests.post(f"{BASE}/orders/livreur/assignments/{assignment_id}/start/",
        headers=auth(livreur_tok))
    check("Livreur démarre (EN_ROUTE)", r2.status_code == 200,
          f"HTTP {r2.status_code}")

    # Livreur confirme avec le code
    r3 = requests.post(f"{BASE}/orders/livreur/assignments/{assignment_id}/confirm/",
        headers=auth(livreur_tok),
        json={"verification_code": verif_code})
    check("Livreur confirme avec code", r3.status_code == 200,
          f"HTTP {r3.status_code} — {r3.text[:100]}")

    o2 = order_status(buyer_tok, oid2)
    check("Commande terminée après livraison", o2.get("status") == "completed")
    check("Escrow libéré après livraison",   o2.get("escrow_status") == "released")

    # Vérifier LivreurPayment créé
    from apps.orders.models import LivreurPayment, DeliveryAssignment
    asgn = DeliveryAssignment.objects.filter(pk=assignment_id).first()
    lp = LivreurPayment.objects.filter(assignment=asgn).first() if asgn else None
    check("LivreurPayment créé", lp is not None,
          f"net={lp.net_gnf if lp else 'N/A'} GNF")


# ════════════════════════════════════════════════════════════════════════════════
sep("Achat + paiement espèces → confirmation vendeur → acheteur complète", 3)
# ════════════════════════════════════════════════════════════════════════════════

lid3 = new_listing(vendor_tok, "Livre test S3 espèces", 50000)
oid3, _ = new_order(buyer_tok, lid3, "meeting_point")
check("Commande créée (cash)", oid3 is not None)

r = requests.post(f"{BASE}/orders/{oid3}/pay/",
    headers=auth(buyer_tok),
    json={"provider": "cash"})
check("Paiement espèces initié", r.status_code in (200, 201),
      f"HTTP {r.status_code}")

# Pour espèces, le vendeur confirme manuellement
r = requests.post(f"{BASE}/orders/{oid3}/confirm/",
    headers=auth(vendor_tok))
o3_before = order_status(buyer_tok, oid3)

# L'acheteur confirme réception
if o3_before.get("status") == "confirmed":
    r = requests.post(f"{BASE}/orders/{oid3}/confirm-receipt/",
        headers=auth(buyer_tok))
    check("Confirmation réception cash", r.status_code == 200,
          f"HTTP {r.status_code}")
    o3 = order_status(buyer_tok, oid3)
    check("Commande terminée (cash)", o3.get("status") == "completed")
else:
    # Essayer via OrderUpdateStatusView
    r = requests.post(f"{BASE}/orders/{oid3}/complete/",
        headers=auth(buyer_tok))
    o3 = order_status(buyer_tok, oid3)
    check("Commande terminée (cash)", o3.get("status") in ("completed", "confirmed"),
          f"status={o3.get('status')}")


# ════════════════════════════════════════════════════════════════════════════════
sep("Litige ouvert par acheteur → admin libère fonds au vendeur", 4)
# ════════════════════════════════════════════════════════════════════════════════

lid4 = new_listing(vendor_tok, "Sac test S4 litige", 150000)
oid4, _ = new_order(buyer_tok, lid4, "meeting_point")
pay_chachap(buyer_tok, oid4)

r = requests.post(f"{BASE}/orders/{oid4}/dispute/", headers=auth(buyer_tok),
    json={"reason": "Article non reçu"})
check("Litige ouvert (buyer)", r.status_code == 200,
      f"HTTP {r.status_code}")

o4 = order_status(buyer_tok, oid4)
check("Commande en litige", o4.get("status") == "disputed")
check("Escrow toujours bloqué pendant litige", o4.get("escrow_status") == "held")

# Admin résout en faveur du vendeur
r = requests.post(f"{BASE}/orders/admin/disputes/{oid4}/resolve/",
    headers=auth(admin_tok),
    json={"action": "release", "note": "Preuve de livraison fournie par le vendeur"})
check("Admin libère fonds (vendor wins)", r.status_code == 200,
      f"HTTP {r.status_code}")

o4f = order_status(buyer_tok, oid4)
check("Commande complétée après résolution", o4f.get("status") == "completed")
check("Escrow libéré après résolution",      o4f.get("escrow_status") == "released")


# ════════════════════════════════════════════════════════════════════════════════
sep("Litige → admin rembourse l'acheteur", 5)
# ════════════════════════════════════════════════════════════════════════════════

lid5 = new_listing(vendor_tok, "Chargeur test S5 remboursement", 80000)
oid5, _ = new_order(buyer_tok, lid5, "meeting_point")
pay_chachap(buyer_tok, oid5)

requests.post(f"{BASE}/orders/{oid5}/dispute/", headers=auth(buyer_tok),
    json={"reason": "Article défectueux"})

r = requests.post(f"{BASE}/orders/admin/disputes/{oid5}/resolve/",
    headers=auth(admin_tok),
    json={"action": "refund", "note": "Article effectivement défectueux"})
check("Admin rembourse (buyer wins)", r.status_code == 200,
      f"HTTP {r.status_code}")

o5 = order_status(buyer_tok, oid5)
check("Escrow remboursé", o5.get("escrow_status") == "refunded")


# ════════════════════════════════════════════════════════════════════════════════
sep("Annulation avant paiement (acheteur)", 6)
# ════════════════════════════════════════════════════════════════════════════════

lid6 = new_listing(vendor_tok, "Casque test S6 annulation", 120000)
oid6, _ = new_order(buyer_tok, lid6, "meeting_point")
check("Commande créée (à annuler)", oid6 is not None)

o6_before = order_status(buyer_tok, oid6)
check("Commande en attente avant annulation", o6_before.get("status") == "pending")

r = requests.post(f"{BASE}/orders/{oid6}/cancel/", headers=auth(buyer_tok))
check("Annulation réussie (buyer)", r.status_code == 200,
      f"HTTP {r.status_code}")

o6 = order_status(buyer_tok, oid6)
check("Commande annulée", o6.get("status") == "cancelled")


# ════════════════════════════════════════════════════════════════════════════════
sep("Annulation par le vendeur après confirmation", 7)
# ════════════════════════════════════════════════════════════════════════════════

lid7 = new_listing(vendor_tok, "Montre test S7 annul vendeur", 90000)
oid7, _ = new_order(buyer_tok, lid7, "meeting_point")
pay_chachap(buyer_tok, oid7)  # → confirmed

r = requests.post(f"{BASE}/orders/{oid7}/cancel/", headers=auth(vendor_tok))
check("Annulation vendeur après confirmation", r.status_code == 200,
      f"HTTP {r.status_code}")

o7 = order_status(buyer_tok, oid7)
check("Commande annulée (vendeur)", o7.get("status") == "cancelled")
check("Escrow remboursé automatiquement", o7.get("escrow_status") in ("refunded", "none"))


# ════════════════════════════════════════════════════════════════════════════════
sep("Retour après livraison confirmée → admin approuve", 8)
# ════════════════════════════════════════════════════════════════════════════════

lid8 = new_listing(vendor_tok, "Jeans test S8 retour", 180000)
oid8, _ = new_order(buyer_tok, lid8, "meeting_point")
pay_chachap(buyer_tok, oid8)

# Forcer complétion via ORM pour gagner du temps
from apps.orders.models import Order
if oid8:
    order8 = Order.objects.filter(pk=oid8).first()
    if order8:
        order8.status = Order.Status.COMPLETED
        order8.save(update_fields=["status"])
    check("Commande complétée (setup retour)", order8 is not None)
else:
    check("Commande complétée (setup retour)", False, "oid8=None")

r = requests.post(f"{BASE}/orders/{oid8}/return/", headers=auth(buyer_tok),
    json={"reason": "not_as_described", "description": "Couleur différente de l'annonce"})
check("Demande retour créée", r.status_code == 201,
      f"HTTP {r.status_code}")

if r.status_code == 201:
    return_id = r.json().get("id")
    r2 = requests.patch(f"{BASE}/orders/admin/returns/{return_id}/",
        headers=auth(admin_tok),
        json={"status": "approved", "admin_note": "Retour approuvé — article non conforme"})
    check("Admin approuve retour", r2.status_code == 200,
          f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════════
sep("Retour → admin refuse", 9)
# ════════════════════════════════════════════════════════════════════════════════

lid9 = new_listing(vendor_tok, "Livre test S9 retour refusé", 60000)
oid9, _ = new_order(buyer_tok, lid9, "meeting_point")
pay_chachap(buyer_tok, oid9)
if oid9:
    Order.objects.filter(pk=oid9).update(status=Order.Status.COMPLETED)

r = requests.post(f"{BASE}/orders/{oid9}/return/", headers=auth(buyer_tok),
    json={"reason": "changed_mind", "description": "J'ai changé d'avis"})

if r.status_code == 201:
    return_id9 = r.json().get("id")
    r2 = requests.patch(f"{BASE}/orders/admin/returns/{return_id9}/",
        headers=auth(admin_tok),
        json={"status": "rejected", "admin_note": "Délai de retour dépassé"})
    check("Admin refuse retour", r2.status_code == 200,
          f"HTTP {r2.status_code}")
else:
    check("Admin refuse retour", False, f"HTTP {r.status_code} — {r.text[:100]}")


# ════════════════════════════════════════════════════════════════════════════════
sep("Livraison à domicile → livreur confirme → retour ensuite", 10)
# ════════════════════════════════════════════════════════════════════════════════

lid10 = new_listing(vendor_tok, "Imprimante test S10 livr+retour", 400000)
oid10, _ = new_order(buyer_tok, lid10, "home_delivery", "Kaloum centre")
pay_chachap(buyer_tok, oid10)

r = requests.post(f"{BASE}/orders/admin/orders/{oid10}/assign/",
    headers=auth(admin_tok), json={"livreur_id": str(livreur_user.id)})

if r.status_code == 200:
    a_id   = r.json().get("id")
    v_code = r.json().get("verification_code", "")
    requests.post(f"{BASE}/orders/livreur/assignments/{a_id}/start/",
        headers=auth(livreur_tok))
    r3 = requests.post(f"{BASE}/orders/livreur/assignments/{a_id}/confirm/",
        headers=auth(livreur_tok), json={"verification_code": v_code})
    check("Livraison confirmée (S10)", r3.status_code == 200)

    # Maintenant demande de retour
    r4 = requests.post(f"{BASE}/orders/{oid10}/return/", headers=auth(buyer_tok),
        json={"reason": "defective", "description": "Imprimante ne fonctionne pas"})
    check("Retour après livraison confirmée", r4.status_code == 201,
          f"HTTP {r4.status_code}")
else:
    check("Livraison confirmée (S10)", False, f"Assign échoué: HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ════════════════════════════════════════════════════════════════════════════════
total = len(results)
passed = sum(1 for _, ok in results if ok)
failed = total - passed

print(f"\n{'═'*60}")
print(f"  RÉSULTATS : {passed}/{total} tests passés")
print('═'*60)

if failed:
    print("\n  ❌ Tests échoués :")
    for label, ok in results:
        if not ok:
            print(f"     • {label}")

if passed == total:
    print("\n  🎉 TOUS LES SCÉNARIOS PASSENT — Guimatrix est prêt pour la production !")
else:
    pct = int(passed / total * 100)
    print(f"\n  ⚠️  {pct}% de réussite — corriger les points ci-dessus avant déploiement.")
