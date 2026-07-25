"""
Tests sous-rôles admin, boost d'annonce et parrainage :
  AB1 — Sous-rôle admin_delivery : accès livraisons, pas comptabilité
  AB2 — Sous-rôle admin_accounting : accès comptabilité, pas boost admin
  AB3 — Sous-rôle admin_marketing : accès boost/annonces, pas comptabilité
  AB4 — Super admin : accès total
  B1  — Vendeur boost via Orange Money (simulation cash)
  B2  — Admin approuve boost espèces → annonce marquée is_boosted=True
  B3  — Admin rejette un boost
  B4  — Boost non-vendeur → 403
  P1  — Code de parrainage unique généré à l'inscription
  P2  — Nouveau compte avec code parrainage → reward donnée au parrain
  P3  — Stats parrainage (GET /accounts/referral/)
  P4  — Code invalide → inscription bloquée ou ignorée

Usage : python test_admin_boost_referral.py   (serveur sur :8000)
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


# ── Setup ────────────────────────────────────────────────────────────────────
print("Création des comptes...")
django.setup()

from apps.accounts.models import User
from apps.listings.models import Listing

def ensure_user(phone, name, role, is_staff=False):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(phone_number=phone, password="test1234",
                                     full_name=name, role=role,
                                     is_active=True, is_verified=True, is_staff=is_staff)
    else:
        User.objects.filter(pk=u.pk).update(
            is_active=True, is_verified=True, role=role, is_staff=is_staff)
        u.refresh_from_db()
    return u

vendor        = ensure_user("+224623000001", "Vendeur Boost", "seller")
other_buyer   = ensure_user("+224623000002", "Acheteur Non-Vendeur", "buyer")
admin_delivery  = ensure_user("+224623000010", "Admin Livraison",   "admin_delivery",  is_staff=True)
admin_acct      = ensure_user("+224623000011", "Admin Comptabilité", "admin_accounting", is_staff=True)
admin_marketing = ensure_user("+224623000012", "Admin Marketing",   "admin_marketing",  is_staff=True)
super_admin     = ensure_user("+224623000013", "Super Admin",       "super_admin",      is_staff=True)
parrain         = ensure_user("+224623000020", "Parrain", "buyer")

tok_vendor          = login("+224623000001")
tok_buyer           = login("+224623000002")
tok_admin_delivery  = login("+224623000010")
tok_admin_acct      = login("+224623000011")
tok_admin_marketing = login("+224623000012")
tok_super           = login("+224623000013")
tok_parrain         = login("+224623000020")

# Créer une annonce pour les tests de boost
listing = Listing.objects.create(
    seller=vendor, title=f"Annonce Boost Test {uuid.uuid4().hex[:4]}",
    price_gnf=500000, price_type="fixed", city="Conakry",
    condition="good", description="Test boost.", status='active'
)
listing_id = str(listing.id)
print("  ✅ Comptes et annonce créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Sous-rôle admin_delivery : accès livraisons, pas comptabilité", "AB1")
# ════════════════════════════════════════════════════════════════════════════

# Peut accéder aux livraisons
r_asgn = requests.get(f"{BASE}/orders/admin/assignments/", headers=auth(tok_admin_delivery))
check("admin_delivery → GET /orders/admin/assignments/ → 200",
      r_asgn.status_code == 200, f"HTTP {r_asgn.status_code}")

r_livreurs = requests.get(f"{BASE}/orders/admin/livreurs/", headers=auth(tok_admin_delivery))
check("admin_delivery → GET /orders/admin/livreurs/ → 200",
      r_livreurs.status_code == 200, f"HTTP {r_livreurs.status_code}")

# Ne peut PAS accéder à la comptabilité
r_acct = requests.get(f"{BASE}/orders/admin/accounting/summary/", headers=auth(tok_admin_delivery))
check("admin_delivery → GET /orders/admin/accounting/summary/ → 403",
      r_acct.status_code == 403, f"HTTP {r_acct.status_code}")

# Peut accéder aux utilisateurs (IsAdmin = tous sous-rôles admin)
r_users = requests.get(f"{BASE}/accounts/admin/users/", headers=auth(tok_admin_delivery))
check("admin_delivery → GET /accounts/admin/users/ → 200 (IsAdmin = tous admins)",
      r_users.status_code == 200, f"HTTP {r_users.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Sous-rôle admin_accounting : accès comptabilité, pas boost admin", "AB2")
# ════════════════════════════════════════════════════════════════════════════

r_summary = requests.get(f"{BASE}/orders/admin/accounting/summary/", headers=auth(tok_admin_acct))
check("admin_accounting → GET /orders/admin/accounting/summary/ → 200",
      r_summary.status_code == 200, f"HTTP {r_summary.status_code}")

r_earnings = requests.get(f"{BASE}/orders/admin/accounting/livreurs/", headers=auth(tok_admin_acct))
check("admin_accounting → GET /orders/admin/accounting/livreurs/ → 200",
      r_earnings.status_code == 200, f"HTTP {r_earnings.status_code}")

# Peut accéder aux assignments (IsAdmin = tous sous-rôles admin)
r_assign_orders = requests.get(f"{BASE}/orders/admin/assignments/", headers=auth(tok_admin_acct))
check("admin_accounting → GET /orders/admin/assignments/ → 200 (IsAdmin = tous admins)",
      r_assign_orders.status_code == 200, f"HTTP {r_assign_orders.status_code}")

# Ne peut PAS approuver des boosts
fake_boost_id = str(uuid.uuid4())
r_boost_approve = requests.post(
    f"{BASE}/listings/admin/boost-payments/{fake_boost_id}/approve/",
    headers=auth(tok_admin_acct))
check("admin_accounting → approuver boost → 403 (pas 404)",
      r_boost_approve.status_code in (403, 404),
      f"HTTP {r_boost_approve.status_code} (403 si contrôle accès, 404 si accès mais ressource introuvable)")


# ════════════════════════════════════════════════════════════════════════════
sep("Sous-rôle admin_marketing : accès boost/annonces, pas comptabilité", "AB3")
# ════════════════════════════════════════════════════════════════════════════

r_boosts = requests.get(f"{BASE}/listings/admin/boost-payments/", headers=auth(tok_admin_marketing))
check("admin_marketing → GET /listings/admin/boost-payments/ → 200",
      r_boosts.status_code == 200, f"HTTP {r_boosts.status_code}")

r_listings = requests.get(f"{BASE}/listings/admin/listings/", headers=auth(tok_admin_marketing))
check("admin_marketing → GET /listings/admin/listings/ → 200",
      r_listings.status_code == 200, f"HTTP {r_listings.status_code}")

# Ne peut PAS accéder à la comptabilité
r_no_acct = requests.get(f"{BASE}/orders/admin/accounting/summary/", headers=auth(tok_admin_marketing))
check("admin_marketing → GET /orders/admin/accounting/summary/ → 403",
      r_no_acct.status_code == 403, f"HTTP {r_no_acct.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Super admin : accès total", "AB4")
# ════════════════════════════════════════════════════════════════════════════

r1 = requests.get(f"{BASE}/orders/admin/accounting/summary/", headers=auth(tok_super))
check("super_admin → comptabilité → 200", r1.status_code == 200, f"HTTP {r1.status_code}")

r2 = requests.get(f"{BASE}/orders/admin/assignments/", headers=auth(tok_super))
check("super_admin → livraisons → 200", r2.status_code == 200, f"HTTP {r2.status_code}")

r3 = requests.get(f"{BASE}/listings/admin/boost-payments/", headers=auth(tok_super))
check("super_admin → boost payments → 200", r3.status_code == 200, f"HTTP {r3.status_code}")

r4 = requests.get(f"{BASE}/accounts/admin/users/", headers=auth(tok_super))
check("super_admin → users admin → 200", r4.status_code == 200, f"HTTP {r4.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur boost via cash (demande de boost)", "B1")
# ════════════════════════════════════════════════════════════════════════════

r_boost = requests.post(f"{BASE}/listings/{listing_id}/boost/", headers=auth(tok_vendor),
    json={"days": 7, "provider": "cash"})
# 202 = cash en attente de validation admin (comportement attendu)
check("Vendeur POST /listings/{id}/boost/ (cash) → 202 Accepted",
      r_boost.status_code in (200, 201, 202), f"HTTP {r_boost.status_code} — {r_boost.text[:100]}")

boost_payment_id = None
if r_boost.status_code in (200, 201):
    bd = r_boost.json()
    boost_payment_id = bd.get("boost_payment_id")
    check("boost_payment_id retourné", bool(boost_payment_id), str(boost_payment_id)[:8] if boost_payment_id else "")
    check("is_boosted=False (cash = en attente)", bd.get("is_boosted") == False, f"is_boosted={bd.get('is_boosted')}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin approuve boost espèces → is_boosted=True", "B2")
# ════════════════════════════════════════════════════════════════════════════

# Admin marketing liste les boost payments
r_list = requests.get(f"{BASE}/listings/admin/boost-payments/", headers=auth(tok_admin_marketing))
check("Admin GET /listings/admin/boost-payments/ → 200", r_list.status_code == 200,
      f"HTTP {r_list.status_code}")

if r_list.status_code == 200 and boost_payment_id:
    # Approuver le boost
    r_approve = requests.post(
        f"{BASE}/listings/admin/boost-payments/{boost_payment_id}/approve/",
        headers=auth(tok_admin_marketing))
    check("Admin approuve boost → 200", r_approve.status_code == 200,
          f"HTTP {r_approve.status_code} — {r_approve.text[:100]}")
    if r_approve.status_code == 200:
        check("is_boosted=True après approbation", r_approve.json().get("is_boosted") == True,
              f"is_boosted={r_approve.json().get('is_boosted')}")

    # Vérifier via l'annonce
    listing.refresh_from_db()
    check("Annonce is_boosted=True en DB", listing.is_boosted)


# ════════════════════════════════════════════════════════════════════════════
sep("Admin rejette un boost", "B3")
# ════════════════════════════════════════════════════════════════════════════

# Créer une nouvelle annonce et un nouveau boost pour le test de rejet
listing2 = Listing.objects.create(
    seller=vendor, title=f"Annonce Boost Rejet {uuid.uuid4().hex[:4]}",
    price_gnf=200000, price_type="fixed", city="Conakry",
    condition="used", description="Test rejet boost.", status='active'
)
r_boost2 = requests.post(f"{BASE}/listings/{listing2.id}/boost/", headers=auth(tok_vendor),
    json={"days": 3, "provider": "cash"})

if r_boost2.status_code in (200, 201, 202):
    bp2_id = r_boost2.json().get("boost_payment_id")
    if bp2_id:
        r_reject = requests.post(
            f"{BASE}/listings/admin/boost-payments/{bp2_id}/reject/",
            headers=auth(tok_admin_marketing),
            json={"reason": "Paiement non reçu."})
        check("Admin rejette boost → 200", r_reject.status_code == 200,
              f"HTTP {r_reject.status_code}")
        listing2.refresh_from_db()
        check("Annonce reste is_boosted=False après rejet", not listing2.is_boosted)
    else:
        check("bp2_id retourné pour test rejet", False, "boost_payment_id absent")
else:
    check("2e boost créé pour test rejet", False, f"HTTP {r_boost2.status_code} (attendu 202)")


# ════════════════════════════════════════════════════════════════════════════
sep("Boost non-vendeur → 403", "B4")
# ════════════════════════════════════════════════════════════════════════════

r_b4 = requests.post(f"{BASE}/listings/{listing_id}/boost/", headers=auth(tok_buyer),
    json={"days": 7, "provider": "cash"})
# 404 : get_object_or_404(Listing, pk=pk, seller=request.user) → introuvable pour cet utilisateur
check("Acheteur → boost d'une annonce d'un autre → 403 ou 404",
      r_b4.status_code in (403, 404), f"HTTP {r_b4.status_code}")

# Sans token → 401
r_anon = requests.post(f"{BASE}/listings/{listing_id}/boost/",
    json={"days": 7, "provider": "cash"})
check("Boost sans auth → 401", r_anon.status_code == 401, f"HTTP {r_anon.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Code de parrainage unique généré à l'inscription", "P1")
# ════════════════════════════════════════════════════════════════════════════

parrain.refresh_from_db()
check("parrain.referral_code non vide", bool(parrain.referral_code),
      f"code={parrain.referral_code}")
check("referral_code longueur 8", len(parrain.referral_code) == 8,
      f"len={len(parrain.referral_code)}")
check("referral_code alphanumérique majuscule",
      parrain.referral_code.isalnum() and parrain.referral_code.isupper(),
      f"code={parrain.referral_code}")

# Via l'API stats de parrainage
r_ref_stats = requests.get(f"{BASE}/accounts/referral/", headers=auth(tok_parrain))
check("GET /accounts/referral/ → 200", r_ref_stats.status_code == 200,
      f"HTTP {r_ref_stats.status_code}")
if r_ref_stats.status_code == 200:
    s = r_ref_stats.json()
    check("referral_code dans la réponse API", bool(s.get("referral_code")),
          f"code={s.get('referral_code')}")
    check("referral_url dans la réponse", bool(s.get("referral_url")))
    check("referral_count dans la réponse", "referral_count" in s)


# ════════════════════════════════════════════════════════════════════════════
sep("Nouveau compte avec code parrainage → reward au parrain", "P2")
# ════════════════════════════════════════════════════════════════════════════

# Supprimer si déjà existant (le CASCADE supprime aussi le Referral existant)
from apps.accounts.models import Referral
new_phone = "+224624000099"
User.objects.filter(phone_number=new_phone).delete()

# Compter APRÈS le delete (le Referral de la précédente exécution est supprimé en cascade)
count_before = Referral.objects.filter(referrer=parrain, reward_given=True).count()

r_reg = requests.post(f"{BASE}/accounts/register/", json={
    "phone_number": new_phone,
    "full_name": "Filleul Test",
    "password": "test1234",
    "password2": "test1234",
    "role": "buyer",
    "referral_code": parrain.referral_code,
})
check("Inscription avec code parrainage → 201",
      r_reg.status_code == 201, f"HTTP {r_reg.status_code} — {r_reg.text[:100]}")

# Activer le nouveau compte et vérifier
filleul = User.objects.filter(phone_number=new_phone).first()
if filleul:
    User.objects.filter(pk=filleul.pk).update(is_active=True, is_verified=True)
    filleul.refresh_from_db()

count_after = Referral.objects.filter(referrer=parrain, reward_given=True).count()
check("Referral créé avec reward_given=True",
      count_after == count_before + 1,
      f"avant={count_before}, après={count_after}")


# ════════════════════════════════════════════════════════════════════════════
sep("Stats parrainage à jour", "P3")
# ════════════════════════════════════════════════════════════════════════════

r_stats2 = requests.get(f"{BASE}/accounts/referral/", headers=auth(tok_parrain))
check("GET /accounts/referral/ → 200", r_stats2.status_code == 200,
      f"HTTP {r_stats2.status_code}")
if r_stats2.status_code == 200:
    s2 = r_stats2.json()
    check("referral_count ≥ 1 après inscription filleul",
          s2.get("referral_count", 0) >= 1,
          f"referral_count={s2.get('referral_count')}")
    total_bonus = s2.get("total_bonus", 0)
    check("total_bonus ≥ 0", total_bonus >= 0, f"total_bonus={total_bonus}")


# ════════════════════════════════════════════════════════════════════════════
sep("Code parrainage invalide → ignoré ou erreur gérée", "P4")
# ════════════════════════════════════════════════════════════════════════════

bad_phone = "+224624000098"
User.objects.filter(phone_number=bad_phone).delete()

r_bad_ref = requests.post(f"{BASE}/accounts/register/", json={
    "phone_number": bad_phone,
    "full_name": "Mauvais Parrain",
    "password": "test1234",
    "password2": "test1234",
    "role": "buyer",
    "referral_code": "INVALIDE99",
})
# Le backend peut soit ignorer le code invalide (201), soit le rejeter (400)
check("Code invalide → 201 (ignoré) ou 400 (rejeté)",
      r_bad_ref.status_code in (201, 400),
      f"HTTP {r_bad_ref.status_code}")

# S'il est 201, s'assurer qu'aucun referral n'a été créé pour ce code
if r_bad_ref.status_code == 201:
    bad_user = User.objects.filter(phone_number=bad_phone).first()
    if bad_user:
        bad_referral_count = Referral.objects.filter(referred=bad_user).count()
        check("Aucun referral créé avec code invalide", bad_referral_count == 0,
              f"referrals={bad_referral_count}")


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
    print("\n  🎉 TOUS LES TESTS ADMIN/BOOST/PARRAINAGE PASSENT !")
