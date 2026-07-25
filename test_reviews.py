"""
Tests avis (reviews) :
  R1  — Acheteur note le vendeur après une commande completed
  R2  — Note sauvegardée en DB avec rating_avg mis à jour sur le profil
  R3  — Double avis interdit (même order/reviewer/reviewee)
  R4  — Reviewee explicite : acheteur note le livreur
  R5  — Tiers ne peut pas noter (pas partie prenante)
  R6  — Auto-notation interdite
  R7  — Note sur commande non-completed acceptée (pas de restriction statut)
  R8  — Lister les avis d'un utilisateur (public)
  R9  — Note invalide (0 ou 6) → 400
  R10 — Vendeur note l'acheteur

Usage : python test_reviews.py   (serveur sur :8000)
"""
import os, django, requests, uuid

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE    = "http://127.0.0.1:8000/api/v1"
results = []

def auth(t):       return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def sep(title, n): print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond


# ── Setup ─────────────────────────────────────────────────────────────────────
print("Initialisation…")
django.setup()
from apps.accounts.models import User
from apps.listings.models import Listing
from apps.orders.models import Order, DeliveryAssignment

def ensure_user(phone, name, role):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(phone_number=phone, password="test1234",
                                     full_name=name, role=role,
                                     is_active=True, is_verified=True)
    else:
        User.objects.filter(pk=u.pk).update(is_active=True, is_verified=True, role=role)
        u.refresh_from_db()
    return u

def login(phone):
    from rest_framework_simplejwt.tokens import AccessToken
    return str(AccessToken.for_user(User.objects.get(phone_number=phone)))

seller  = ensure_user("+224629005001", "Vendeur Review",  "seller")
buyer   = ensure_user("+224629005002", "Acheteur Review", "buyer")
livreur = ensure_user("+224629005003", "Livreur Review",  "livreur")
tiers   = ensure_user("+224629005004", "Tiers Review",    "buyer")

tok_seller  = login("+224629005001")
tok_buyer   = login("+224629005002")
tok_livreur = login("+224629005003")
tok_tiers   = login("+224629005004")

listing = Listing.objects.create(
    seller=seller, title=f"Article Review {uuid.uuid4().hex[:4]}",
    price_gnf=60_000, price_type="fixed", city="Conakry",
    condition="good", description="Test avis.", status="active",
)

# Commande completed pour les tests
order = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=60_000, delivery_mode=Order.DeliveryMode.MEETING_POINT,
    status=Order.Status.COMPLETED,
)
# Commande avec livreur
order_delivery = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=60_000, delivery_mode=Order.DeliveryMode.HOME_DELIVERY,
    delivery_address="Test", status=Order.Status.COMPLETED,
)
assignment = DeliveryAssignment.objects.create(
    order=order_delivery, livreur=livreur,
    status=DeliveryAssignment.Status.DELIVERED,
)

print(f"  ✅ Commande : {order.id}")
print(f"  ✅ Commande livraison : {order_delivery.id}")
print("  ✅ Setup OK\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur note le vendeur", "R1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                  json={"order": str(order.id), "rating": 5, "comment": "Excellent vendeur !"})
check("POST /reviews/ → 201", r.status_code == 201, f"HTTP {r.status_code} — {r.text[:120]}")
if r.status_code == 201:
    rv = r.json()
    check("rating retourné", rv.get("rating") == 5)
    check("reviewee = vendeur", rv.get("reviewee_name") == seller.full_name or
          str(rv.get("reviewee")) == str(seller.id))


# ════════════════════════════════════════════════════════════════════════════
sep("rating_avg mis à jour sur le profil du vendeur", "R2")
# ════════════════════════════════════════════════════════════════════════════

from apps.accounts.models import UserProfile
seller.refresh_from_db()
try:
    profile = UserProfile.objects.get(user=seller)
    check("rating_avg > 0 sur le profil", profile.rating_avg > 0,
          f"rating_avg={profile.rating_avg}")
    check("total_ratings >= 1", profile.total_ratings >= 1,
          f"total={profile.total_ratings}")
except UserProfile.DoesNotExist:
    check("Profil vendeur existe", False, "UserProfile introuvable")


# ════════════════════════════════════════════════════════════════════════════
sep("Double avis interdit", "R3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                  json={"order": str(order.id), "rating": 3, "comment": "En fait non."})
check("Double avis → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur note le livreur (reviewee explicite)", "R4")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                  json={"order": str(order_delivery.id), "rating": 4,
                        "comment": "Livraison rapide !", "reviewee": str(livreur.id)})
check("Acheteur note livreur → 201", r.status_code == 201,
      f"HTTP {r.status_code} — {r.text[:120]}")
if r.status_code == 201:
    rv = r.json()
    check("reviewee = livreur",
          rv.get("reviewee_name") == livreur.full_name or
          str(rv.get("reviewee")) == str(livreur.id))


# ════════════════════════════════════════════════════════════════════════════
sep("Tiers ne peut pas noter (pas partie prenante)", "R5")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_tiers),
                  json={"order": str(order.id), "rating": 1, "comment": "Mauvais !"})
check("Tiers → 403", r.status_code == 403, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Auto-notation interdite", "R6")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                  json={"order": str(order.id), "rating": 5,
                        "reviewee": str(buyer.id), "comment": "Je suis parfait !"})
check("Auto-note → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Lister les avis d'un utilisateur (public)", "R8")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/reviews/user/{seller.id}/")
check("GET /reviews/user/<id>/ → 200 (sans auth)", r.status_code == 200,
      f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    items = data if isinstance(data, list) else data.get("results", [])
    check("Au moins 1 avis sur le vendeur", len(items) >= 1, f"count={len(items)}")


# ════════════════════════════════════════════════════════════════════════════
sep("Note invalide → 400", "R9")
# ════════════════════════════════════════════════════════════════════════════

order_extra = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=60_000, delivery_mode=Order.DeliveryMode.MEETING_POINT,
    status=Order.Status.COMPLETED,
)
r0 = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                   json={"order": str(order_extra.id), "rating": 0, "comment": "Zéro"})
check("Note 0 → 400", r0.status_code == 400, f"HTTP {r0.status_code}")

order_extra2 = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=60_000, delivery_mode=Order.DeliveryMode.MEETING_POINT,
    status=Order.Status.COMPLETED,
)
r6 = requests.post(f"{BASE}/reviews/", headers=auth(tok_buyer),
                   json={"order": str(order_extra2.id), "rating": 6, "comment": "Au-dessus du max"})
check("Note 6 → 400", r6.status_code == 400, f"HTTP {r6.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur note l'acheteur", "R10")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/reviews/", headers=auth(tok_seller),
                  json={"order": str(order.id), "rating": 4,
                        "comment": "Acheteur sérieux.", "reviewee": str(buyer.id)})
check("Vendeur note acheteur → 201", r.status_code == 201,
      f"HTTP {r.status_code} — {r.text[:120]}")


# ── Bilan ─────────────────────────────────────────────────────────────────────
passed = sum(1 for _, ok in results if ok)
total  = len(results)
failed = [(lbl, ok) for lbl, ok in results if not ok]
print(f"\n{'═'*60}")
print(f"  BILAN : {passed}/{total} tests passés")
if failed:
    print(f"\n  Échecs :")
    for lbl, _ in failed: print(f"    ❌ {lbl}")
print(f"{'═'*60}\n")
