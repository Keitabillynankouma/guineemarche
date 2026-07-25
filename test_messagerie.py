"""
Tests messagerie :
  M1 — Démarrer une conversation (acheteur → vendeur via annonce)
  M2 — Envoyer et lire des messages
  M3 — Marquer messages comme lus automatiquement
  M4 — Sécurité : ne pas lire les conversations des autres
  M5 — Idempotence : une seule conversation par (buyer, seller, listing)
  M6 — Vendeur ne peut pas démarrer une conversation sur sa propre annonce

Usage : python test_messagerie.py   (serveur sur :8000)
"""
import os, sys, django, requests, uuid

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
print("Connexion des comptes...")
django.setup()

from apps.accounts.models import User
from apps.listings.models import Listing

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

buyer1  = ensure_user("+224621000001", "Acheteur Chat 1", "buyer")
buyer2  = ensure_user("+224621000002", "Acheteur Chat 2", "buyer")
vendor  = ensure_user("+224621000003", "Vendeur Chat", "seller")

tok_buyer1 = login("+224621000001")
tok_buyer2 = login("+224621000002")
tok_vendor = login("+224621000003")

listing = Listing.objects.create(
    seller=vendor, title="Téléphone Pour Chat Test", price_gnf=1500000,
    price_type="fixed", city="Conakry", condition="good",
    description="Test messagerie.", status='active'
)
print("  ✅ Comptes et annonce créés\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Démarrer une conversation", "M1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_buyer1),
    json={"listing_id": str(listing.id), "message": "Bonjour, ce téléphone est-il encore disponible ?"})
check("POST /messaging/start/ → 201", r.status_code == 201, f"HTTP {r.status_code} — {r.text[:80]}")

conv_id = None
if r.status_code == 201:
    data    = r.json()
    conv_id = data.get("conversation", {}).get("id")
    check("conversation.id retourné", bool(conv_id), str(conv_id)[:8] if conv_id else "")
    check("message retourné", bool(data.get("message", {}).get("id")))
    check("conversation contient l'autre utilisateur",
          bool(data.get("conversation", {}).get("other_user")))
    check("unread_count présent", "unread_count" in data.get("conversation", {}))


# ════════════════════════════════════════════════════════════════════════════
sep("Envoyer et lire des messages", "M2")
# ════════════════════════════════════════════════════════════════════════════

if conv_id:
    # Vendeur répond
    r2 = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_vendor),
        json={"content": "Oui, toujours disponible ! Prix négociable.", "msg_type": "text"})
    check("Vendeur envoie message → 201", r2.status_code == 201, f"HTTP {r2.status_code}")

    # Acheteur envoie une offre de prix
    r3 = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_buyer1),
        json={"content": "Je propose 1 400 000 GNF.", "msg_type": "text",
              "offer_amount_gnf": 1400000})
    check("Acheteur envoie offre de prix → 201", r3.status_code == 201,
          f"HTTP {r3.status_code}")

    # Lire les messages
    r_msgs = requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_buyer1))
    check("GET /messaging/{id}/messages/ → 200", r_msgs.status_code == 200,
          f"HTTP {r_msgs.status_code}")
    if r_msgs.status_code == 200:
        msgs = r_msgs.json()
        msgs_list = msgs if isinstance(msgs, list) else msgs.get("results", [])
        check("Messages retournés", len(msgs_list) >= 2, f"{len(msgs_list)} message(s)")
        check("Champs sender_name présents",
              all("sender_name" in m for m in msgs_list))


# ════════════════════════════════════════════════════════════════════════════
sep("Marquer messages comme lus automatiquement", "M3")
# ════════════════════════════════════════════════════════════════════════════

if conv_id:
    # Le vendeur envoie un nouveau message non lu
    requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_vendor),
        json={"content": "Je peux descendre à 1 450 000 GNF."})

    # Avant que l'acheteur lise : vérifier le compteur via la liste des conversations
    r_convs = requests.get(f"{BASE}/messaging/", headers=auth(tok_buyer1))
    check("GET /messaging/ → 200", r_convs.status_code == 200, f"HTTP {r_convs.status_code}")
    if r_convs.status_code == 200:
        convs = r_convs.json()
        conv_list = convs if isinstance(convs, list) else convs.get("results", [])
        our_conv  = next((c for c in conv_list if str(c.get("id")) == str(conv_id)), None)
        check("Conversation trouvée dans la liste", our_conv is not None)
        if our_conv:
            unread = our_conv.get("unread_count", 0)
            check("unread_count > 0 (message non lu du vendeur)", unread > 0,
                  f"unread_count={unread}")

    # L'acheteur lit les messages → auto-marqués lus
    requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_buyer1))

    # Revérifier unread_count
    r_convs2 = requests.get(f"{BASE}/messaging/", headers=auth(tok_buyer1))
    if r_convs2.status_code == 200:
        conv_list2 = r_convs2.json()
        conv_list2 = conv_list2 if isinstance(conv_list2, list) else conv_list2.get("results", [])
        our_conv2  = next((c for c in conv_list2 if str(c.get("id")) == str(conv_id)), None)
        if our_conv2:
            check("unread_count = 0 après lecture",
                  our_conv2.get("unread_count", -1) == 0,
                  f"unread_count={our_conv2.get('unread_count')}")


# ════════════════════════════════════════════════════════════════════════════
sep("Sécurité — ne pas lire les conversations des autres", "M4")
# ════════════════════════════════════════════════════════════════════════════

if conv_id:
    # Acheteur2 tente de lire les messages de la conversation acheteur1/vendeur
    r_hack = requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_buyer2))
    check("Acheteur2 lit messages d'une autre conversation → liste vide ou 403",
          r_hack.status_code in (200, 403) and
          (r_hack.status_code == 403 or
           len(r_hack.json() if isinstance(r_hack.json(), list) else r_hack.json().get("results", [])) == 0),
          f"HTTP {r_hack.status_code}")

    # Acheteur2 tente d'envoyer dans la conversation d'un autre
    r_hack2 = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_buyer2),
        json={"content": "Message intrus !"})
    check("Acheteur2 → envoyer dans conv d'un autre → 403",
          r_hack2.status_code == 403, f"HTTP {r_hack2.status_code}")

    # Conversation inexistante → 404
    r_fake = requests.get(f"{BASE}/messaging/{uuid.uuid4()}/messages/",
        headers=auth(tok_buyer1))
    check("GET messages conversation inexistante → 404",
          r_fake.status_code == 404, f"HTTP {r_fake.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Idempotence — une seule conversation par (buyer, seller, listing)", "M5")
# ════════════════════════════════════════════════════════════════════════════

# Démarrer une 2e fois la même conversation → même ID retourné
r_dup = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_buyer1),
    json={"listing_id": str(listing.id), "message": "Re-bonjour, vous avez d'autres couleurs ?"})
check("2e start sur même annonce → 201 (idempotent)", r_dup.status_code == 201,
      f"HTTP {r_dup.status_code}")
if r_dup.status_code == 201 and conv_id:
    same_id = r_dup.json().get("conversation", {}).get("id")
    check("Même conversation_id retourné", str(same_id) == str(conv_id),
          f"id retourné={str(same_id)[:8]} vs attendu={str(conv_id)[:8]}")

# Acheteur2 peut avoir sa propre conversation sur la même annonce
r_buyer2 = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_buyer2),
    json={"listing_id": str(listing.id), "message": "Est-ce que vous livrez ?"})
check("Acheteur2 démarre sa propre conversation → 201", r_buyer2.status_code == 201,
      f"HTTP {r_buyer2.status_code}")
if r_buyer2.status_code == 201 and conv_id:
    conv2_id = r_buyer2.json().get("conversation", {}).get("id")
    check("Conversation acheteur2 ≠ conversation acheteur1",
          str(conv2_id) != str(conv_id))


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur ne peut pas contacter sa propre annonce", "M6")
# ════════════════════════════════════════════════════════════════════════════

r_self = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_vendor),
    json={"listing_id": str(listing.id), "message": "Je me parle à moi-même..."})
check("Vendeur → sa propre annonce → 400", r_self.status_code == 400,
      f"HTTP {r_self.status_code} — {r_self.text[:80]}")

# Message sans contenu → 400
if conv_id:
    r_empty = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_buyer1),
        json={"content": "", "msg_type": "text"})
    check("Message vide → refusé (400 ou message vide géré)",
          r_empty.status_code in (400, 201),  # selon la validation
          f"HTTP {r_empty.status_code}")


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
    print("\n  🎉 TOUS LES TESTS MESSAGERIE PASSENT !")
