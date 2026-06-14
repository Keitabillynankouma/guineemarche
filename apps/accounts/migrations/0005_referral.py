import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
import uuid
import secrets
import string


def generate_referral_codes(apps, schema_editor):
    """Génère un code unique pour chaque utilisateur existant sans code."""
    User = apps.get_model('accounts', 'User')
    chars = string.ascii_uppercase + string.digits
    for user in User.objects.filter(referral_code=''):
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(8))
            if not User.objects.filter(referral_code=code).exists():
                user.referral_code = code
                user.save(update_fields=['referral_code'])
                break


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_shop_status_plan'),
    ]

    operations = [
        # 1. referral_code sans unique d'abord (évite le UNIQUE constraint sur default='')
        migrations.AddField(
            model_name='user',
            name='referral_code',
            field=models.CharField(max_length=12, blank=True, default=''),
            preserve_default=False,
        ),
        # 2. Générer les codes pour les utilisateurs existants (RunPython = compatible SQLite + PostgreSQL)
        migrations.RunPython(generate_referral_codes, reverse_code=migrations.RunPython.noop),
        # 3. Maintenant qu'il n'y a plus de doublons, ajouter la contrainte unique
        migrations.AlterField(
            model_name='user',
            name='referral_code',
            field=models.CharField(max_length=12, unique=True, blank=True, db_index=True, default=''),
        ),
        # 4. referred_by sur User
        migrations.AddField(
            model_name='user',
            name='referred_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='referrals_made',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # 5. referral_bonus sur Subscription
        migrations.AddField(
            model_name='subscription',
            name='referral_bonus',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Slots gratuits supplémentaires gagnés par parrainage',
            ),
        ),
        # 6. Modèle Referral
        migrations.CreateModel(
            name='Referral',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('reward_given', models.BooleanField(default=False)),
                ('referrer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referrals_given',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('referred', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='referral_received',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Parrainage',
                'verbose_name_plural': 'Parrainages',
                'ordering': ['-created_at'],
            },
        ),
    ]
