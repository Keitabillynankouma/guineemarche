"""
Tests messagerie complète :
  M1  — Démarrer une conversation (acheteur → annonce)
  M2  — Idempotence : re-contacter le même vendeur retourne la même conversation
  M3  — Vendeur ne peut pas contacter sa propre annonce
  M4  — Lister ses conversations (acheteur voit la sienne)
  M5  — Lister ses conversations (vendeur voit la sienne)
  M6  — Envoyer un message dans une conversation
  M7  — Lire les messages d'une conversation
  M8  — Tiers ne peut pas lire les messages d'une conversation qui ne le concerne pas
  M9  — Messages vus marqués comme lus
  M10 — Envoyer un message dans une conversation qu'on n'est pas

Usage : python test_messaging.py   (serveur sur :8000)
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

seller  = ensure_user("+224629004001", "Vendeur Msg",  "seller")
buyer   = ensure_user("+224629004002", "Acheteur Msg", "buyer")
tiers   = ensure_user("+224629004003", "Tiers Msg",    "buyer")

tok_seller = login("+224629004001")
tok_buyer  = login("+224629004002")
tok_tiers  = login("+224629004003")

listing = Listing.objects.create(
    seller=seller, title=f"Annonce Msg {uuid.uuid4().hex[:4]}",
    price_gnf=50_000, price_type="fixed", city="Conakry",
    condition="good", description="Test messagerie.", status="active",
)
print(f"  ✅ Listing : {listing.id}")
print("  ✅ Setup OK\n")


# ════════════════════════════════════════════════════════════════════════════
sep("Démarrer une conversation", "M1")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_buyer),
                  json={"listing": str(listing.id), "message": "Bonjour, est-ce disponible ?"})
check("Start conversation → 201", r.status_code == 201, f"HTTP {r.status_code}")
conv_id = None
if r.status_code == 201:
    conv_id = r.json().get("conversation", {}).get("id")
    check("conversation.id présent", bool(conv_id))
    check("message retourné", bool(r.json().get("message")))


# ════════════════════════════════════════════════════════════════════════════
sep("Idempotence — re-contacter retourne la même conversation", "M2")
# ════════════════════════════════════════════════════════════════════════════

r2 = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_buyer),
                   json={"listing": str(listing.id), "message": "Toujours disponible ?"})
check("Second start → 201", r2.status_code == 201, f"HTTP {r2.status_code}")
if r2.status_code == 201 and conv_id:
    same_id = r2.json().get("conversation", {}).get("id")
    check("Même conversation retournée", same_id == conv_id,
          f"attendu={conv_id[:8]}… reçu={str(same_id)[:8]}…")


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur ne peut pas contacter sa propre annonce", "M3")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/messaging/start/", headers=auth(tok_seller),
                  json={"listing": str(listing.id), "message": "Test auto-contact"})
check("Vendeur contacte sa propre annonce → 400", r.status_code == 400, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Acheteur liste ses conversations", "M4")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/messaging/", headers=auth(tok_buyer))
check("GET /messaging/ → 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    items = data if isinstance(data, list) else data.get("results", [])
    ids = [str(c.get("id")) for c in items]
    check("Conversation présente dans la liste", conv_id in ids if conv_id else False)


# ════════════════════════════════════════════════════════════════════════════
sep("Vendeur liste ses conversations", "M5")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/messaging/", headers=auth(tok_seller))
check("GET /messaging/ vendeur → 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    items = data if isinstance(data, list) else data.get("results", [])
    ids = [str(c.get("id")) for c in items]
    check("Conversation dans la liste vendeur", conv_id in ids if conv_id else False)


# ════════════════════════════════════════════════════════════════════════════
sep("Envoyer un message dans la conversation", "M6")
# ════════════════════════════════════════════════════════════════════════════

if not conv_id:
    check("Impossible de continuer sans conv_id", False); import sys; sys.exit(1)

r = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_seller),
                  json={"content": "Oui, toujours disponible ! Passez demain."})
check("Vendeur envoie un message → 201", r.status_code == 201, f"HTTP {r.status_code}")
if r.status_code == 201:
    msg = r.json()
    check("content retourné", bool(msg.get("content")))
    check("sender = vendeur", str(msg.get("sender")) == str(seller.id) or
          msg.get("sender_name") == seller.full_name)


# ════════════════════════════════════════════════════════════════════════════
sep("Lire les messages de la conversation", "M7")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_buyer))
check("GET messages → 200", r.status_code == 200, f"HTTP {r.status_code}")
if r.status_code == 200:
    data = r.json()
    msgs = data if isinstance(data, list) else data.get("results", [])
    check("Au moins 2 messages (init + réponse)", len(msgs) >= 2,
          f"count={len(msgs)}")


# ════════════════════════════════════════════════════════════════════════════
sep("Tiers ne peut pas lire les messages", "M8")
# ════════════════════════════════════════════════════════════════════════════

r = requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_tiers))
# Retourne 200 mais liste vide (filtrage DB) OU 403
if r.status_code == 200:
    data = r.json()
    msgs = data if isinstance(data, list) else data.get("results", [])
    check("Tiers voit 0 messages (accès filtré)", len(msgs) == 0,
          f"count={len(msgs)}")
else:
    check("Tiers → 403", r.status_code == 403, f"HTTP {r.status_code}")


# ════════════════════════════════════════════════════════════════════════════
sep("Messages non-lus marqués comme lus après lecture", "M9")
# ════════════════════════════════════════════════════════════════════════════

from apps.messaging.models import Message
# Avant lecture — vérifier qu'il existe des messages non lus du vendeur
unread_before = Message.objects.filter(
    conversation_id=conv_id, is_read=False
).exclude(sender=buyer).count()

# Lire les messages en tant qu'acheteur (GET marque comme lus)
requests.get(f"{BASE}/messaging/{conv_id}/messages/", headers=auth(tok_buyer))

unread_after = Message.objects.filter(
    conversation_id=conv_id, is_read=False
).exclude(sender=buyer).count()

check("Messages du vendeur marqués lus après lecture acheteur",
      unread_after == 0, f"non-lus avant={unread_before}, après={unread_after}")


# ════════════════════════════════════════════════════════════════════════════
sep("Tiers ne peut pas envoyer dans une conversation tierce", "M10")
# ════════════════════════════════════════════════════════════════════════════

r = requests.post(f"{BASE}/messaging/{conv_id}/send/", headers=auth(tok_tiers),
                  json={"content": "Je m'incruste !"})
check("Tiers → 403 pour envoyer", r.status_code == 403, f"HTTP {r.status_code}")


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
