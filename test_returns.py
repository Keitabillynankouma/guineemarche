"""
Tests retours (return requests) :
  RT1 — Acheteur crée une demande de retour sur commande COMPLETED
  RT2 — Raison invalide → 400
  RT3 — Double demande de retour → 400
  RT4 — Commande non COMPLETED → 400
  RT5 — Non-acheteur → 404
  RT6 — Admin liste les retours
  RT7 — Admin approuve un retour
  RT8 — Admin rejette un retour
  RT9 — Admin filtre par statut

Usage : python test_returns.py   (serveur sur :8000)
"""
import os, django, requests, uuid

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

def make_order(buyer_user, vendor_user, status='completed'):
    from apps.listings.models import Listing
    from apps.orders.models import Order
    listing = Listing.objects.create(
        seller=vendor_user, title=f"Article Retour {uuid.uuid4().hex[:6]}",
        price_gnf=120000, price_type="fixed", city="Conakry",
        condition="good", description="Test retour.", status='active'
    )
    return Order.objects.create(
        listing=listing, buyer=buyer_user, seller=vendor_user,
        amount_gnf=120000, delivery_mode='meeting_point',
        meet_location='Kaloum', status=status, escrow_status='released',
    )


# ── Setup ────────────────────────────────────────────────────────────────────
print("Création des comptes...")
django.setup()
from apps.accounts.models import User

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

buyer  = ensure_user("+224627000001", "Acheteur Retour", "buyer")
vendor = ensure_user("+224627000002", "Vendeur Retour", "seller")
other  = ensure_user("+224627000003", "Autre Retour", "buyer")
admin  = ensure_user("+224627000099", "Admin Retour", "super_admin", is_staff=True)

tok_buyer  = login("+224627000001")
tok_vendor = login("+224627000002")
tok_other  = login("+224627000003")
tok_admin  = login("+224627000099")

order_completed = make_order(buyer, vendor, status='completed')
order_pending   = make_order(buyer, vendor, status='pending')
print("  ✅ Comptes et commandes créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur crée une demande de retour", "RT1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/orders/{order_completed.id}/return/",
    headers=auth(tok_buyer),
    json={"reason": "defective", "description": "L'écran est fissuré à la réception."})
check("POST /orders/{id}/return/ → 201", r.status_code == 201,
      f"HTTP {r.status_code} — {r.text[:100]}")

return_id = None
if r.status_code == 201:
    d = r.json()
    return_id = d.get("id")
    check("id retour retourné", bool(return_id))
    check("reason = defective", d.get("reason") == "defective")
    check("status = pending", d.get("status") == "pending")


# ════════════════════════════════════════════════════════════════════════════
sep("Raison invalide → 400", "RT2")
# ════════════════════════════════════════════════════════════════════════════

order2 = make_order(buyer, vendor, status='completed')
r2 = requests.post(f"{BASE}/orders/{order2.id}/return/",
    headers=auth(tok_buyer),
    json={"reason": "raison_inexistante", "description": "Test."})
check("Raison invalide → 400", r2.status_code == 400,
      f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Double demande de retour → 400", "RT3")
# ════════════════════════════════════════════════════════════════════════════

r3 = requests.post(f"{BASE}/orders/{order_completed.id}/return/",
    headers=auth(tok_buyer),
    json={"reason": "changed_mind", "description": "En fait non."})
check("2e demande de retour sur même commande → 400", r3.status_code == 400,
      f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Commande non COMPLETED → 400", "RT4")
# ════════════════════════════════════════════════════════════════════════════

r4 = requests.post(f"{BASE}/orders/{order_pending.id}/return/",
    headers=auth(tok_buyer),
    json={"reason": "defective", "description": "Commande pas encore terminée."})
check("Retour sur commande PENDING → 400", r4.status_code == 400,
      f"HTTP {r4.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Non-acheteur → 404", "RT5")
# ════════════════════════════════════════════════════════════════════════════

order3 = make_order(buyer, vendor, status='completed')
r5 = requests.post(f"{BASE}/orders/{order3.id}/return/",
    headers=auth(tok_other),
    json={"reason": "wrong_item", "description": "Ce n'est pas ma commande."})
check("Autre utilisateur → retour → 404", r5.status_code == 404,
      f"HTTP {r5.status_code}")

r5b = requests.post(f"{BASE}/orders/{order3.id}/return/",
    headers=auth(tok_vendor),
    json={"reason": "wrong_item", "description": "Je suis le vendeur."})
check("Vendeur → retour sur sa vente → 404", r5b.status_code == 404,
      f"HTTP {r5b.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin liste les retours", "RT6")
# ════════════════════════════════════════════════════════════════════════════

r_list = requests.get(f"{BASE}/orders/admin/returns/", headers=auth(tok_admin))
check("Admin GET /orders/admin/returns/ → 200",
      r_list.status_code == 200, f"HTTP {r_list.status_code}")
if r_list.status_code == 200:
    returns = r_list.json()
    ret_list = returns if isinstance(returns, list) else returns.get("results", [])
    check("Au moins 1 retour dans la liste", len(ret_list) >= 1,
          f"{len(ret_list)} retour(s)")
    if ret_list:
        r_item = ret_list[0]
        check("order_id présent", bool(r_item.get("order_id")))
        check("buyer_name présent", bool(r_item.get("buyer_name")))
        check("status présent", bool(r_item.get("status")))

# Non-admin → 403
r_nonadm = requests.get(f"{BASE}/orders/admin/returns/", headers=auth(tok_buyer))
check("Non-admin → /orders/admin/returns/ → 403", r_nonadm.status_code == 403,
      f"HTTP {r_nonadm.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin approuve un retour", "RT7")
# ════════════════════════════════════════════════════════════════════════════

if return_id:
    r_approve = requests.patch(f"{BASE}/orders/admin/returns/{return_id}/",
        headers=auth(tok_admin),
        json={"status": "approved", "admin_note": "Retour validé, remboursement en cours."})
    check("Admin PATCH retour → approved → 200",
          r_approve.status_code == 200, f"HTTP {r_approve.status_code}")
    if r_approve.status_code == 200:
        d = r_approve.json()
        check("status = approved", d.get("status") == "approved",
              f"status={d.get('status')}")
        check("resolved_at renseigné", bool(d.get("resolved_at")))


# ════════════════════════════════════════════════════════════════════════════
sep("Admin rejette un retour", "RT8")
# ════════════════════════════════════════════════════════════════════════════

r_rej_base = requests.post(f"{BASE}/orders/{order2.id}/return/",
    headers=auth(tok_buyer),
    json={"reason": "not_as_described",
          "description": "La couleur ne correspond pas."})

rej_return_id = r_rej_base.json().get("id") if r_rej_base.status_code == 201 else None

if rej_return_id:
    r_reject = requests.patch(f"{BASE}/orders/admin/returns/{rej_return_id}/",
        headers=auth(tok_admin),
        json={"status": "rejected", "admin_note": "Le produit est conforme à l'annonce."})
    check("Admin rejette retour → 200", r_reject.status_code == 200,
          f"HTTP {r_reject.status_code}")
    if r_reject.status_code == 200:
        check("status = rejected", r_reject.json().get("status") == "rejected")

    # Statut invalide → 400
    r_bad_status = requests.patch(f"{BASE}/orders/admin/returns/{rej_return_id}/",
        headers=auth(tok_admin),
        json={"status": "inexistant"})
    check("Statut invalide → 400", r_bad_status.status_code == 400,
          f"HTTP {r_bad_status.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin filtre par statut", "RT9")
# ════════════════════════════════════════════════════════════════════════════

r_pending = requests.get(f"{BASE}/orders/admin/returns/?status=pending",
    headers=auth(tok_admin))
check("Admin filtre status=pending → 200", r_pending.status_code == 200,
      f"HTTP {r_pending.status_code}")
if r_pending.status_code == 200:
    pend_list = r_pending.json()
    pend_list = pend_list if isinstance(pend_list, list) else pend_list.get("results", [])
    check("Tous les retours filtrés sont pending",
          all(r.get("status") == "pending" for r in pend_list) or len(pend_list) == 0,
          f"{len(pend_list)} retour(s) pending")

r_approved = requests.get(f"{BASE}/orders/admin/returns/?status=approved",
    headers=auth(tok_admin))
check("Admin filtre status=approved → 200", r_approved.status_code == 200,
      f"HTTP {r_approved.status_code}")


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
    print("\n  🎉 TOUS LES TESTS RETOURS PASSENT !")
