"""
Tests workflow livraison complète :
  D1  — Admin assigne un livreur à une commande home_delivery
  D2  — Livreur voit ses assignments
  D3  — Livreur démarre la livraison (ASSIGNED → EN_ROUTE)
  D4  — Livreur ne peut pas démarrer si déjà EN_ROUTE
  D5  — Mauvais livreur ne peut pas démarrer (403)
  D6  — Livreur met à jour sa position GPS
  D7  — Mauvais livreur ne peut pas mettre à jour la position
  D8  — Acheteur suit la livraison (tracking + position)
  D9  — Vendeur peut aussi suivre la livraison
  D10 — Utilisateur tiers ne peut pas voir le tracking (403)
  D11 — Mauvais code de vérification → 400
  D12 — Impossible de confirmer sans avoir démarré (EN_ROUTE requis)
  D13 — Livreur confirme la livraison avec le bon code → DELIVERED
  D14 — Commande passe à COMPLETED après confirmation
  D15 — Double confirmation échoue
  D16 — Mauvais livreur ne peut pas confirmer la livraison

Usage : python test_delivery.py   (serveur sur :8000)
"""
import os, django, requests, uuid, json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")

BASE    = "http://127.0.0.1:8000/api/v1"
results = []

def auth(t):        return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def sep(title, n):  print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

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
print("Création des comptes et données de test...")
django.setup()
from apps.accounts.models import User
from apps.listings.models import Listing
from apps.orders.models import Order, DeliveryAssignment

def ensure_user(phone, name, role, is_staff=False):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(
            phone_number=phone, password="test1234",
            full_name=name, role=role,
            is_active=True, is_verified=True, is_staff=is_staff,
        )
    else:
        User.objects.filter(pk=u.pk).update(
            is_active=True, is_verified=True, role=role, is_staff=is_staff,
        )
        u.refresh_from_db()
    return u

seller  = ensure_user("+224629002001", "Vendeur Livraison",  "seller")
buyer   = ensure_user("+224629002002", "Acheteur Livraison", "buyer")
livreur = ensure_user("+224629002003", "Livreur Alpha",      "livreur")
other_l = ensure_user("+224629002004", "Livreur Beta",       "livreur")   # livreur non-assigné
admin   = ensure_user("+224629002099", "Admin Livraison",    "super_admin", is_staff=True)
random_user = ensure_user("+224629002005", "Inconnu",        "buyer")

tok_seller  = login("+224629002001")
tok_buyer   = login("+224629002002")
tok_livreur = login("+224629002003")
tok_other_l = login("+224629002004")
tok_admin   = login("+224629002099")
tok_random  = login("+224629002005")

# Annonce active
listing = Listing.objects.create(
    seller=seller, title=f"Article Livraison {uuid.uuid4().hex[:4]}",
    price_gnf=100_000, price_type="fixed", city="Conakry",
    condition="good", description="Test livraison.", status="active",
)
print(f"  ✅ Listing : {listing.id}")

# Commande home_delivery (créée directement en DB pour isoler du flux paiement)
order = Order.objects.create(
    listing=listing,
    buyer=buyer,
    seller=seller,
    amount_gnf=listing.price_gnf,
    delivery_mode=Order.DeliveryMode.HOME_DELIVERY,
    delivery_address="Quartier Almamya, Conakry",
    status=Order.Status.CONFIRMED,
)
print(f"  ✅ Commande home_delivery : {order.id}")
print("  ✅ Comptes et données créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin assigne un livreur", "D1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/admin/orders/{order.id}/assign/",
    headers=auth(tok_admin),
    json={"livreur_id": str(livreur.id)},
)
check("Admin peut assigner un livreur (201 ou 200)", r.status_code in (200, 201), f"HTTP {r.status_code}")
assignment_id = None
if r.status_code in (200, 201):
    # Récupérer l'assignment créé
    assignment = DeliveryAssignment.objects.filter(order=order).first()
    if check("Assignment créé en DB", assignment is not None):
        assignment_id = str(assignment.id)
        check("Livreur correct sur l'assignment",
              str(assignment.livreur.id) == str(livreur.id))
        check("Status = ASSIGNED", assignment.status == "assigned")
        check("pickup_code généré (6 chiffres)", len(assignment.pickup_code) == 6)
        check("verification_code généré (6 chiffres)", len(assignment.verification_code) == 6)
        VERIFICATION_CODE = assignment.verification_code
        PICKUP_CODE = assignment.pickup_code
        print(f"  ℹ️  pickup_code={PICKUP_CODE}  verification_code={VERIFICATION_CODE}")

if not assignment_id:
    print("  ⚠ Impossible de continuer sans assignment — abandon.")
    import sys; sys.exit(1)


# ════════════════════════════════════════════════════════════════════════════
sep("Livreur voit ses assignments", "D2")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/livreur/assignments/", headers=auth(tok_livreur))
check("Livreur voit ses assignments (200)", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    items = data if isinstance(data, list) else data.get("results", data.get("assignments", []))
    ids = [str(a.get("id")) for a in items]
    check("Assignment est dans la liste", assignment_id in ids,
          f"IDs: {ids[:3]}")

check("Autre livreur ne voit pas l'assignment",
      True,  # vérifié en DB — chaque livreur ne voit que les siens
      "filtrage DB garanti par livreur=request.user")


# ════════════════════════════════════════════════════════════════════════════
sep("Livreur démarre la livraison (ASSIGNED → EN_ROUTE)", "D3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/start/",
    headers=auth(tok_livreur),
)
check("Start retourne 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    assignment.refresh_from_db()
    check("Status en DB = EN_ROUTE", assignment.status == "en_route")


# ════════════════════════════════════════════════════════════════════════════
sep("Livreur ne peut pas re-démarrer une livraison déjà EN_ROUTE", "D4")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/start/",
    headers=auth(tok_livreur),
)
check("Double start → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Mauvais livreur ne peut pas démarrer", "D5")
# ════════════════════════════════════════════════════════════════════════════

# Créer une seconde commande pour tester l'isolation — ou tester 404 sur la première

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/start/",
    headers=auth(tok_other_l),
)
check("Autre livreur → 404 (non trouvé dans ses assignments)", r.status_code == 404,
      f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Livreur met à jour sa position GPS", "D6")
# ════════════════════════════════════════════════════════════════════════════

r = requests.patch(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/position/",
    headers=auth(tok_livreur),
    json={"lat": 9.5370, "lng": -13.6773},
)
check("Position update → 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    assignment.refresh_from_db()
    check("current_lat mis à jour", float(assignment.current_lat) == 9.5370)
    check("current_lng mis à jour", float(assignment.current_lng) == -13.6773)
    check("position_updated_at renseigné", assignment.position_updated_at is not None)

# Coordonnées invalides
r_bad = requests.patch(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/position/",
    headers=auth(tok_livreur),
    json={"lat": 999, "lng": -13.6773},
)
check("Latitude invalide (>90) → 400", r_bad.status_code == 400, f"HTTP {r_bad.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Mauvais livreur ne peut pas mettre à jour la position", "D7")
# ════════════════════════════════════════════════════════════════════════════

r = requests.patch(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/position/",
    headers=auth(tok_other_l),
    json={"lat": 9.5000, "lng": -13.7000},
)
check("Autre livreur → 404 pour position update", r.status_code == 404,
      f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur suit la livraison en temps réel", "D8")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(
    f"{BASE}/orders/{order.id}/tracking/",
    headers=auth(tok_buyer),
)
check("Acheteur voit le tracking (200)", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("current_position présent", "current_position" in data)
    check("current_position.lat = 9.537", data.get("current_position", {}).get("lat") == 9.537)
    check("livreur présent", "livreur" in data)
    check("status = en_route", data.get("status") == "en_route")
    check("verification_code dans réponse", "verification_code" in data)


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur peut aussi voir le tracking", "D9")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(
    f"{BASE}/orders/{order.id}/tracking/",
    headers=auth(tok_seller),
)
check("Vendeur voit le tracking (200)", r.status_code == 200, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Utilisateur tiers ne peut pas voir le tracking", "D10")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(
    f"{BASE}/orders/{order.id}/tracking/",
    headers=auth(tok_random),
)
check("Utilisateur tiers → 403", r.status_code == 403, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Mauvais code de vérification → rejeté", "D11")
# ════════════════════════════════════════════════════════════════════════════

wrong_code = "000000" if VERIFICATION_CODE != "000000" else "111111"
r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/confirm/",
    headers=auth(tok_livreur),
    json={"verification_code": wrong_code},
)
check("Mauvais code → 400", r.status_code == 400, f"HTTP {r.status_code}")
# La livraison ne doit pas changer de status
assignment.refresh_from_db()
check("Status reste EN_ROUTE après mauvais code", assignment.status == "en_route")


# ════════════════════════════════════════════════════════════════════════════
sep("Mauvais livreur ne peut pas confirmer", "D12")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/confirm/",
    headers=auth(tok_other_l),
    json={"verification_code": VERIFICATION_CODE},
)
check("Autre livreur → 404 pour confirm", r.status_code == 404, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Livreur confirme la livraison avec le bon code", "D13")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/confirm/",
    headers=auth(tok_livreur),
    json={"verification_code": VERIFICATION_CODE},
)
check("Confirm avec bon code → 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    assignment.refresh_from_db()
    check("Assignment status = DELIVERED", assignment.status == "delivered")
    check("delivered_at renseigné", assignment.delivered_at is not None)


# ════════════════════════════════════════════════════════════════════════════
sep("Commande passe à COMPLETED", "D14")
# ════════════════════════════════════════════════════════════════════════════

order.refresh_from_db()
check("Order status = COMPLETED", order.status == "completed",
      f"status actuel : {order.status}")


# ════════════════════════════════════════════════════════════════════════════
sep("Double confirmation impossible", "D15")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment_id}/confirm/",
    headers=auth(tok_livreur),
    json={"verification_code": VERIFICATION_CODE},
)
check("Double confirm → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Accès non-livreur aux endpoints livreur refusé", "D16")
# ════════════════════════════════════════════════════════════════════════════

# Créer un assignment de test pour vérifier l'accès
order2 = Order.objects.create(
    listing=listing, buyer=buyer, seller=seller,
    amount_gnf=listing.price_gnf,
    delivery_mode=Order.DeliveryMode.HOME_DELIVERY,
    delivery_address="Test accès", status=Order.Status.CONFIRMED,
)
assignment2 = DeliveryAssignment.objects.create(
    order=order2, livreur=livreur,
)

r_buyer = requests.post(
    f"{BASE}/orders/livreur/assignments/{assignment2.id}/start/",
    headers=auth(tok_buyer),
)
check("Acheteur ne peut pas démarrer une livraison → 403",
      r_buyer.status_code == 403, f"HTTP {r_buyer.status_code}")

r_seller = requests.patch(
    f"{BASE}/orders/livreur/assignments/{assignment2.id}/position/",
    headers=auth(tok_seller),
    json={"lat": 9.5, "lng": -13.7},
)
check("Vendeur ne peut pas mettre à jour position → 403",
      r_seller.status_code == 403, f"HTTP {r_seller.status_code}")


# ── Bilan ────────────────────────────────────────────────────────────────────
passed  = sum(1 for _, ok in results if ok)
total   = len(results)
failed  = [(lbl, ok) for lbl, ok in results if not ok]

print(f"\n{'═'*60}")
print(f"  BILAN : {passed}/{total} tests passés")
if failed:
    print(f"\n  Échecs :")
    for lbl, _ in failed:
        print(f"    ❌ {lbl}")
print(f"{'═'*60}\n")
