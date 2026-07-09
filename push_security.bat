@echo off
echo ============================================================
echo  Guimatrix - Push Paycard + Visa + Emails Brevo
echo ============================================================

cd /d "%~dp0"

echo.
echo [1/4] Ajout de tous les fichiers modifies...
git add core/file_validators.py
git add core/security_agent.py
git add core/security_middleware.py
git add core/email_notifications.py
git add apps/listings/serializers.py
git add apps/orders/views.py
git add apps/orders/urls.py
git add apps/orders/payment_service.py
git add apps/accounts/signals.py
git add config/urls.py
git add config/settings.py
git add Procfile
git add frontend/src/pages/OrdersPage.jsx
git add core/management/__init__.py
git add core/management/commands/__init__.py
git add core/management/commands/test_email.py

echo.
echo [2/4] Commit...
git commit -m "feat: Paycard Guinee + Visa card + emails Brevo + agent securite

Paiement — remplacement PawaPay par Paycard Guinee :
- initiate_paycard() : Orange Money GN + MTN MoMo via Paycard
- initiate_paycard_card() : paiement Visa/Mastercard hosted checkout
- Webhooks : /webhook/paycard/ + /webhook/paycard/card/ + /refunds/
- Signature HMAC-SHA256 + protection replay attack 5 minutes
- Simulation automatique si PAYCARD_API_KEY absent

Emails transactionnels (Brevo / Gmail SMTP) :
- core/email_notifications.py : 9 templates HTML verts Guimatrix
- send_welcome, send_new_order_seller, send_order_confirmed_buyer
- send_payment_received (acheteur + vendeur), send_escrow_released
- send_order_cancelled, send_dispute_opened, send_dispute_resolved
- Envoi non-bloquant via threading.Thread (jamais de timeout API)
- Commande : python manage.py test_email --to bnkeita020@gmail.com

Agent IA securite Celery :
- core/security_agent.py : scan fraude quotidien 07h00 (Claude Haiku)
- Rapport en francais envoye par email a ADMIN_SECURITY_EMAIL

Settings :
- JWT SIGNING_KEY via SHA256(SECRET_KEY) — plus de warning HMAC
- PAYCARD_* + EMAIL_* (Brevo ou Gmail) ajoutes
- Procfile : makemigrations + migrate + staticfiles + collectstatic"

echo.
echo [3/4] Push vers Railway (main)...
git push origin main

echo.
echo [4/4] Push termine !
echo.
echo ============================================================
echo  ETAPE CRITIQUE — RAILWAY START COMMAND
echo ============================================================
echo.
echo  Railway ignore le Procfile si un "Start Command" est defini.
echo  TU DOIS mettre a jour le Start Command dans Railway :
echo.
echo  Railway.app ^> ton service backend ^> Settings ^> Deploy
echo  Cherche "Start Command" et remplace par :
echo.
echo  python manage.py makemigrations --noinput ^&^& python manage.py migrate --noinput ^&^& mkdir -p staticfiles ^&^& python manage.py collectstatic --noinput ^&^& gunicorn config.wsgi --bind 0.0.0.0:$PORT
echo.
echo ============================================================
echo  VARIABLES RAILWAY A AJOUTER (Variables ^> New Variable)
echo ============================================================
echo.
echo  SECRET_KEY          = [clique Generate (eclair) dans Railway, 50+ chars]
echo  ADMIN_SECURITY_EMAIL = bnkeita020@gmail.com
echo  DJANGO_ADMIN_URL    = panel-gm-x7k2/  (ou autre chemin secret)
echo  ANTHROPIC_API_KEY   = sk-ant-...
echo.
echo  -- Emails Brevo --
echo  EMAIL_HOST          = smtp-relay.brevo.com
echo  BREVO_SMTP_USER     = [ton login SMTP Brevo - brevo.com ^> Settings ^> SMTP]
echo  BREVO_SMTP_PASSWORD = [ton mot de passe SMTP Brevo]
echo  DEFAULT_FROM_EMAIL  = Guimatrix ^<noreply@guimatrix.com^>
echo  ADMIN_EMAIL         = bnkeita020@gmail.com
echo.
echo  -- Paycard (quand tu recois les cles) --
echo  PAYCARD_API_KEY     = [cle API Paycard]
echo  PAYCARD_SECRET_KEY  = [cle secrete Paycard]
echo  PAYCARD_MERCHANT_ID = [ID marchand Paycard]
echo  PAYCARD_SANDBOX     = true  (false en production)
echo.
echo ============================================================
echo  APRES LE DEPLOY — TESTER LES EMAILS
echo ============================================================
echo.
echo  Dans Railway ^> ton service backend ^> onglet "Deploy" ^> bouton "..."
echo  Ou dans la console Railway :
echo    python manage.py test_email --to bnkeita020@gmail.com
echo.
echo  URLs webhook a communiquer a Paycard :
echo  https://api.guimatrix.com/api/v1/orders/webhook/paycard/
echo  https://api.guimatrix.com/api/v1/orders/webhook/paycard/card/
echo.
echo  Cloudinary : regenere ton API Secret si pas encore fait
echo  https://console.cloudinary.com/settings/api-keys
echo.
pause
