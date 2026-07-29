import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders',   '0018_gps_tracking'),
        ('accounts', '0013_userprofile_payout_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='SellerPayout',
            fields=[
                ('id',           models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('amount_gnf',   models.BigIntegerField()),
                ('payout_phone', models.CharField(max_length=20, blank=True)),
                ('provider',     models.CharField(
                    max_length=15,
                    choices=[
                        ('orange_money', 'Orange Money'),
                        ('mtn_momo',     'MTN MoMo'),
                        ('manual',       'Virement manuel'),
                    ],
                    default='orange_money',
                )),
                ('status',       models.CharField(
                    max_length=12,
                    choices=[
                        ('pending',    'En attente'),
                        ('processing', 'En cours'),
                        ('completed',  'Versé'),
                        ('failed',     'Échec'),
                    ],
                    default='pending',
                )),
                ('external_ref', models.CharField(
                    max_length=255, blank=True,
                    help_text='Référence transaction ChaChaP / OM / MTN',
                )),
                ('processed_at', models.DateTimeField(null=True, blank=True)),
                ('admin_note',   models.TextField(blank=True)),
                ('order',        models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='seller_payout',
                    to='orders.order',
                )),
                ('seller',       models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='seller_payouts',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name':        'Paiement vendeur',
                'verbose_name_plural': 'Paiements vendeurs',
                'ordering':            ['-created_at'],
            },
        ),
    ]
