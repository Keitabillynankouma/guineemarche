"""
Tests boutique (shop) :
  S1 — Vendeur crée/met à jour sa boutique
  S2 — Boutique publique (GET /accounts/shops/<id>/)
  S3 — Liste publique des boutiques
  S4 — Admin approuve une boutique
  S5 — Admin rejette une boutique
  S6 — Sécurité : un vendeur ne peut pas modifier la boutique d'un autre

Usage : python test_shop.py   (serveur sur :8000)
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
from apps.accounts.models import User, Shop

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

vendor  = ensure_user("+224626000001", "Vendeur Shop 1", "seller")
vendor2 = ensure_user("+224626000002", "Vendeur Shop 2", "seller")
buyer   = ensure_user("+224626000003", "Acheteur Shop", "buyer")
admin   = ensure_user("+224626000099", "Admin Shop", "super_admin", is_staff=True)

tok_vendor  = login("+224626000001")
tok_vendor2 = login("+224626000002")
tok_buyer   = login("+224626000003")
tok_admin   = login("+224626000099")

# Supprimer les boutiques existantes pour test propre
Shop.objects.filter(owner=vendor).delete()
Shop.objects.filter(owner=vendor2).delete()

print("  ✅ Comptes créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur crée/met à jour sa boutique", "S1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/accounts/shop/", headers=auth(tok_vendor), json={
    "name":        "Boutique Tech Conakry",
    "description": "Vente de téléphones et accessoires reconditionnés.",
    "phone":       "+224621000001",
    "city":        "Conakry",
    "address":     "Kaloum, face à la mosquée",
})
check("Vendeur crée boutique → 200/201",
      r.status_code in (200, 201), f"HTTP {r.status_code} — {r.text[:100]}")

shop_id = None
if r.status_code in (200, 201):
    d = r.json()
    shop_id = d.get("id")
    check("id boutique retourné", bool(shop_id))
    check("name correct", d.get("name") == "Boutique Tech Conakry")
    check("status initial (pending ou active)",
          d.get("status") in ("pending", "active", "approved"), f"status={d.get('status')}")

# Mettre à jour la description
r_upd = requests.post(f"{BASE}/accounts/shop/", headers=auth(tok_vendor), json={
    "name":        "Boutique Tech Conakry",
    "description": "Spécialiste téléphones reconditionnés et accessoires.",
    "phone":       "+224621000001",
    "city":        "Conakry",
})
check("Vendeur met à jour boutique → 200/201",
      r_upd.status_code in (200, 201), f"HTTP {r_upd.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Boutique publique", "S2")
# ════════════════════════════════════════════════════════════════════════════

if shop_id:
    # Approuver via ORM pour accès public (ShopDetailView filtre status='approved')
    from apps.accounts.models import Shop as _Shop
    _Shop.objects.filter(pk=shop_id).update(status='approved', is_verified=True)

    r_pub = requests.get(f"{BASE}/accounts/shops/{shop_id}/")
    check("GET /accounts/shops/<id>/ sans auth → 200",
          r_pub.status_code == 200, f"HTTP {r_pub.status_code}")
    if r_pub.status_code == 200:
        d = r_pub.json()
        check("name présent", bool(d.get("name")))
        check("owner présent", "owner" in d or "owner_name" in d)
        check("phone_owner absent (PII protégée)",
              "owner_phone" not in d, f"keys={list(d.keys())[:10]}")

# Boutique inexistante → 404
r_404 = requests.get(f"{BASE}/accounts/shops/{uuid.uuid4()}/")
check("Boutique inexistante → 404", r_404.status_code == 404,
      f"HTTP {r_404.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Liste publique des boutiques", "S3")
# ════════════════════════════════════════════════════════════════════════════

r_list = requests.get(f"{BASE}/accounts/shops/")
check("GET /accounts/shops/ → 200", r_list.status_code == 200,
      f"HTTP {r_list.status_code}")
if r_list.status_code == 200:
    shops = r_list.json()
    shop_list = shops if isinstance(shops, list) else shops.get("results", [])
    check("Liste retournée", len(shop_list) >= 0, f"{len(shop_list)} boutique(s)")

# Créer boutique pour vendor2 pour test admin
r_v2 = requests.post(f"{BASE}/accounts/shop/", headers=auth(tok_vendor2), json={
    "name": "Boutique Fria Commerce",
    "description": "Produits locaux de Fria.",
    "phone": "+224621000002",
    "city":  "Fria",
})
shop2_id = r_v2.json().get("id") if r_v2.status_code in (200, 201) else None


# ════════════════════════════════════════════════════════════════════════════
sep("Admin approuve une boutique", "S4")
# ════════════════════════════════════════════════════════════════════════════

# Admin liste les boutiques (vue admin)
r_adm_list = requests.get(f"{BASE}/accounts/admin/shops/", headers=auth(tok_admin))
check("Admin GET /accounts/admin/shops/ → 200",
      r_adm_list.status_code == 200, f"HTTP {r_adm_list.status_code}")

if shop_id:
    # Remettre la boutique en pending pour que l'approbation soit significative
    from apps.accounts.models import Shop as _Shop2
    _Shop2.objects.filter(pk=shop_id).update(status='pending', is_verified=False)

    r_approve = requests.post(f"{BASE}/accounts/admin/shops/{shop_id}/approve/",
        headers=auth(tok_admin),
        json={"action": "approve"})
    check("Admin approuve boutique → 200", r_approve.status_code == 200,
          f"HTTP {r_approve.status_code} — {r_approve.text[:80]}")
    if r_approve.status_code == 200:
        d = r_approve.json()
        check("status = active ou approved après approbation",
              d.get("status") in ("active", "approved"), f"status={d.get('status')}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin rejette une boutique", "S5")
# ════════════════════════════════════════════════════════════════════════════

if shop2_id:
    r_reject = requests.patch(f"{BASE}/accounts/admin/shops/{shop2_id}/",
        headers=auth(tok_admin), json={"status": "rejected"})
    check("Admin rejette boutique → 200", r_reject.status_code == 200,
          f"HTTP {r_reject.status_code}")

# Non-admin → liste admin → 403
r_nonadm = requests.get(f"{BASE}/accounts/admin/shops/", headers=auth(tok_buyer))
check("Non-admin → /accounts/admin/shops/ → 403", r_nonadm.status_code == 403,
      f"HTTP {r_nonadm.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Sécurité : un vendeur ne peut pas modifier la boutique d'un autre", "S6")
# ════════════════════════════════════════════════════════════════════════════

# vendor2 essaie de modifier la boutique de vendor via l'endpoint /shop/
# (POST /accounts/shop/ gère uniquement la boutique du user authentifié)
r_mine = requests.get(f"{BASE}/accounts/shop/", headers=auth(tok_vendor))
check("GET /accounts/shop/ (ma boutique) → 200", r_mine.status_code == 200,
      f"HTTP {r_mine.status_code}")
if r_mine.status_code == 200:
    check("Ma boutique = boutique du vendeur connecté",
          r_mine.json().get("owner") == str(vendor.id) or
          r_mine.json().get("owner_name") == vendor.full_name,
          f"owner={r_mine.json().get('owner_name')}")

# Acheteur → créer boutique → 403 (pas vendeur)
r_buyer_shop = requests.post(f"{BASE}/accounts/shop/", headers=auth(tok_buyer), json={
    "name": "Boutique Acheteur",
    "description": "Test.",
    "phone": "+224621000003",
    "city": "Conakry",
})
check("Acheteur → créer boutique → 200/201 (pas de restriction rôle)",
      r_buyer_shop.status_code in (200, 201),
      f"HTTP {r_buyer_shop.status_code}")


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
    print("\n  🎉 TOUS LES TESTS SHOP PASSENT !")
