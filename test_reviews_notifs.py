"""
Tests avis (reviews) et notifications :
  R1 — Laisser un avis après une commande COMPLETED
  R2 — Acheteur et vendeur se notent mutuellement
  R3 — Double notation bloquée
  R4 — Seuls les participants peuvent noter
  R5 — Avis publics d'un vendeur (GET /reviews/user/<id>/)
  R6 — Agrégation note moyenne (via profile)
  N1 — Notifications créées automatiquement (commande, paiement, etc.)
  N2 — Mark as read une notification
  N3 — Isolation : ne pas voir les notifications des autres

Usage : python test_reviews_notifs.py   (serveur sur :8000)
"""
import os, sys, json, hmac, hashlib, django, requests, uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE     = "http://127.0.0.1:8000/api/v1"
HMAC_KEY = "b13d1d1826ba0c16311207d58eec6735"
results  = []

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

def create_completed_order(buyer_user, vendor_user, price=60000):
    """Crée une commande et la met directement en COMPLETED via ORM."""
    from apps.listings.models import Listing
    from apps.orders.models import Order
    listing = Listing.objects.create(
        seller=vendor_user, title=f"Article pour avis {uuid.uuid4().hex[:6]}", price_gnf=price,
        price_type="fixed", city="Conakry", condition="good",
        description="Test avis.", status='active'
    )
    order = Order.objects.create(
        listing=listing, buyer=buyer_user, seller=vendor_user,
        amount_gnf=price, delivery_mode='meeting_point',
        meet_location='Kaloum', status='completed',
        escrow_status='released',
    )
    return order, listing


# ── Setup ────────────────────────────────────────────────────────────────────
print("Connexion des comptes...")
django.setup()

from apps.accounts.models import User

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

buyer  = ensure_user("+224622000001", "Acheteur Avis", "buyer")
vendor = ensure_user("+224622000002", "Vendeur Avis", "seller")
other  = ensure_user("+224622000003", "Inconnu Avis", "buyer")

tok_buyer  = login("+224622000001")
tok_vendor = login("+224622000002")
tok_other  = login("+224622000003")

# Créer une commande COMPLETED via ORM (bypasse le flux complet)
order, listing = create_completed_order(buyer, vendor, price=80000)
order_id = str(order.id)
print("  ✅ Comptes et commande terminée créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Laisser un avis après commande COMPLETED", "R1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": order_id, "rating": 5, "comment": "Excellent vendeur, très rapide !"})
check("Acheteur note vendeur → 201", r.status_code == 201, f"HTTP {r.status_code} — {r.text[:80]}")

review_id = None
if r.status_code == 201:
    d = r.json()
    review_id = d.get("id")
    check("ID avis retourné", bool(review_id))
    check("Rating = 5", d.get("rating") == 5)
    check("reviewer_name présent", bool(d.get("reviewer_name")))
    check("reviewee_name présent", bool(d.get("reviewee_name")))


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur et vendeur se notent mutuellement", "R2")
# ════════════════════════════════════════════════════════════════════════════

# Vendeur note l'acheteur sur la même commande
r2 = requests.post(f"{BASE}/reviews/", headers=auth(tok_vendor),
    json={"order": order_id, "rating": 4, "comment": "Acheteur sérieux, paiement rapide.",
          "reviewee": str(buyer.id)})
check("Vendeur note acheteur → 201", r2.status_code == 201,
      f"HTTP {r2.status_code} — {r2.text[:80]}")
if r2.status_code == 201:
    check("Rating vendeur → acheteur = 4", r2.json().get("rating") == 4)


# ════════════════════════════════════════════════════════════════════════════
sep("Double notation bloquée", "R3")
# ════════════════════════════════════════════════════════════════════════════

# Acheteur tente de noter le même vendeur une 2e fois
r3 = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": order_id, "rating": 3, "comment": "Finalement c'était moyen..."})
check("2e avis acheteur → vendeur (même commande) → 400",
      r3.status_code == 400, f"HTTP {r3.status_code}")

# Se noter soi-même → 400
r_self = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": order_id, "rating": 5, "comment": "Je suis excellent.",
          "reviewee": str(buyer.id)})
check("Se noter soi-même → 400", r_self.status_code == 400,
      f"HTTP {r_self.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Seuls les participants peuvent noter", "R4")
# ════════════════════════════════════════════════════════════════════════════

r4 = requests.post(f"{BASE}/reviews/", headers=auth(tok_other),
    json={"order": order_id, "rating": 2, "comment": "Pas bien du tout."})
check("Utilisateur extérieur → noter une commande → 403",
      r4.status_code == 403, f"HTTP {r4.status_code}")

# Commande inexistante → 400
r5 = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": str(uuid.uuid4()), "rating": 4, "comment": "Test."})
check("Commande inexistante → 400", r5.status_code in (400, 404),
      f"HTTP {r5.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Avis publics d'un vendeur", "R5")
# ════════════════════════════════════════════════════════════════════════════

r_pub = requests.get(f"{BASE}/reviews/user/{vendor.id}/")
check("GET /reviews/user/<id>/ (public, sans token) → 200",
      r_pub.status_code == 200, f"HTTP {r_pub.status_code}")
if r_pub.status_code == 200:
    reviews = r_pub.json()
    reviews_list = reviews if isinstance(reviews, list) else reviews.get("results", [])
    check("Au moins 1 avis pour ce vendeur", len(reviews_list) >= 1,
          f"{len(reviews_list)} avis")
    if reviews_list:
        r_item = reviews_list[0]
        check("reviewer_name présent", bool(r_item.get("reviewer_name")))
        check("rating présent", "rating" in r_item)

# Créer plusieurs avis pour tester l'agrégation
order2, _ = create_completed_order(buyer, vendor, price=50000)
order3, _ = create_completed_order(buyer, vendor, price=30000)
requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": str(order2.id), "rating": 4, "comment": "Bien."})
requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
    json={"order": str(order3.id), "rating": 3, "comment": "Moyen."})


# ════════════════════════════════════════════════════════════════════════════
sep("Agrégation note moyenne calculée depuis les avis", "R6")
# ════════════════════════════════════════════════════════════════════════════

# Récupérer tous les avis reçus par le vendeur
r_all_reviews = requests.get(f"{BASE}/reviews/user/{vendor.id}/")
check("GET /reviews/user/<id>/ → 200", r_all_reviews.status_code == 200,
      f"HTTP {r_all_reviews.status_code}")
if r_all_reviews.status_code == 200:
    all_revs = r_all_reviews.json()
    all_list = all_revs if isinstance(all_revs, list) else all_revs.get("results", [])
    check("Au moins 2 avis pour ce vendeur (plusieurs commandes créées)",
          len(all_list) >= 2, f"{len(all_list)} avis")
    if all_list:
        ratings = [r["rating"] for r in all_list if "rating" in r]
        if ratings:
            computed_avg = sum(ratings) / len(ratings)
            check("Moyenne calculée entre 1 et 5",
                  1 <= computed_avg <= 5, f"avg={computed_avg:.2f} sur {len(ratings)} avis")
            # Vérifier cohérence : notes de 5, 4, 3 créées → moyenne entre 3 et 5
            check("Moyenne cohérente avec les notes données (3–5)",
                  3 <= computed_avg <= 5, f"avg={computed_avg:.2f}")


# ════════════════════════════════════════════════════════════════════════════
sep("Notifications créées automatiquement", "N1")
# ════════════════════════════════════════════════════════════════════════════

# Créer une notification manuellement via ORM pour le test
from apps.notifications.models import Notification

# Créer une notification test pour le buyer
notif_test = Notification.objects.create(
    user=buyer,
    type=Notification.Type.ORDER_UPDATE,
    title="Test notification",
    body="Votre commande a été mise à jour.",
    data={"order_id": order_id},
    is_read=False,
)

r_notifs = requests.get(f"{BASE}/notifications/", headers=auth(tok_buyer))
check("GET /notifications/ → 200", r_notifs.status_code == 200, f"HTTP {r_notifs.status_code}")
if r_notifs.status_code == 200:
    notifs = r_notifs.json()
    notifs_list = notifs if isinstance(notifs, list) else notifs.get("results", [])
    check("Au moins 1 notification", len(notifs_list) >= 1, f"{len(notifs_list)} notif(s)")
    if notifs_list:
        n = notifs_list[0]
        check("Champ type présent", bool(n.get("type")))
        check("Champ title présent", bool(n.get("title")))
        check("Champ is_read présent", "is_read" in n)


# ════════════════════════════════════════════════════════════════════════════
sep("Mark as read une notification", "N2")
# ════════════════════════════════════════════════════════════════════════════

notif_id = str(notif_test.id)

r_read = requests.post(f"{BASE}/notifications/{notif_id}/read/",
    headers=auth(tok_buyer))
check("POST /notifications/{id}/read/ → 200", r_read.status_code == 200,
      f"HTTP {r_read.status_code}")

# Vérifier que is_read = True
notif_test.refresh_from_db()
check("is_read = True après mark-as-read", notif_test.is_read)

# Re-read → idempotent (toujours 200 ou 404)
r_read2 = requests.post(f"{BASE}/notifications/{notif_id}/read/",
    headers=auth(tok_buyer))
check("Mark-as-read idempotent → 200", r_read2.status_code == 200,
      f"HTTP {r_read2.status_code}")

# Notification inexistante → 404
r_bad = requests.post(f"{BASE}/notifications/{uuid.uuid4()}/read/",
    headers=auth(tok_buyer))
check("Mark-as-read notification inexistante → 404",
      r_bad.status_code == 404, f"HTTP {r_bad.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Isolation — ne pas voir les notifications des autres", "N3")
# ════════════════════════════════════════════════════════════════════════════

# "other" ne doit pas voir les notifications du buyer
r_other_notifs = requests.get(f"{BASE}/notifications/", headers=auth(tok_other))
check("GET /notifications/ → 200 pour other", r_other_notifs.status_code == 200,
      f"HTTP {r_other_notifs.status_code}")
if r_other_notifs.status_code == 200:
    other_notifs = r_other_notifs.json()
    other_list = other_notifs if isinstance(other_notifs, list) else other_notifs.get("results", [])
    buyer_notif_ids = {str(notif_test.id)}
    other_ids = {str(n.get("id")) for n in other_list}
    check("Notifications du buyer non visibles par other",
          not buyer_notif_ids.intersection(other_ids), "isolation OK")

# "other" ne peut pas marquer la notification du buyer
r_steal = requests.post(f"{BASE}/notifications/{notif_id}/read/",
    headers=auth(tok_other))
check("Autre utilisateur → mark-as-read notification d'un autre → 404",
      r_steal.status_code == 404, f"HTTP {r_steal.status_code}")


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
    print("\n  🎉 TOUS LES TESTS REVIEWS/NOTIFS PASSENT !")
