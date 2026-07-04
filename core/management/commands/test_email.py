"""
Commande Django pour tester la configuration email Brevo.
Usage :
    python manage.py test_email
    python manage.py test_email --to bnkeita020@gmail.com
"""
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings


class Command(BaseCommand):
    help = 'Envoie un email de test pour vérifier la configuration Brevo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            type=str,
            default='',
            help='Adresse email destinataire (défaut : ADMIN_EMAIL)',
        )

    def handle(self, *args, **options):
        recipient = options['to'] or getattr(settings, 'ADMIN_EMAIL', 'bnkeita020@gmail.com')

        self.stdout.write(f'\n📧 Configuration email détectée :')
        self.stdout.write(f'   Backend  : {settings.EMAIL_BACKEND}')
        self.stdout.write(f'   Host     : {getattr(settings, "EMAIL_HOST", "?")}')
        self.stdout.write(f'   Port     : {getattr(settings, "EMAIL_PORT", "?")}')
        self.stdout.write(f'   User     : {getattr(settings, "EMAIL_HOST_USER", "(vide)")}')
        self.stdout.write(f'   From     : {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'   To       : {recipient}')
        self.stdout.write('')

        html = """
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;">
          <div style="background:#16a34a;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px;text-align:center;">
            <h1 style="margin:0;font-size:22px;">Guimatrix</h1>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px;">
            <h2 style="color:#111827;font-size:18px;">✅ Email de test réussi !</h2>
            <p style="color:#6b7280;font-size:14px;line-height:1.6;">
              La configuration Brevo est correcte.<br>
              Les emails transactionnels (commandes, paiements, litiges) fonctionnent.
            </p>
            <div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-top:16px;font-size:13px;color:#166534;">
              🎉 Guimatrix est prêt à envoyer des emails aux utilisateurs et à la diaspora.
            </div>
          </div>
        </div>
        """

        try:
            send_mail(
                subject='✅ Test Brevo — Guimatrix fonctionne !',
                message='Email de test Guimatrix — la configuration Brevo est correcte.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                html_message=html,
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(f'✅ Email envoyé avec succès à {recipient}'))
            self.stdout.write(self.style.SUCCESS('   Vérifie ta boîte mail (et les spams).'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Échec : {e}'))
            self.stdout.write('')
            self.stdout.write('Causes possibles :')
            self.stdout.write('  · BREVO_SMTP_USER ou BREVO_SMTP_PASSWORD manquant dans Railway')
            self.stdout.write('  · Mot de passe SMTP Brevo incorrect (pas le mot de passe du compte)')
            self.stdout.write('  · L\'adresse expéditrice n\'est pas vérifiée dans Brevo')
