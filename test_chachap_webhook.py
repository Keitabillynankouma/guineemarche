"""
Script de test ChaChap Pay — simule un webhook de confirmation de paiement.

Usage :
    python test_chachap_webhook.py <ORDER_ID>

    Ou sans argument pour tester la signature uniquement :
    python test_chachap_webhook.py

Exemple :
    python test_chachap_webhook.py 550e8400-e29b-41d4-a716-446655440000
"""
import hmac
import hashlib
import json
import sys
import uuid
import requests

# ── Clés de test ChaChap Pay ──────────────────────────────────────────────────
HMAC_KEY = "b13d1d1826ba0c16311207d58eec6735"    # Clé d'encryptage HMAC
API_KEY  = "ebae0e063b0108451c4dfae798bba742411de12ff302b9391705d0dbfd9bea92"

# ── Config locale ──────────────────────────────────────────────────────────────
BASE_URL     = "http://localhost:8000"
WEBHOOK_PATH = "/api/v1/orders/webhook/chachap/"

def sign_body(body_bytes: bytes, key: str) -> str:
    """Calcule HMAC-SHA256 du body avec la clé HMAC."""
    return hmac.new(key.encode(), body_bytes, hashlib.sha256).hexdigest()


def simulate_webhook(order_id: str = None, operation_id: str = None, success: bool = True):
    """Envoie un webhook ChaChap simulé vers le serveur local."""
    op_id = operation_id or f"TEST-CCP-{uuid.uuid4().hex[:10].upper()}"

    payload = {
        "operation_id":   op_id,
        "status":         "SUCCESS" if success else "FAILED",
        "amount":         150000,
        "currency":       "GNF",
        "payment_method": "orange_money",
        "phone":          "+224620000001",
    }
    if order_id:
        payload["order_id"] = order_id

    body = json.dumps(payload, separators=(',', ':')).encode()
    sig  = sign_body(body, HMAC_KEY)

    print(f"\n📤 Envoi webhook ChaChap vers {BASE_URL}{WEBHOOK_PATH}")
    print(f"   operation_id : {op_id}")
    print(f"   status       : {payload['status']}")
    print(f"   signature    : {sig[:20]}...")

    try:
        resp = requests.post(
            BASE_URL + WEBHOOK_PATH,
            data=body,
            headers={
                "Content-Type": "application/json",
                "CCP-Signature": sig,
            },
            timeout=10,
        )
        print(f"\n✅ Réponse HTTP {resp.status_code}")
        print(f"   Body : {resp.text}")
        return resp
    except requests.ConnectionError:
        print(f"\n❌ Impossible de se connecter à {BASE_URL}")
        print("   → Lance d'abord : python manage.py runserver")
        sys.exit(1)


def test_signature_only():
    """Vérifie que la signature est bien calculée."""
    body = b'{"operation_id":"TEST","status":"SUCCESS","amount":150000}'
    sig  = sign_body(body, HMAC_KEY)
    print(f"Test signature HMAC-SHA256 :")
    print(f"  Body    : {body.decode()}")
    print(f"  Clé     : {HMAC_KEY}")
    print(f"  Sig     : {sig}")
    print("  ✅ Calcul OK")


if __name__ == "__main__":
    print("=" * 60)
    print("  Chap Chap Pay — Test webhook (mode TEST/Dev)")
    print("=" * 60)

    test_signature_only()

    order_id = sys.argv[1] if len(sys.argv) > 1 else None
    if not order_id:
        print("\n⚠️  Aucun ORDER_ID fourni — test de signature uniquement.")
        print("   Usage : python test_chachap_webhook.py <ORDER_UUID>")
    else:
        simulate_webhook(order_id=order_id, success=True)
        print("\n📋 Pour vérifier la commande :")
        print(f"   GET {BASE_URL}/api/v1/orders/{order_id}/")
        print("   → status doit être 'confirmed', escrow_status 'held'")
