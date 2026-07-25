from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0005_listing_weight_kg'),
    ]

    operations = [
        migrations.CreateModel(
            name='BoostPayment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('days',       models.PositiveIntegerField(help_text='Durée du boost en jours')),
                ('amount',     models.PositiveIntegerField(help_text='Montant en GNF')),
                ('provider',   models.CharField(max_length=20)),
                ('status',     models.CharField(
                    choices=[
                        ('pending',  'En attente validation'),
                        ('approved', 'Approuvé — boost activé'),
                        ('rejected', 'Rejeté'),
                    ],
                    default='pending',
                    max_length=10,
                )),
                ('phone',      models.CharField(blank=True, max_length=20)),
                ('ext_ref',    models.CharField(blank=True, help_text='Référence paiement externe', max_length=100)),
                ('admin_note', models.TextField(blank=True)),
                ('listing',    models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='boost_payments',
                    to='listings.listing',
                )),
            ],
            options={
                'verbose_name':        'Paiement boost',
                'verbose_name_plural': 'Paiements boost',
                'ordering':            ['-created_at'],
            },
        ),
    ]
