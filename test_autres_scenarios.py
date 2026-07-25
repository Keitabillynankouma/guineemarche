"""
Tests : comptes, annonces, avis, messagerie, notifications, admin, boost, favoris.
Usage : python test_autres_scenarios.py  (serveur doit tourner)
"""
import os, sys, json, django, requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DEBUG", "True")
# Ne pas setdefault SECRET_KEY — découple le lit depuis .env, identique au serveur

BASE = "http://127.0.0.1:8000/api/v1"
results = []

def auth(t):  return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}
def jauth(t): return {"Authorization": f"Bearer {t}"}  # sans Content-Type pour multipart

def login(phone, pwd):
    """Génère un AccessToken JWT via ORM — bypasse le throttle HTTP."""
    from apps.accounts.models import User as _U
    from rest_framework_simplejwt.tokens import AccessToken
    try:
        user = _U.objects.get(phone_number=phone)
        return str(AccessToken.for_user(user))
    except _U.DoesNotExist:
        print(f"  ❌ Utilisateur {phone} introuvable"); return None

def check(label, cond, detail=""):
    icon = "✅" if cond else "❌"
    print(f"  {icon} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, cond))
    return cond

def sep(title, n):
    print(f"\n{'═'*60}\n  SCÉNARIO {n} — {title}\n{'═'*60}")

def active_listing(vendor_tok, title="Annonce Test", price=100000):
    r = requests.post(f"{BASE}/listings/", headers=auth(vendor_tok),
        json={"title": title, "price_gnf": price, "price_type": "fixed",
              "city": "Conakry", "condition": "good", "description": "Description test."})
    if r.status_code not in (200, 201): return None
    lid = r.json().get("id")
    from apps.listings.models import Listing
    Listing.objects.filter(pk=lid).update(status='active')
    return lid

def complete_order(buyer_tok, vendor_tok, admin_tok, price=100000):
    """Crée une commande complétée — prérequis pour les avis."""
    import hmac, hashlib
    HMAC_KEY = "b13d1d1826ba0c16311207d58eec6735"
    lid = active_listing(vendor_tok, "Article pour avis", price)
    if not lid: return None
    r = requests.post(f"{BASE}/orders/", headers=auth(buyer_tok),
        json={"listing": lid, "delivery_mode": "meeting_point",
              "meet_location": "Kaloum"})
    if r.status_code not in (200, 201): return None
    oid = r.json().get("id")
    # Payer
    r2 = requests.post(f"{BASE}/orders/{oid}/pay/",
        headers=auth(buyer_tok), json={"provider": "chachap", "phone_number": "+224620000000"})
    if r2.status_code not in (200, 201): return None
    ext = r2.json().get("payment", {}).get("external_ref", "") or oid
    body = json.dumps({"operation_id": ext, "status": "SUCCESS", "amount": price,
                       "currency": "GNF", "payment_method": "orange_money",
                       "phone": "+224620000000"}, separators=(',', ':')).encode()
    sig = hmac.new(HMAC_KEY.encode(), body, hashlib.sha256).hexdigest()
    requests.post(f"{BASE}/orders/webhook/chachap/", data=body,
        headers={"Content-Type": "application/json", "CCP-Signature": sig})
    # Confirmer réception
    requests.post(f"{BASE}/orders/{oid}/confirm-receipt/", headers=auth(buyer_tok))
    return oid


# ── Setup ────────────────────────────────────────────────────────────────────
print("Connexion des comptes...")
django.setup()
buyer_tok  = login("+224620000000", "test1234")
vendor_tok = login("+224620000001", "test1234")
admin_tok  = login("+224620000000", "test1234")
if not buyer_tok or not vendor_tok:
    print("❌ Échec login — arrêt."); sys.exit(1)
print("  ✅ Tous connectés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Profil utilisateur — lecture et modification", 1)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/accounts/me/", headers=auth(buyer_tok))
check("GET /me/ retourne le profil", r.status_code == 200)
if r.status_code == 200:
    me = r.json()
    check("Champ phone_number présent", "phone_number" in me)
    check("Champ full_name présent",    "full_name" in me)
    check("Champ role présent",         "role" in me)

r2 = requests.patch(f"{BASE}/accounts/me/", headers=auth(buyer_tok),
    json={"full_name": "Buyer Test Modifié", "city": "Conakry"})
check("PATCH /me/ — mise à jour profil", r2.status_code == 200,
      f"HTTP {r2.status_code}")

r3 = requests.get(f"{BASE}/accounts/me/", headers=auth(buyer_tok))
if r3.status_code == 200:
    check("full_name mis à jour", r3.json().get("full_name") == "Buyer Test Modifié",
          r3.json().get("full_name"))


# ════════════════════════════════════════════════════════════════════════════
sep("Changement de mot de passe", 2)
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/accounts/change-password/", headers=auth(vendor_tok),
    json={"old_password": "test1234", "new_password": "test1234"})  # remettre le même
check("Changement de mot de passe (même mdp)", r.status_code in (200, 400),
      f"HTTP {r.status_code}")  # 400 si mdp identique, 200 si accepté


# ════════════════════════════════════════════════════════════════════════════
sep("Annonces — CRUD, recherche, filtres, favoris", 3)
# ════════════════════════════════════════════════════════════════════════════

# Créer
lid = active_listing(vendor_tok, "iPhone 13 Pro test", 3500000)
check("Annonce créée", lid is not None)

# Lire
r = requests.get(f"{BASE}/listings/{lid}/")
check("GET annonce publique (sans auth)", r.status_code == 200)
if r.status_code == 200:
    lst = r.json()
    check("Champ titre présent",     "title" in lst)
    check("Champ price_gnf présent", "price_gnf" in lst)
    check("Champ condition présent", "condition" in lst)

# Mettre à jour
r2 = requests.patch(f"{BASE}/listings/{lid}/", headers=auth(vendor_tok),
    json={"price_gnf": 3200000, "description": "Description mise à jour."})
check("PATCH annonce (vendeur)", r2.status_code == 200, f"HTTP {r2.status_code}")
if r2.status_code == 200:
    check("Prix mis à jour", r2.json().get("price_gnf") == 3200000)

# Recherche texte
r3 = requests.get(f"{BASE}/listings/?search=iPhone")
check("Recherche par mot-clé", r3.status_code == 200)
if r3.status_code == 200:
    hits = r3.json().get("results", r3.json() if isinstance(r3.json(), list) else [])
    check("Résultats trouvés pour 'iPhone'", len(hits) > 0, f"{len(hits)} résultat(s)")

# Filtre par ville
r4 = requests.get(f"{BASE}/listings/?city=Conakry")
check("Filtre par ville (Conakry)", r4.status_code == 200)

# Filtre par prix
r5 = requests.get(f"{BASE}/listings/?price_min=100000&price_max=5000000")
check("Filtre par fourchette de prix", r5.status_code == 200)

# Mes annonces
r6 = requests.get(f"{BASE}/listings/my/", headers=auth(vendor_tok))
check("Mes annonces (vendeur)", r6.status_code == 200)
if r6.status_code == 200:
    my_items = r6.json().get("results", r6.json() if isinstance(r6.json(), list) else [])
    check("Au moins 1 annonce dans Mes annonces", len(my_items) > 0, f"{len(my_items)} annonce(s)")

# Favoris
r7 = requests.post(f"{BASE}/listings/{lid}/favorite/", headers=auth(buyer_tok))
check("Ajouter en favori", r7.status_code in (200, 201), f"HTTP {r7.status_code}")
if r7.status_code in (200, 201):
    check("Réponse is_favorited=True", r7.json().get("is_favorited") == True)

r8 = requests.get(f"{BASE}/listings/favorites/", headers=auth(buyer_tok))
check("Liste des favoris", r8.status_code == 200)
if r8.status_code == 200:
    # FavoriteSerializer : {'id', 'listing': {...}, 'listing_id': ..., 'created_at'}
    favs = r8.json().get("results", r8.json() if isinstance(r8.json(), list) else [])
    check("Favori présent dans la liste",
          any(str(f.get("listing", {}).get("id", "")) == str(lid) for f in favs),
          f"{len(favs)} favori(s)")

# Toggle favori (retire)
r9 = requests.post(f"{BASE}/listings/{lid}/favorite/", headers=auth(buyer_tok))
check("Toggle favori (retirer)", r9.status_code in (200, 204), f"HTTP {r9.status_code}")
if r9.status_code in (200, 204) and r9.content:
    check("Réponse is_favorited=False", r9.json().get("is_favorited") == False)

# Signaler une annonce (reason doit être fraud|duplicate|prohibited|wrong_cat|other)
r10 = requests.post(f"{BASE}/listings/report/", headers=auth(buyer_tok),
    json={"listing": lid, "reason": "fraud", "note": "Test signalement automatisé"})
check("Signalement annonce", r10.status_code in (200, 201), f"HTTP {r10.status_code} — {r10.text[:80]}")


# ════════════════════════════════════════════════════════════════════════════
sep("Catégories et banners", 4)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/listings/categories/")
check("Liste des catégories (public)", r.status_code == 200)
cats = r.json().get("results", r.json() if isinstance(r.json(), list) else [])
check("Catégories retournées", isinstance(cats, list), f"{len(cats)} catégorie(s)")

r2 = requests.get(f"{BASE}/listings/banners/")
check("Liste des banners (public)", r2.status_code == 200)


# ════════════════════════════════════════════════════════════════════════════
sep("Boost annonce (espèces)", 5)
# ════════════════════════════════════════════════════════════════════════════

lid_boost = active_listing(vendor_tok, "Annonce à booster", 250000)
check("Annonce créée pour boost", lid_boost is not None)

boost_payment_id = None
if lid_boost:
    r = requests.post(f"{BASE}/listings/{lid_boost}/boost/", headers=auth(vendor_tok),
        json={"days": 7, "provider": "cash"})
    # Cash → 202 Accepted, en attente validation (pas d'activation immédiate)
    check("Boost 7 jours (espèces) → 202 en attente",
          r.status_code == 202,
          f"HTTP {r.status_code} — {r.text[:100]}")
    if r.status_code == 202:
        data = r.json()
        check("pending=True dans la réponse",    data.get("pending") == True)
        check("boost_payment_id retourné",       bool(data.get("boost_payment_id")))
        boost_payment_id = data.get("boost_payment_id")
        # L'annonce ne doit PAS encore être boostée
        r2 = requests.get(f"{BASE}/listings/{lid_boost}/")
        check("Annonce PAS encore boostée (en attente)", r2.json().get("is_boosted") == False)

    # Admin approuve le paiement espèces → activation
    if boost_payment_id:
        r3 = requests.post(
            f"{BASE}/listings/admin/boost-payments/{boost_payment_id}/approve/",
            headers=auth(admin_tok))
        check("Admin approuve boost espèces → HTTP 200", r3.status_code == 200,
              f"HTTP {r3.status_code} — {r3.text[:80]}")
        if r3.status_code == 200:
            r4 = requests.get(f"{BASE}/listings/{lid_boost}/")
            check("Annonce maintenant boostée après approbation admin",
                  r4.json().get("is_boosted") == True)
            check("Date expiration boost définie", bool(r4.json().get("expires_at")))


# ════════════════════════════════════════════════════════════════════════════
sep("Messagerie — conversation et messages", 6)
# ════════════════════════════════════════════════════════════════════════════

lid_msg = active_listing(vendor_tok, "Article pour messagerie", 80000)

# Démarrer une conversation acheteur → vendeur sur une annonce
r = requests.post(f"{BASE}/messaging/start/", headers=auth(buyer_tok),
    json={"listing_id": lid_msg,
          "message": "Bonjour, est-ce que l'article est encore disponible ?"})
check("Démarrer une conversation", r.status_code in (200, 201),
      f"HTTP {r.status_code}")

conv_id = None
if r.status_code in (200, 201):
    # Réponse : {'conversation': {...}, 'message': {...}}
    conv_id = (r.json().get("conversation") or {}).get("id") \
              or r.json().get("id") \
              or r.json().get("conversation_id")
    check("ID de conversation retourné", bool(conv_id))

    # Envoyer un 2e message (le 1er a été envoyé dans start/)
    r2 = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(buyer_tok),
        json={"content": "Quel est votre meilleur prix ?"})
    check("Envoyer un message (acheteur)", r2.status_code in (200, 201),
          f"HTTP {r2.status_code}")

    # Répondre côté vendeur
    r3 = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(vendor_tok),
        json={"content": "Oui, disponible ! Quel jour vous convenait ?"})
    check("Répondre au message (vendeur)", r3.status_code in (200, 201),
          f"HTTP {r3.status_code}")

    # Lire les messages
    r4 = requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(buyer_tok))
    check("Lire les messages de la conversation", r4.status_code == 200,
          f"HTTP {r4.status_code}")
    if r4.status_code == 200:
        msgs = r4.json().get("results", r4.json() if isinstance(r4.json(), list) else [])
        check("Au moins 2 messages dans la conversation", len(msgs) >= 2,
              f"{len(msgs)} message(s)")

# Lister les conversations
r5 = requests.get(f"{BASE}/messaging/", headers=auth(buyer_tok))
check("Lister les conversations (acheteur)", r5.status_code == 200,
      f"HTTP {r5.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Avis — noter vendeur et acheteur après commande complétée", 7)
# ════════════════════════════════════════════════════════════════════════════

print("  [setup] Création d'une commande complétée pour les avis...")
oid_review = complete_order(buyer_tok, vendor_tok, admin_tok, price=75000)
check("Commande complétée (setup avis)", oid_review is not None)

if oid_review:
    # Acheteur note le vendeur
    r = requests.post(f"{BASE}/reviews/", headers=auth(buyer_tok),
        json={"order": oid_review, "rating": 5,
              "comment": "Vendeur sérieux, article conforme à l'annonce."})
    check("Acheteur note vendeur (5/5)", r.status_code == 201,
          f"HTTP {r.status_code} — {r.text[:100]}")

    # Vendeur note l'acheteur
    r2 = requests.post(f"{BASE}/reviews/", headers=auth(vendor_tok),
        json={"order": oid_review, "rating": 4,
              "comment": "Acheteur ponctuel et respectueux."})
    check("Vendeur note acheteur (4/5)", r2.status_code == 201,
          f"HTTP {r2.status_code}")

    # Impossible de noter deux fois la même commande
    r3 = requests.post(f"{BASE}/reviews/", headers=auth(buyer_tok),
        json={"order": oid_review, "rating": 3, "comment": "Double notation"})
    check("Double notation refusée", r3.status_code == 400,
          f"HTTP {r3.status_code}")

    # Lire les avis du vendeur
    from apps.accounts.models import User
    vendor_user = User.objects.get(phone_number="+224620000001")
    r4 = requests.get(f"{BASE}/reviews/user/{vendor_user.id}/",
        headers=auth(buyer_tok))
    check("GET avis d'un vendeur", r4.status_code == 200)
    if r4.status_code == 200:
        reviews = r4.json().get("results", r4.json() if isinstance(r4.json(), list) else [])
        check("Avis présents", len(reviews) > 0, f"{len(reviews)} avis")


# ════════════════════════════════════════════════════════════════════════════
sep("Notifications", 8)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/notifications/", headers=auth(buyer_tok))
check("Lister les notifications", r.status_code == 200)
notifs = []
if r.status_code == 200:
    notifs = r.json().get("results", r.json() if isinstance(r.json(), list) else [])
    check("Notifications générées par les tests", len(notifs) > 0,
          f"{len(notifs)} notification(s)")

    if notifs:
        nid = notifs[0].get("id")
        r2 = requests.post(f"{BASE}/notifications/{nid}/read/", headers=auth(buyer_tok))
        check("Marquer notification comme lue", r2.status_code in (200, 204),
              f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Parrainage — stats et code", 9)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/accounts/referral/", headers=auth(vendor_tok))
check("GET stats parrainage", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    ref = r.json()
    check("Code de parrainage présent", bool(ref.get("referral_code") or ref.get("code")),
          str(ref.get("referral_code") or ref.get("code") or "N/A"))
    check("Compteur de filleuls présent",
          "referral_count" in ref, str(ref.keys()))


# ════════════════════════════════════════════════════════════════════════════
sep("Badges et abonnement", 10)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/accounts/badges/", headers=auth(vendor_tok))
check("GET badges utilisateur", r.status_code == 200, f"HTTP {r.status_code}")

r2 = requests.get(f"{BASE}/accounts/subscription/", headers=auth(vendor_tok))
check("GET abonnement actuel", r2.status_code == 200, f"HTTP {r2.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Admin — modération annonces et gestion utilisateurs", 11)
# ════════════════════════════════════════════════════════════════════════════

# Créer une annonce qui reste en DRAFT pour la modération
r = requests.post(f"{BASE}/listings/", headers=auth(vendor_tok),
    json={"title": "Annonce à modérer", "price_gnf": 150000,
          "price_type": "fixed", "city": "Conakry", "condition": "fair",
          "description": "Test modération admin."})
draft_id = r.json().get("id") if r.status_code in (200,201) else None
check("Annonce DRAFT créée pour modération", draft_id is not None)

if draft_id:
    # L'auto-publication peut avoir mis la listing en ACTIVE — forcer DRAFT pour tester approve
    from apps.listings.models import Listing as _L
    _L.objects.filter(pk=draft_id).update(status='draft')
    # Admin approuve
    r2 = requests.post(f"{BASE}/listings/admin/listings/{draft_id}/approve/",
        headers=auth(admin_tok))
    check("Admin approuve annonce", r2.status_code == 200, f"HTTP {r2.status_code}")

    # Créer une autre pour la rejeter
    r3 = requests.post(f"{BASE}/listings/", headers=auth(vendor_tok),
        json={"title": "Annonce à rejeter", "price_gnf": 50000,
              "price_type": "fixed", "city": "Labé", "condition": "poor",
              "description": "Test rejet."})
    reject_id = r3.json().get("id") if r3.status_code in (200,201) else None
    if reject_id:
        r4 = requests.post(f"{BASE}/listings/admin/listings/{reject_id}/reject/",
            headers=auth(admin_tok),
            json={"reason": "Contenu inapproprié — test automatique"})
        check("Admin rejette annonce", r4.status_code == 200, f"HTTP {r4.status_code}")

# Admin liste les utilisateurs
r5 = requests.get(f"{BASE}/accounts/admin/users/", headers=auth(admin_tok))
check("Admin liste utilisateurs", r5.status_code == 200, f"HTTP {r5.status_code}")
if r5.status_code == 200:
    _d5 = r5.json()
    users = _d5 if isinstance(_d5, list) else _d5.get("results", [])
    check("Au moins 2 utilisateurs", len(users) >= 2, f"{len(users)} utilisateur(s)")

# Admin liste les boutiques
r6 = requests.get(f"{BASE}/accounts/admin/shops/", headers=auth(admin_tok))
check("Admin liste boutiques", r6.status_code == 200, f"HTTP {r6.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Stats vendeur", 12)
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/listings/my/stats/", headers=auth(vendor_tok))
check("GET stats vendeur", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    stats = r.json()
    check("Champ total_listings présent",  "total_listings" in stats or "listings" in stats)
    check("Champ total_views présent",     "total_views" in stats or "views" in stats)


# ════════════════════════════════════════════════════════════════════════════
sep("Profil boutique — création et consultation", 13)
# ════════════════════════════════════════════════════════════════════════════

# GET ma boutique (peut être None si non créée)
r_myshop = requests.get(f"{BASE}/accounts/shop/", headers=auth(vendor_tok))
check("GET /accounts/shop/ (ma boutique)", r_myshop.status_code == 200,
      f"HTTP {r_myshop.status_code}")

# Créer ou mettre à jour la boutique du vendeur (champ 'phone', pas 'phone_number')
r_create = requests.post(f"{BASE}/accounts/shop/", headers=auth(vendor_tok),
    json={"name": "Boutique Test Guinée", "description": "Test boutique auto.",
          "city": "Conakry", "phone": "+224620000001"})
check("Créer/MAJ boutique (vendeur)", r_create.status_code in (200, 201),
      f"HTTP {r_create.status_code} — {r_create.text[:80]}")

# ShopDetailView requiert une boutique approuvée — approuver via admin
if r_create.status_code in (200, 201):
    from apps.accounts.models import Shop
    shop_obj = Shop.objects.filter(owner__phone_number="+224620000001").first()
    if shop_obj:
        Shop.objects.filter(pk=shop_obj.pk).update(status='approved', is_active=True)
        r_pub = requests.get(f"{BASE}/accounts/shops/{shop_obj.pk}/")
        check("GET boutique publique (approuvée)", r_pub.status_code == 200,
              f"HTTP {r_pub.status_code}")
        if r_pub.status_code == 200:
            check("Champ name dans la boutique",
                  "name" in r_pub.json() or "full_name" in r_pub.json())


# ════════════════════════════════════════════════════════════════════════════
sep("Token refresh", 14)
# ════════════════════════════════════════════════════════════════════════════

# Utiliser l'acheteur pour éviter le rate-limit du vendeur
r_login = requests.post(f"{BASE}/accounts/login/",
    json={"phone_number": "+224620000000", "password": "test1234"})
if r_login.status_code == 200:
    refresh_tok = r_login.json()["tokens"]["refresh"]
    r2 = requests.post(f"{BASE}/accounts/token/refresh/",
        json={"refresh": refresh_tok})
    check("Token refresh retourne un nouveau access token",
          r2.status_code == 200 and "access" in r2.json(),
          f"HTTP {r2.status_code}")
else:
    check("Token refresh", False, f"Login échoué — HTTP {r_login.status_code}")


# ════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ
# ════════════════════════════════════════════════════════════════════════════
total  = len(results)
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
    print("\n  🎉 TOUS LES SCÉNARIOS PASSENT !")
else:
    print(f"\n  ⚠️  {int(passed/total*100)}% de réussite")
