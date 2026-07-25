"""
Tests virements livreurs (weekly payouts) et amendes :
  W1 — Générer les virements de la semaine
  W2 — Lister les virements (admin_accounting)
  W3 — Marquer virements comme payés
  W4 — Filtre par statut
  W5 — Amendes : créer, lister
  W6 — Amendes déductibles du virement net
  W7 — Accès refusé aux non-comptables

Usage : python test_weekly_payouts.py   (serveur sur :8000)
"""
import os, django, requests, uuid
from datetime import date, timedelta

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

livreur       = ensure_user("+224628000001", "Livreur Paie", "livreur")
admin_acct    = ensure_user("+224628000010", "Admin Compta Paie", "admin_accounting", is_staff=True)
super_admin   = ensure_user("+224628000011", "Super Admin Paie", "super_admin", is_staff=True)
admin_livr    = ensure_user("+224628000012", "Admin Livraison Paie", "admin_delivery", is_staff=True)
buyer         = ensure_user("+224628000020", "Acheteur Paie", "buyer")

tok_acct      = login("+224628000010")
tok_super     = login("+224628000011")
tok_livr_adm  = login("+224628000012")
tok_buyer     = login("+224628000020")

# Créer des LivreurPayments via ORM pour avoir des données à agréger
from apps.orders.models import LivreurPayment, LivreurWeeklyPayout, LivreurFine
from apps.listings.models import Listing
from apps.orders.models import Order, DeliveryAssignment

# Créer des paiements livreur simulés
vendor_seed = ensure_user("+224628000030", "Vendeur Seed Paie", "seller")
buyer_seed  = ensure_user("+224628000031", "Acheteur Seed Paie", "buyer")

def make_completed_delivery(livreur_user, amount_delivery=15000):
    listing = Listing.objects.create(
        seller=vendor_seed, title=f"Art Livraison {uuid.uuid4().hex[:4]}",
        price_gnf=50000, price_type="fixed", city="Conakry",
        condition="good", description=".", status="active"
    )
    # delivery_fee_gnf est sur Order, pas sur DeliveryAssignment
    order = Order.objects.create(
        listing=listing, buyer=buyer_seed, seller=vendor_seed,
        amount_gnf=50000 + amount_delivery, delivery_mode="home_delivery",
        delivery_address="Test", status="completed", escrow_status="released",
        delivery_fee_gnf=amount_delivery,
    )
    assignment = DeliveryAssignment.objects.create(
        order=order, livreur=livreur_user,
        status="delivered",
        verification_code=uuid.uuid4().hex[:6],
    )
    LivreurPayment.objects.create(
        livreur=livreur_user, assignment=assignment,
        gross_gnf=amount_delivery, net_gnf=amount_delivery,
        platform_cut_gnf=0, status="pending",
    )
    return order, assignment

# Créer 2 livraisons
make_completed_delivery(livreur, 15000)
make_completed_delivery(livreur, 12000)
print("  ✅ Comptes, livraisons et paiements créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Générer les virements de la semaine", "W1")
# ════════════════════════════════════════════════════════════════════════════

# Supprimer les virements existants pour un test propre
week_start = date.today() - timedelta(days=date.today().weekday())
LivreurWeeklyPayout.objects.filter(week_start=week_start).delete()

r = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/generate/",
    headers=auth(tok_super), json={"week_start": week_start.isoformat()})
check("POST /weekly-payouts/generate/ → 200/201",
      r.status_code in (200, 201), f"HTTP {r.status_code} — {r.text[:100]}")

if r.status_code in (200, 201):
    d = r.json()
    check("Champ 'generated' ou 'count' présent",
          "generated" in d or "count" in d or "created" in d,
          f"keys={list(d.keys())}")

# Non comptable → 403
r_denied = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/generate/",
    headers=auth(tok_livr_adm), json={})
check("admin_delivery → générer virements → 403",
      r_denied.status_code == 403, f"HTTP {r_denied.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Lister les virements", "W2")
# ════════════════════════════════════════════════════════════════════════════

r_list = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/",
    headers=auth(tok_acct))
check("admin_accounting → GET /weekly-payouts/ → 200",
      r_list.status_code == 200, f"HTTP {r_list.status_code}")

payout_ids = []
if r_list.status_code == 200:
    payouts = r_list.json()
    payout_list = payouts if isinstance(payouts, list) else payouts.get("results", [])
    check("Au moins 1 virement généré", len(payout_list) >= 1,
          f"{len(payout_list)} virement(s)")
    if payout_list:
        p = payout_list[0]
        check("livreur présent", bool(p.get("livreur")))
        check("net_gnf présent", "net_gnf" in p)
        check("status présent", bool(p.get("status")))
        payout_ids = [str(x["id"]) for x in payout_list if x.get("status") == "pending"]


# ════════════════════════════════════════════════════════════════════════════
sep("Marquer virements comme payés", "W3")
# ════════════════════════════════════════════════════════════════════════════

if payout_ids:
    r_paid = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/mark-paid/",
        headers=auth(tok_acct),
        json={
            "payout_ids":     payout_ids[:2],
            "payment_ref":    "TRF-2026-001",
            "payment_method": "orange_money",
        })
    check("POST /weekly-payouts/mark-paid/ → 200",
          r_paid.status_code == 200, f"HTTP {r_paid.status_code} — {r_paid.text[:80]}")
    if r_paid.status_code == 200:
        d = r_paid.json()
        check("paid count retourné", "paid" in d, f"paid={d.get('paid')}")
        check("payment_ref retourné", d.get("payment_ref") == "TRF-2026-001")

# Aucun payout_id → 400
r_empty = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/mark-paid/",
    headers=auth(tok_acct), json={"payout_ids": []})
check("mark-paid sans IDs → 400", r_empty.status_code == 400,
      f"HTTP {r_empty.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Filtre par statut", "W4")
# ════════════════════════════════════════════════════════════════════════════

r_pend = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/?status=pending",
    headers=auth(tok_acct))
check("Filtre status=pending → 200", r_pend.status_code == 200,
      f"HTTP {r_pend.status_code}")
if r_pend.status_code == 200:
    pend = r_pend.json()
    pend_list = pend if isinstance(pend, list) else pend.get("results", [])
    check("Tous les résultats sont pending",
          all(x.get("status") == "pending" for x in pend_list) or len(pend_list) == 0,
          f"{len(pend_list)} virement(s)")

r_paid_f = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/?status=paid",
    headers=auth(tok_acct))
check("Filtre status=paid → 200", r_paid_f.status_code == 200,
      f"HTTP {r_paid_f.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Amendes : créer et lister", "W5")
# ════════════════════════════════════════════════════════════════════════════

r_fine = requests.post(f"{BASE}/orders/admin/accounting/fines/create/",
    headers=auth(tok_super),
    json={
        "livreur_id": str(livreur.id),
        "amount_gnf": 5000,
        "reason": "Retard de livraison injustifié.",
    })
check("Admin crée amende → 201", r_fine.status_code == 201,
      f"HTTP {r_fine.status_code} — {r_fine.text[:100]}")

fine_id = None
if r_fine.status_code == 201:
    d = r_fine.json()
    fine_id = d.get("id")
    check("id amende retourné", bool(fine_id))
    check("amount_gnf = 5000", d.get("amount_gnf") == 5000)

# Lister les amendes
r_fines = requests.get(f"{BASE}/orders/admin/accounting/fines/",
    headers=auth(tok_acct))
check("Admin liste amendes → 200", r_fines.status_code == 200,
      f"HTTP {r_fines.status_code}")
if r_fines.status_code == 200:
    fines = r_fines.json()
    fines_list = fines if isinstance(fines, list) else fines.get("results", [])
    check("Au moins 1 amende", len(fines_list) >= 1, f"{len(fines_list)} amende(s)")


# ════════════════════════════════════════════════════════════════════════════
sep("Amendes déductibles du net", "W6")
# ════════════════════════════════════════════════════════════════════════════

# Générer les virements à nouveau après l'amende
week2_start = date.today() - timedelta(days=7 + date.today().weekday())
LivreurWeeklyPayout.objects.filter(livreur=livreur, week_start=week2_start).delete()

# Créer une livraison dans la semaine précédente pour tester
make_completed_delivery(livreur, 20000)

r_gen2 = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/generate/",
    headers=auth(tok_super), json={"week_start": week2_start.isoformat()})

r_list2 = requests.get(
    f"{BASE}/orders/admin/accounting/weekly-payouts/?livreur_id={livreur.id}",
    headers=auth(tok_acct))
check("Virements livreur → 200", r_list2.status_code == 200,
      f"HTTP {r_list2.status_code}")
if r_list2.status_code == 200:
    p2 = r_list2.json()
    p2_list = p2 if isinstance(p2, list) else p2.get("results", [])
    if p2_list:
        p = p2_list[0]
        gross = p.get("gross_gnf", 0)
        fines_gnf = p.get("fines_gnf", 0)
        net = p.get("net_gnf", 0)
        check("net_gnf ≤ gross_gnf (amendes déduites)", net <= gross,
              f"gross={gross}, fines={fines_gnf}, net={net}")
        check("net_gnf = gross - fines",
              net == gross - fines_gnf, f"{net} = {gross} - {fines_gnf}")


# ════════════════════════════════════════════════════════════════════════════
sep("Accès refusé aux non-comptables", "W7")
# ════════════════════════════════════════════════════════════════════════════

# admin_delivery → weekly payouts → 403
r_d1 = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/",
    headers=auth(tok_livr_adm))
check("admin_delivery → weekly-payouts → 403", r_d1.status_code == 403,
      f"HTTP {r_d1.status_code}")

# Acheteur → weekly payouts → 403
r_d2 = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/",
    headers=auth(tok_buyer))
check("Acheteur → weekly-payouts → 403", r_d2.status_code == 403,
      f"HTTP {r_d2.status_code}")

# Sans auth → 401
r_d3 = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/")
check("Sans auth → weekly-payouts → 401", r_d3.status_code == 401,
      f"HTTP {r_d3.status_code}")


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
    print("\n  🎉 TOUS LES TESTS VIREMENTS PASSENT !")
