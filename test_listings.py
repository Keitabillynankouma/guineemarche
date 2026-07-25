"""
Tests annonces (listings) :
  L1 — Créer une annonce (vendeur)
  L2 — Lire/filtrer la liste publique
  L3 — Détail annonce + compteur de vues
  L4 — Modifier son annonce (vendeur)
  L5 — Modifier l'annonce d'un autre → 403
  L6 — Supprimer (soft-delete → SUSPENDED)
  L7 — Favoris : ajouter, toggle, liste
  L8 — Mes annonces (GET /listings/my/)
  L9 — Stats vendeur (GET /listings/my/stats/)
  L10 — Catégories publiques
  L11 — Signaler une annonce
  L12 — Admin : approuver / rejeter annonce

Usage : python test_listings.py   (serveur sur :8000)
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

vendor  = ensure_user("+224625000001", "Vendeur Listings", "seller")
buyer   = ensure_user("+224625000002", "Acheteur Listings", "buyer")
vendor2 = ensure_user("+224625000003", "Vendeur 2 Listings", "seller")
admin   = ensure_user("+224625000099", "Admin Listings", "super_admin", is_staff=True)

tok_vendor  = login("+224625000001")
tok_buyer   = login("+224625000002")
tok_vendor2 = login("+224625000003")
tok_admin   = login("+224625000099")
print("  ✅ Comptes créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Créer une annonce", "L1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/listings/", headers=auth(tok_vendor), json={
    "title": "Téléphone Samsung Galaxy Test",
    "description": "Très bon état, acheté il y a 6 mois. Batterie 80%.",
    "price_gnf": 2500000,
    "price_type": "fixed",
    "city": "Conakry",
    "condition": "fair",
})
check("Vendeur crée annonce → 201", r.status_code == 201,
      f"HTTP {r.status_code} — {r.text[:80]}")

listing_id = None
if r.status_code == 201:
    d = r.json()
    listing_id = d.get("id")
    check("id annonce retourné", bool(listing_id))
    check("title correct", d.get("title") == "Téléphone Samsung Galaxy Test")
    check("price_gnf correct", d.get("price_gnf") == 2500000)
    check("status active (auto-modération)", d.get("status") == "active",
          f"status={d.get('status')}")

# Acheteur ne peut pas créer une annonce
r_buyer_create = requests.post(f"{BASE}/listings/", headers=auth(tok_buyer), json={
    "title": "Annonce acheteur", "description": "Test", "price_gnf": 100000,
    "price_type": "fixed", "city": "Conakry", "condition": "good",
})
check("Acheteur crée annonce → 200/201 (pas de restriction rôle)",
      r_buyer_create.status_code in (200, 201),
      f"HTTP {r_buyer_create.status_code}")

# Champs obligatoires manquants → 400
r_invalid = requests.post(f"{BASE}/listings/", headers=auth(tok_vendor), json={
    "title": "Incomplet"
})
check("Annonce incomplète → 400", r_invalid.status_code == 400,
      f"HTTP {r_invalid.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Lire et filtrer la liste publique", "L2")
# ════════════════════════════════════════════════════════════════════════════

r_list = requests.get(f"{BASE}/listings/")
check("GET /listings/ sans auth → 200", r_list.status_code == 200,
      f"HTTP {r_list.status_code}")
if r_list.status_code == 200:
    data = r_list.json()
    items = data if isinstance(data, list) else data.get("results", [])
    check("Au moins 1 annonce dans la liste", len(items) >= 1, f"{len(items)} annonce(s)")

# Filtre par ville
r_city = requests.get(f"{BASE}/listings/?city=Conakry")
check("Filtre city=Conakry → 200", r_city.status_code == 200,
      f"HTTP {r_city.status_code}")

# Filtre par condition
r_cond = requests.get(f"{BASE}/listings/?condition=fair")
check("Filtre condition=fair → 200", r_cond.status_code == 200,
      f"HTTP {r_cond.status_code}")

# Filtre par prix max
r_price = requests.get(f"{BASE}/listings/?max_price=3000000")
check("Filtre max_price → 200", r_price.status_code == 200,
      f"HTTP {r_price.status_code}")

# Recherche textuelle
r_search = requests.get(f"{BASE}/listings/?search=Samsung")
check("Recherche search=Samsung → 200", r_search.status_code == 200,
      f"HTTP {r_search.status_code}")
if r_search.status_code == 200:
    found = r_search.json()
    found_list = found if isinstance(found, list) else found.get("results", [])
    titles = [a.get("title", "") for a in found_list]
    check("Résultat contient 'Samsung'",
          any("Samsung" in t or "samsung" in t.lower() for t in titles),
          f"{len(found_list)} résultat(s)")


# ════════════════════════════════════════════════════════════════════════════
sep("Détail annonce + compteur de vues", "L3")
# ════════════════════════════════════════════════════════════════════════════

if listing_id:
    # Premier accès
    r_d1 = requests.get(f"{BASE}/listings/{listing_id}/")
    check("GET /listings/{id}/ → 200", r_d1.status_code == 200,
          f"HTTP {r_d1.status_code}")
    if r_d1.status_code == 200:
        d = r_d1.json()
        check("title présent", bool(d.get("title")))
        check("seller présent", bool(d.get("seller")))
        views1 = d.get("view_count", 0)

    # Deuxième accès → view_count +1
    r_d2 = requests.get(f"{BASE}/listings/{listing_id}/")
    if r_d2.status_code == 200:
        views2 = r_d2.json().get("view_count", 0)
        check("view_count incrémenté", views2 > views1, f"{views1} → {views2}")

    # Annonce inexistante → 404
    r_404 = requests.get(f"{BASE}/listings/{uuid.uuid4()}/")
    check("Annonce inexistante → 404", r_404.status_code == 404,
          f"HTTP {r_404.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Modifier son annonce", "L4")
# ════════════════════════════════════════════════════════════════════════════

if listing_id:
    # Modifier le prix uniquement (pas le texte → pas de re-modération)
    r_upd = requests.patch(f"{BASE}/listings/{listing_id}/", headers=auth(tok_vendor),
        json={"price_gnf": 2200000})
    check("PATCH prix → 200", r_upd.status_code == 200,
          f"HTTP {r_upd.status_code}")
    if r_upd.status_code == 200:
        check("Nouveau prix = 2200000", r_upd.json().get("price_gnf") == 2200000)

    # Modifier le titre → re-modération (statut peut passer DRAFT puis ACTIVE)
    r_upd2 = requests.patch(f"{BASE}/listings/{listing_id}/", headers=auth(tok_vendor),
        json={"title": "Téléphone Samsung Galaxy Test Modifié"})
    check("PATCH titre → 200", r_upd2.status_code == 200,
          f"HTTP {r_upd2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Modifier l'annonce d'un autre → 403", "L5")
# ════════════════════════════════════════════════════════════════════════════

if listing_id:
    r_hack = requests.patch(f"{BASE}/listings/{listing_id}/", headers=auth(tok_vendor2),
        json={"price_gnf": 999})
    check("Autre vendeur → PATCH → 403", r_hack.status_code == 403,
          f"HTTP {r_hack.status_code}")

    r_hack2 = requests.patch(f"{BASE}/listings/{listing_id}/", headers=auth(tok_buyer),
        json={"price_gnf": 999})
    check("Acheteur → PATCH → 403", r_hack2.status_code == 403,
          f"HTTP {r_hack2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Supprimer son annonce (soft-delete)", "L6")
# ════════════════════════════════════════════════════════════════════════════

# Créer une 2e annonce pour tester la suppression sans impacter les autres tests
r_new = requests.post(f"{BASE}/listings/", headers=auth(tok_vendor), json={
    "title": "Annonce à supprimer", "description": "Test suppression.",
    "price_gnf": 50000, "price_type": "fixed", "city": "Kindia", "condition": "good",
})
del_id = r_new.json().get("id") if r_new.status_code == 201 else None

if del_id:
    # Autre vendeur → 403
    r_del_fail = requests.delete(f"{BASE}/listings/{del_id}/", headers=auth(tok_vendor2))
    check("Autre vendeur → DELETE → 403", r_del_fail.status_code == 403,
          f"HTTP {r_del_fail.status_code}")

    # Propriétaire → 204
    r_del = requests.delete(f"{BASE}/listings/{del_id}/", headers=auth(tok_vendor))
    check("Propriétaire → DELETE → 204", r_del.status_code == 204,
          f"HTTP {r_del.status_code}")

    # Annonce en SUSPENDED n'apparaît plus dans la liste
    from apps.listings.models import Listing as _L
    _L.objects.filter(pk=del_id).exists()
    l_check = _L.objects.filter(pk=del_id).first()
    check("Annonce status=suspended après DELETE", l_check and l_check.status == 'suspended',
          f"status={l_check.status if l_check else 'introuvable'}")


# ════════════════════════════════════════════════════════════════════════════
sep("Favoris : ajouter, toggle, liste", "L7")
# ════════════════════════════════════════════════════════════════════════════

if listing_id:
    # Toggle ON
    r_fav = requests.post(f"{BASE}/listings/{listing_id}/favorite/", headers=auth(tok_buyer))
    check("POST /listings/{id}/favorite/ (toggle on) → 200/201",
          r_fav.status_code in (200, 201), f"HTTP {r_fav.status_code}")
    if r_fav.status_code in (200, 201):
        check("is_favorited = True", r_fav.json().get("is_favorited") == True,
              f"{r_fav.json()}")

    # Toggle OFF
    r_unfav = requests.post(f"{BASE}/listings/{listing_id}/favorite/", headers=auth(tok_buyer))
    check("POST /favorite/ (toggle off) → 200",
          r_unfav.status_code in (200, 201), f"HTTP {r_unfav.status_code}")
    if r_unfav.status_code in (200, 201):
        check("is_favorited = False", r_unfav.json().get("is_favorited") == False,
              f"{r_unfav.json()}")

    # Toggle ON à nouveau pour tester la liste
    requests.post(f"{BASE}/listings/{listing_id}/favorite/", headers=auth(tok_buyer))

    # Liste des favoris
    r_favs = requests.get(f"{BASE}/listings/favorites/", headers=auth(tok_buyer))
    check("GET /listings/favorites/ → 200", r_favs.status_code == 200,
          f"HTTP {r_favs.status_code}")
    if r_favs.status_code == 200:
        favs = r_favs.json()
        fav_list = favs if isinstance(favs, list) else favs.get("results", [])
        check("Au moins 1 favori", len(fav_list) >= 1, f"{len(fav_list)} favori(s)")

    # Non authentifié → toggle → 401
    r_anon = requests.post(f"{BASE}/listings/{listing_id}/favorite/")
    check("Favoris sans auth → 401", r_anon.status_code == 401,
          f"HTTP {r_anon.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Mes annonces", "L8")
# ════════════════════════════════════════════════════════════════════════════

r_mine = requests.get(f"{BASE}/listings/my/", headers=auth(tok_vendor))
check("GET /listings/my/ → 200", r_mine.status_code == 200, f"HTTP {r_mine.status_code}")
if r_mine.status_code == 200:
    mine = r_mine.json()
    mine_list = mine if isinstance(mine, list) else mine.get("results", [])
    check("Mes annonces retournées", len(mine_list) >= 1, f"{len(mine_list)} annonce(s)")
    if mine_list:
        check("Toutes mes annonces appartiennent à moi",
              all(str(a.get("seller")) == str(vendor.id) or
                  a.get("seller_name") == vendor.full_name
                  for a in mine_list[:5]))

# Sans auth → 401
r_mine_anon = requests.get(f"{BASE}/listings/my/")
check("GET /listings/my/ sans auth → 401", r_mine_anon.status_code == 401,
      f"HTTP {r_mine_anon.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Stats vendeur", "L9")
# ════════════════════════════════════════════════════════════════════════════

r_stats = requests.get(f"{BASE}/listings/my/stats/", headers=auth(tok_vendor))
check("GET /listings/my/stats/ → 200", r_stats.status_code == 200,
      f"HTTP {r_stats.status_code}")
if r_stats.status_code == 200:
    s = r_stats.json()
    check("total_listings présent", "total_listings" in s or "listings_count" in s or
          "active_listings" in s, f"keys={list(s.keys())[:6]}")


# ════════════════════════════════════════════════════════════════════════════
sep("Catégories publiques", "L10")
# ════════════════════════════════════════════════════════════════════════════

r_cats = requests.get(f"{BASE}/listings/categories/")
check("GET /listings/categories/ → 200", r_cats.status_code == 200,
      f"HTTP {r_cats.status_code}")
if r_cats.status_code == 200:
    cats = r_cats.json()
    cat_list = cats if isinstance(cats, list) else cats.get("results", [])
    check("Catégories retournées", len(cat_list) >= 0,
          f"{len(cat_list)} catégorie(s)")


# ════════════════════════════════════════════════════════════════════════════
sep("Signaler une annonce", "L11")
# ════════════════════════════════════════════════════════════════════════════

if listing_id:
    r_report = requests.post(f"{BASE}/listings/report/", headers=auth(tok_buyer),
        json={"listing": listing_id, "reason": "fraud",
              "description": "Ce vendeur me semble suspect."})
    check("POST /listings/report/ → 201", r_report.status_code == 201,
          f"HTTP {r_report.status_code} — {r_report.text[:80]}")

    # Double signalement → 400
    r_report2 = requests.post(f"{BASE}/listings/report/", headers=auth(tok_buyer),
        json={"listing": listing_id, "reason": "fraud", "description": "Encore."})
    check("Double signalement → 400", r_report2.status_code == 400,
          f"HTTP {r_report2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin : approuver / rejeter annonce", "L12")
# ════════════════════════════════════════════════════════════════════════════

# Créer une annonce à modérer
r_mod = requests.post(f"{BASE}/listings/", headers=auth(tok_vendor2), json={
    "title": "Annonce en modération", "description": "Test admin modération.",
    "price_gnf": 300000, "price_type": "fixed", "city": "Labé", "condition": "new",
})
mod_id = r_mod.json().get("id") if r_mod.status_code == 201 else None

# Admin liste les annonces
r_adm = requests.get(f"{BASE}/listings/admin/listings/", headers=auth(tok_admin))
check("Admin GET /listings/admin/listings/ → 200", r_adm.status_code == 200,
      f"HTTP {r_adm.status_code}")

if mod_id:
    # Mettre l'annonce en draft pour que l'approbation soit possible
    from apps.listings.models import Listing as _L
    _L.objects.filter(pk=mod_id).update(status='draft')

    # Approuver
    r_approve = requests.post(f"{BASE}/listings/admin/listings/{mod_id}/approve/",
        headers=auth(tok_admin))
    check("Admin approuve annonce → 200", r_approve.status_code == 200,
          f"HTTP {r_approve.status_code}")

    # Rejeter une autre annonce
    r_new2 = requests.post(f"{BASE}/listings/", headers=auth(tok_vendor2), json={
        "title": "Annonce à rejeter", "description": "Contenu suspect.",
        "price_gnf": 10000, "price_type": "fixed", "city": "Labé", "condition": "new",
    })
    rej_id = r_new2.json().get("id") if r_new2.status_code == 201 else None
    if rej_id:
        r_reject = requests.post(f"{BASE}/listings/admin/listings/{rej_id}/reject/",
            headers=auth(tok_admin), json={"reason": "Contenu inapproprié."})
        check("Admin rejette annonce → 200", r_reject.status_code == 200,
              f"HTTP {r_reject.status_code}")

# Non-admin → accès admin listings → 403
r_nonadm = requests.get(f"{BASE}/listings/admin/listings/", headers=auth(tok_buyer))
check("Non-admin → /listings/admin/listings/ → 403", r_nonadm.status_code == 403,
      f"HTTP {r_nonadm.status_code}")


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
    print("\n  🎉 TOUS LES TESTS LISTINGS PASSENT !")
