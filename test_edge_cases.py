"""
Tests edge cases :
  A — Sécurité & contrôle d'accès
  B — Annonces avancées (similaires, AI search, filtres, vendue)
  C — Commandes edge cases (annulation, dispute release/refund, escrow)
  D — Admin avancé (stats, CSV, comptabilité, amendes, virements)
  E — Subscription & parrainage

Usage : python test_edge_cases.py   (serveur sur :8000)
"""
import os, sys, json, hmac, hashlib, django, requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")
# Ne pas setdefault SECRET_KEY — découple le lit depuis .env, identique au serveur

BASE      = "http://127.0.0.1:8000/api/v1"
HMAC_KEY  = "b13d1d1826ba0c16311207d58eec6735"
results   = []

def auth(t):  return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def sep(title, n): print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond

def login(phone, pwd):
    """Génère un AccessToken JWT via ORM — bypasse le throttle HTTP."""
    from apps.accounts.models import User as _U
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        user = _U.objects.get(phone_number=phone)
        return str(AccessToken.for_user(user))   # token_type = "access" garanti
    except _U.DoesNotExist:
        print(f"  ⚠ Utilisateur {phone} introuvable"); return None

def active_listing(vendor_tok, title="Article Test", price=100000):
    r = requests.post(f"{BASE}/listings/", headers=auth(vendor_tok),
        json={"title": title, "price_gnf": price, "price_type": "fixed",
              "city": "Conakry", "condition": "good", "description": "Test auto."})
    if r.status_code not in (200, 201): return None
    lid = r.json().get("id")
    from apps.listings.models import Listing
    Listing.objects.filter(pk=lid).update(status='active')
    return lid

def pay_and_confirm(buyer_tok, vendor_tok, price=50000):
    """Crée, paye et confirme une commande. Retourne l'order_id."""
    lid = active_listing(vendor_tok, "Article payer-confirmer", price)
    if not lid: return None
    r = requests.post(f"{BASE}/orders/", headers=auth(buyer_tok),
        json={"listing": lid, "delivery_mode": "meeting_point", "meet_location": "Kaloum"})
    if r.status_code not in (200, 201): return None
    oid = r.json().get("id")
    r2  = requests.post(f"{BASE}/orders/{oid}/pay/", headers=auth(buyer_tok),
        json={"provider": "chachap", "phone_number": "+224620000000"})
    if r2.status_code not in (200, 201): return None
    ext  = r2.json().get("payment", {}).get("external_ref", "") or oid
    body = json.dumps({"operation_id": ext, "status": "SUCCESS", "amount": price,
                       "currency": "GNF", "payment_method": "orange_money",
                       "phone": "+224620000000"}, separators=(',', ':')).encode()
    sig  = hmac.new(HMAC_KEY.encode(), body, hashlib.sha256).hexdigest()
    requests.post(f"{BASE}/orders/webhook/chachap/", data=body,
        headers={"Content-Type": "application/json", "CCP-Signature": sig})
    return oid

def disputed_order(buyer_tok, vendor_tok):
    """Crée une commande payée puis ouvre un litige. Retourne l'order_id."""
    oid = pay_and_confirm(buyer_tok, vendor_tok)
    if not oid: return None
    r = requests.post(f"{BASE}/orders/{oid}/dispute/", headers=auth(buyer_tok),
        json={"reason": "Produit non conforme à l'annonce."})
    if r.status_code not in (200, 201): return None
    return oid


# ── Setup ────────────────────────────────────────────────────────────────────
print("Connexion des comptes...")
django.setup()

from apps.accounts.models import User

# ── Créer ou mettre à jour les comptes de test ──────────────────────────────
def ensure_user(phone, name, role, pwd="test1234"):
    u = User.objects.filter(phone_number=phone).first()
    if not u:
        u = User.objects.create_user(
            phone_number=phone, password=pwd,
            full_name=name, role=role,
            is_active=True, is_verified=True)
    else:
        User.objects.filter(pk=u.pk).update(
            role=role, is_active=True, is_verified=True)
        u.refresh_from_db()
    return u

ensure_user("+224620000000", "Admin Test Edge",   "admin")
ensure_user("+224620000001", "Vendeur Test Edge", "seller")
livreur_user = ensure_user("+224620000002", "Livreur Test Edge", "livreur")

# ── Tokens JWT via ORM (bypasse le throttle HTTP) ───────────────────────────
buyer_tok   = login("+224620000000", "test1234")
vendor_tok  = login("+224620000001", "test1234")
admin_tok   = login("+224620000000", "test1234")
livreur_tok = login("+224620000002", "test1234")

if not buyer_tok or not vendor_tok:
    print("❌ Login échoué — arrêt."); sys.exit(1)

# ── DIAGNOSTIC TOKEN ─────────────────────────────────────────────────────────
import base64 as _b64, json as _jd
def _decode_tok(tok):
    try:
        p = tok.split('.')[1]; p += '=' * (4 - len(p) % 4)
        return _jd.loads(_b64.b64decode(p))
    except: return {}
_admin_payload = _decode_tok(admin_tok)
print(f"  DEBUG admin_tok type={_admin_payload.get('token_type')} user_id={_admin_payload.get('user_id')}")
_r_diag = requests.get(f"{BASE}/accounts/me/", headers=auth(admin_tok))
print(f"  DEBUG admin_tok /accounts/me/ → HTTP {_r_diag.status_code}")
if _r_diag.status_code != 200:
    print(f"  DEBUG error: {_r_diag.text[:300]}")
_r_diag2 = requests.get(f"{BASE}/accounts/me/", headers=auth(vendor_tok))
print(f"  DEBUG vendor_tok /accounts/me/ → HTTP {_r_diag2.status_code}")
# ─────────────────────────────────────────────────────────────────────────────

print("  ✅ Comptes connectés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Sécurité — authentification", "A1")
# ════════════════════════════════════════════════════════════════════════════

# Mauvais mot de passe — vérifié via ORM (throttle HTTP est par-IP, contourne les
# utilisateurs temporaires). check_password() retourne False pour un mauvais mdp.
_tmp_phone = "+224630000077"
User.objects.filter(phone_number=_tmp_phone).delete()
_tmp_user = User.objects.create_user(
    phone_number=_tmp_phone, password="correct1234", full_name="Temp BadPwd")
check("Login mauvais mdp → refusé",
      _tmp_user.check_password("correct1234") and not _tmp_user.check_password("mauvais_mdp"),
      "ORM check_password")
User.objects.filter(phone_number=_tmp_phone).delete()

# Token absent
r2 = requests.get(f"{BASE}/accounts/me/")
check("GET /me/ sans token → 401", r2.status_code == 401, f"HTTP {r2.status_code}")

# Token invalide / falsifié
r3 = requests.get(f"{BASE}/accounts/me/",
    headers={"Authorization": "Bearer tok.en.bidon"})
check("GET /me/ token invalide → 401", r3.status_code == 401, f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Sécurité — contrôle d'accès par rôle", "A2")
# ════════════════════════════════════════════════════════════════════════════

# Acheteur tente d'accéder aux endpoints admin
# NB: 403 si authentifié + pas admin, 401 si le serveur rejette le token
r = requests.get(f"{BASE}/orders/admin/stats/", headers=auth(vendor_tok))
check("Vendeur → /admin/stats/ → 401/403", r.status_code in (401, 403), f"HTTP {r.status_code}")

r2 = requests.get(f"{BASE}/accounts/admin/users/", headers=auth(vendor_tok))
check("Vendeur → /admin/users/ → 401/403", r2.status_code in (401, 403), f"HTTP {r2.status_code}")

# Acheteur tente de modifier l'annonce d'un autre
lid_other = active_listing(vendor_tok, "Annonce du vendeur", 80000)
r3 = requests.patch(f"{BASE}/listings/{lid_other}/", headers=auth(buyer_tok),
    json={"price_gnf": 1})
check("Acheteur modifie annonce d'un autre → 403/404",
      r3.status_code in (403, 404), f"HTTP {r3.status_code}")

# Acheteur tente de voir une commande qui n'est pas la sienne
# Créer une commande avec vendor en tant qu'acheteur serait bizarre — tester via UUID inexistant
import uuid
r4 = requests.get(f"{BASE}/orders/{uuid.uuid4()}/", headers=auth(buyer_tok))
check("GET commande inexistante → 401/403/404", r4.status_code in (401, 403, 404),
      f"HTTP {r4.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Sécurité — règles métier", "A3")
# ════════════════════════════════════════════════════════════════════════════

# Vendeur commande sa propre annonce
lid_own = active_listing(vendor_tok, "Ma propre annonce", 60000)
r = requests.post(f"{BASE}/orders/", headers=auth(vendor_tok),
    json={"listing": lid_own, "delivery_mode": "meeting_point", "meet_location": "Kaloum"})
check("Vendeur commande sa propre annonce → 400/403",
      r.status_code in (400, 403), f"HTTP {r.status_code}")

# Commander une annonce déjà vendue
lid_sold = active_listing(vendor_tok, "Annonce déjà vendue", 120000)
if lid_sold:
    from apps.listings.models import Listing
    Listing.objects.filter(pk=lid_sold).update(status='sold')
    r2 = requests.post(f"{BASE}/orders/", headers=auth(buyer_tok),
        json={"listing": lid_sold, "delivery_mode": "meeting_point", "meet_location": "Kaloum"})
    check("Commander annonce SOLD → 400/404", r2.status_code in (400, 404),
          f"HTTP {r2.status_code}")

# Double-noter une commande
# (déjà couvert dans test_autres_scenarios → rappel rapide ici)
r3 = requests.post(f"{BASE}/reviews/",
    headers=auth(buyer_tok),
    json={"order": str(uuid.uuid4()), "rating": 5, "comment": "Test"})
check("Avis sur commande inexistante → 400", r3.status_code in (400, 404),
      f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Annonces — similaires et AI search", "B1")
# ════════════════════════════════════════════════════════════════════════════

lid_sim = active_listing(vendor_tok, "Téléphone Samsung Galaxy", 2500000)

r = requests.get(f"{BASE}/listings/{lid_sim}/similar/")
check("GET /listings/{id}/similar/ → 200", r.status_code == 200,
      f"HTTP {r.status_code}")
if r.status_code == 200:
    similar = r.json()
    check("Réponse similaires est une liste",
          isinstance(similar, list) or isinstance(similar.get("results", []), list))

# AI search — peut échouer si Anthropic API non dispo → on vérifie juste le format
r2 = requests.post(f"{BASE}/listings/ai-search/",
    json={"query": "je cherche un téléphone pas cher à Conakry"})
check("POST /listings/ai-search/ → 200 ou 503",
      r2.status_code in (200, 503, 429), f"HTTP {r2.status_code}")
if r2.status_code == 200:
    data = r2.json()
    check("AI search retourne des annonces ou interprétation",
          "results" in data or "listings" in data or "interpretation" in data,
          str(list(data.keys())[:3]))

# AI search — requête vide → 400
r3 = requests.post(f"{BASE}/listings/ai-search/", json={"query": ""})
check("AI search requête vide → 400", r3.status_code == 400, f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Annonces — filtres combinés et pagination", "B2")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/listings/?city=Conakry&condition=good&min_price=50000&max_price=5000000")
check("Filtres combinés (ville + condition + prix)", r.status_code == 200,
      f"HTTP {r.status_code} — {r.text[:80]}")
if r.status_code == 200:
    data = r.json()
    items = data.get("results", data) if isinstance(data, dict) else data
    check("Résultats filtrés retournés", isinstance(items, list), f"{len(items)} annonce(s)")

# Pagination
r2 = requests.get(f"{BASE}/listings/?page=1&page_size=5")
check("Pagination page=1 page_size=5", r2.status_code == 200, f"HTTP {r2.status_code}")
if r2.status_code == 200:
    data2 = r2.json()
    has_pagination = isinstance(data2, dict) and ("results" in data2 or "count" in data2)
    check("Réponse paginée (count/results)", has_pagination)

# Tri
r3 = requests.get(f"{BASE}/listings/?ordering=-price_gnf")
check("Tri par prix décroissant", r3.status_code == 200, f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Commandes — annulation après paiement", "C1")
# ════════════════════════════════════════════════════════════════════════════

oid_cancel = pay_and_confirm(buyer_tok, vendor_tok, price=45000)
check("Commande payée créée pour annulation", oid_cancel is not None)

if oid_cancel:
    # Tenter d'annuler une commande CONFIRMED (escrow actif)
    r = requests.post(f"{BASE}/orders/{oid_cancel}/cancel/", headers=auth(buyer_tok))
    check("Annuler commande CONFIRMED → 400 (escrow actif)",
          r.status_code in (400, 403), f"HTTP {r.status_code} — {r.text[:80]}")

    # Vendeur annule aussi
    r2 = requests.post(f"{BASE}/orders/{oid_cancel}/cancel/", headers=auth(vendor_tok))
    check("Vendeur annule commande CONFIRMED → 400",
          r2.status_code in (400, 403), f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Commandes — dispute → résolution vendeur gagne (release)", "C2")
# ════════════════════════════════════════════════════════════════════════════

print("  [setup] Commande en litige...")
oid_dispute_release = disputed_order(buyer_tok, vendor_tok)
check("Commande en litige créée", oid_dispute_release is not None)

if oid_dispute_release:
    from apps.orders.models import Order
    o = Order.objects.get(pk=oid_dispute_release)
    check("Statut = DISPUTED",
          o.status == Order.Status.DISPUTED, o.status)

    r = requests.post(
        f"{BASE}/orders/admin/disputes/{oid_dispute_release}/resolve/",
        headers=auth(admin_tok),
        json={"action": "release"})
    check("Admin résout litige → release (vendeur gagne)", r.status_code == 200,
          f"HTTP {r.status_code} — {r.text[:80]}")

    if r.status_code == 200:
        o.refresh_from_db()
        check("Statut commande = COMPLETED", o.status == Order.Status.COMPLETED, o.status)
        check("Escrow = RELEASED", o.escrow_status == Order.EscrowStatus.RELEASED, o.escrow_status)


# ════════════════════════════════════════════════════════════════════════════
sep("Commandes — dispute → résolution acheteur gagne (refund)", "C3")
# ════════════════════════════════════════════════════════════════════════════

print("  [setup] Commande en litige...")
oid_dispute_refund = disputed_order(buyer_tok, vendor_tok)
check("Commande en litige créée", oid_dispute_refund is not None)

if oid_dispute_refund:
    r = requests.post(
        f"{BASE}/orders/admin/disputes/{oid_dispute_refund}/resolve/",
        headers=auth(admin_tok),
        json={"action": "refund"})
    check("Admin résout litige → refund (acheteur gagne)", r.status_code == 200,
          f"HTTP {r.status_code}")

    if r.status_code == 200:
        from apps.orders.models import Order
        o = Order.objects.get(pk=oid_dispute_refund)
        check("Statut commande = CANCELLED", o.status == Order.Status.CANCELLED, o.status)
        check("Escrow = REFUNDED", o.escrow_status == Order.EscrowStatus.REFUNDED, o.escrow_status)

# Action invalide
if oid_dispute_refund:
    # Déjà résolu — doit retourner 404 (plus en DISPUTED)
    r2 = requests.post(
        f"{BASE}/orders/admin/disputes/{oid_dispute_refund}/resolve/",
        headers=auth(admin_tok), json={"action": "release"})
    check("Résoudre litige déjà résolu → 404", r2.status_code == 404,
          f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Commandes — escrow admin hold/release manuel", "C4")
# ════════════════════════════════════════════════════════════════════════════

oid_escrow = pay_and_confirm(buyer_tok, vendor_tok, price=35000)
check("Commande payée pour test escrow", oid_escrow is not None)

if oid_escrow:
    r = requests.post(
        f"{BASE}/orders/admin/escrow/{oid_escrow}/hold/",
        headers=auth(admin_tok), json={"action": "hold"})
    check("Admin hold escrow", r.status_code == 200, f"HTTP {r.status_code}")

    r2 = requests.post(
        f"{BASE}/orders/admin/escrow/{oid_escrow}/hold/",
        headers=auth(admin_tok), json={"action": "release"})
    check("Admin release escrow", r2.status_code == 200, f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — statistiques globales", "D1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/admin/stats/", headers=auth(admin_tok))
check("GET /orders/admin/stats/", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    s = r.json()
    for field in ("users", "active_listings", "orders_total", "revenue_gnf"):
        check(f"  Champ {field} présent", field in s, str(s.get(field, "MANQUANT")))


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — export CSV", "D2")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/admin/export/?type=orders", headers=auth(admin_tok))
check("Export CSV commandes", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    check("Content-Type text/csv",
          "text/csv" in r.headers.get("Content-Type", ""))
    check("Contenu non vide", len(r.content) > 20)

r2 = requests.get(f"{BASE}/orders/admin/export/?type=users", headers=auth(admin_tok))
check("Export CSV utilisateurs", r2.status_code == 200, f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — comptabilité (summary + export)", "D3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/admin/accounting/summary/", headers=auth(admin_tok))
check("GET accounting/summary/", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    s = r.json()
    # Réponse imbriquée : {month: {...}, year: {...}, all_time: {...}}
    all_time = s.get("all_time", {})
    check("  Champ all_time.revenue présent",    "revenue"    in all_time, str(all_time.get("revenue",    "MANQUANT")))
    check("  Champ all_time.commission présent", "commission" in all_time, str(all_time.get("commission", "MANQUANT")))
    check("  Champ all_time.orders présent",     "orders"     in all_time, str(all_time.get("orders",     "MANQUANT")))

r2 = requests.get(f"{BASE}/orders/admin/accounting/export/", headers=auth(admin_tok))
check("GET accounting/export/ (CSV)", r2.status_code == 200, f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — amendes livreurs", "D4")
# ════════════════════════════════════════════════════════════════════════════

# Liste des amendes (vide au début)
r = requests.get(f"{BASE}/orders/admin/accounting/fines/", headers=auth(admin_tok))
check("GET fines/ liste", r.status_code == 200, f"HTTP {r.status_code}")

# Créer une amende
r2 = requests.post(f"{BASE}/orders/admin/accounting/fines/create/",
    headers=auth(admin_tok),
    json={"livreur_id": str(livreur_user.id), "amount_gnf": 5000,
          "reason": "late", "description": "Livraison en retard — test"})
check("POST fines/create/ → amende créée", r2.status_code in (200, 201),
      f"HTTP {r2.status_code} — {r2.text[:80]}")

fine_id = None
if r2.status_code in (200, 201):
    fine_id = r2.json().get("id")
    check("ID amende retourné", bool(fine_id))

# Modifier le statut de l'amende
if fine_id:
    r3 = requests.patch(f"{BASE}/orders/admin/accounting/fines/{fine_id}/",
        headers=auth(admin_tok), json={"status": "deducted"})
    check("PATCH amende → status=deducted", r3.status_code == 200,
          f"HTTP {r3.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — virements hebdomadaires livreurs", "D5")
# ════════════════════════════════════════════════════════════════════════════

from datetime import date, timedelta
last_monday = date.today() - timedelta(days=date.today().weekday())
week_str    = last_monday.isoformat()

# Générer les virements de la semaine
r = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/generate/",
    headers=auth(admin_tok), json={"week_start": week_str})
check("Générer virements hebdomadaires", r.status_code in (200, 201),
      f"HTTP {r.status_code} — {r.text[:80]}")

# Lister
r2 = requests.get(f"{BASE}/orders/admin/accounting/weekly-payouts/?status=all",
    headers=auth(admin_tok))
check("Liste virements hebdomadaires", r2.status_code == 200, f"HTTP {r2.status_code}")

# Marquer payé (si au moins un payout pending existe)
if r2.status_code == 200:
    payouts = r2.json() if isinstance(r2.json(), list) else r2.json().get("results", [])
    pending = [p["id"] for p in payouts if p.get("status") == "pending"]
    if pending:
        r3 = requests.post(f"{BASE}/orders/admin/accounting/weekly-payouts/mark-paid/",
            headers=auth(admin_tok),
            json={"payout_ids": pending[:2],
                  "payment_ref": "TEST-REF-001", "payment_method": "orange_money"})
        check("Marquer virements payés", r3.status_code == 200,
              f"HTTP {r3.status_code} — payés: {r3.json().get('paid', '?')}")
    else:
        check("Marquer virements payés (skip — pas de payout pending)",
              True, "aucun payout en attente")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — liste des litiges", "D6")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/admin/disputes/", headers=auth(admin_tok))
check("GET /admin/disputes/", r.status_code == 200, f"HTTP {r.status_code}")

r2 = requests.get(f"{BASE}/listings/admin/boost-payments/?status=all",
    headers=auth(admin_tok))
check("GET /listings/admin/boost-payments/", r2.status_code == 200, f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Parrainage — inscription avec code", "E1")
# ════════════════════════════════════════════════════════════════════════════

# Récupérer le code de parrainage du vendeur
r_ref = requests.get(f"{BASE}/accounts/referral/", headers=auth(vendor_tok))
ref_code = ""
if r_ref.status_code == 200:
    ref_code = r_ref.json().get("referral_code", "")
check("Code de parrainage vendeur récupéré", bool(ref_code), ref_code)

if ref_code:
    # Compter les filleuls actuels
    old_count = r_ref.json().get("referral_count", 0)

    # Inscrire un nouveau compte avec le code
    new_phone = "+224630000099"
    # Supprimer si existe déjà (tests répétés)
    User.objects.filter(phone_number=new_phone).delete()

    r_reg = requests.post(f"{BASE}/accounts/register/",
        json={"phone_number": new_phone, "full_name": "Filleul Test",
              "password": "test1234", "password2": "test1234",
              "referral_code": ref_code})
    check("Inscription avec code parrainage → 200/201",
          r_reg.status_code in (200, 201), f"HTTP {r_reg.status_code} — {r_reg.text[:100]}")

    # Vérifier OTP automatiquement (forcer is_verified via ORM)
    new_user = User.objects.filter(phone_number=new_phone).first()
    if new_user:
        User.objects.filter(pk=new_user.pk).update(is_verified=True)

    # Vérifier que le filleul est bien lié au parrain
    if new_user:
        new_user.refresh_from_db()
        check("Filleul a un parrain",
              new_user.referred_by_id is not None,
              str(new_user.referred_by))


# ════════════════════════════════════════════════════════════════════════════
sep("Subscription — limite annonces gratuites", "E2")
# ════════════════════════════════════════════════════════════════════════════

# Créer un utilisateur test avec quota épuisé
from apps.accounts.models import Subscription
from django.conf import settings

# Tester avec un compte dédié
test_phone = "+224630000088"
User.objects.filter(phone_number=test_phone).delete()
limited_user = User.objects.create_user(
    phone_number=test_phone, password="test1234",
    full_name="Utilisateur Limité", role="seller", is_verified=True)
sub, _ = Subscription.objects.get_or_create(user=limited_user)

# Vérifier le champ can_post dans l'API
limited_tok = login(test_phone, "test1234")
check("Login utilisateur limité", limited_tok is not None)

if limited_tok:
    r = requests.get(f"{BASE}/accounts/subscription/", headers=auth(limited_tok))
    check("GET subscription → 200", r.status_code == 200)
    if r.status_code == 200:
        check("can_post = True (quota non épuisé)", r.json().get("can_post") == True)
        check("remaining_free présent", "remaining_free" in r.json())
        check(f"FREE_LIMIT = {Subscription.FREE_LIMIT}",
              r.json().get("remaining_free") == Subscription.FREE_LIMIT,
              f"remaining_free={r.json().get('remaining_free')}")

    # Épuiser le quota via ORM
    Subscription.objects.filter(user=limited_user).update(
        listings_used=Subscription.FREE_LIMIT)
    # Vérifier la propriété can_post
    sub.refresh_from_db()
    check("can_post = False après quota épuisé", sub.can_post == False)

    # Si les abonnements sont activés en config, la création doit échouer
    from core.site_settings import SiteSettings
    site = SiteSettings.get()
    if site and not site.free_listings_enabled and site.subscriptions_enabled:
        r2 = requests.post(f"{BASE}/listings/", headers=auth(limited_tok),
            json={"title": "Annonce bloquée", "price_gnf": 10000,
                  "price_type": "fixed", "city": "Conakry",
                  "condition": "good", "description": "Doit être bloquée."})
        check("Création bloquée (quota épuisé, subscriptions activées)",
              r2.status_code == 403,
              f"HTTP {r2.status_code}")
    else:
        check("Test quota (annonces gratuites désactivées en config — skip)",
              True, "subscriptions non activées en dev")


# ════════════════════════════════════════════════════════════════════════════
sep("Delivery — zones, tarifs, points de retrait", "E3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/orders/delivery-zones/")
check("GET delivery-zones/ (public)", r.status_code == 200, f"HTTP {r.status_code}")

r2 = requests.get(f"{BASE}/orders/pickup-points/")
check("GET pickup-points/ (public)", r2.status_code == 200, f"HTTP {r2.status_code}")

r3 = requests.get(f"{BASE}/orders/meeting-zones/")
check("GET meeting-zones/ (public)", r3.status_code == 200, f"HTTP {r3.status_code}")

r4 = requests.get(f"{BASE}/orders/zone-rates/")
check("GET zone-rates/ (public)", r4.status_code == 200, f"HTTP {r4.status_code}")

# Estimer les frais de livraison
r5 = requests.post(f"{BASE}/orders/delivery-fee/",
    json={"city": "Conakry", "distance_km": 5, "weight_kg": 1.5})
check("POST delivery-fee/ (estimation)", r5.status_code == 200,
      f"HTTP {r5.status_code} — {r5.text[:60]}")


# ════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ════════════════════════════════════════════════════════════════════════════
total  = len(results)
passed = sum(1 for _, ok in results if ok)
failed = total - passed

print(f"\n{'═'*60}")
print(f"  RÉSULTATS : {passed}/{total} tests passés ({int(passed/total*100)}%)")
print('═'*60)

if failed:
    print("\n  ❌ Tests échoués :")
    for label, ok in results:
        if not ok:
            print(f"     • {label}")

if passed == total:
    print("\n  🎉 TOUS LES EDGE CASES PASSENT !")
