import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0014_payment_chachap_provider'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LivreurPayment',
            fields=[
                ('id',               models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',       models.DateTimeField(auto_now_add=True)),
                ('updated_at',       models.DateTimeField(auto_now=True)),
                ('gross_gnf',        models.BigIntegerField(help_text='Frais de livraison bruts')),
                ('platform_cut_gnf', models.BigIntegerField(default=0, help_text='Part plateforme')),
                ('net_gnf',          models.BigIntegerField(help_text='Montant net à verser au livreur')),
                ('status',           models.CharField(
                    choices=[('pending', 'À payer'), ('paid', 'Payé')],
                    default='pending', max_length=10,
                )),
                ('paid_at',          models.DateTimeField(blank=True, null=True)),
                ('payment_ref',      models.CharField(blank=True, max_length=150)),
                ('note',             models.TextField(blank=True)),
                ('assignment',       models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='livreur_payment',
                    to='orders.deliveryassignment',
                )),
                ('livreur',          models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='livreur_payments',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Paiement livreur',
                'verbose_name_plural': 'Paiements livreurs',
                'ordering': ['-created_at'],
            },
        ),
    ]
