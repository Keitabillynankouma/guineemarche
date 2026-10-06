from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0019_sellerpayout'),
    ]

    operations = [
        # ── Nouveau statut PICKUP_CONFIRMED sur Order ─────────────────────────
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending',          'En attente'),
                    ('confirmed',        'Confirmée'),
                    ('pickup_confirmed', 'Collecté par livreur'),
                    ('completed',        'Terminée'),
                    ('cancelled',        'Annulée'),
                    ('disputed',         'Litige'),
                ],
                default='pending',
                max_length=16,
            ),
        ),

        # ── CapitalReserve ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='CapitalReserve',
            fields=[
                ('id',                  models.AutoField(primary_key=True, serialize=False)),
                ('created_at',         models.DateTimeField(auto_now_add=True)),
                ('updated_at',         models.DateTimeField(auto_now=True)),
                ('balance_gnf',        models.BigIntegerField(default=0)),
                ('total_advanced_gnf', models.BigIntegerField(default=0)),
                ('total_disbursed_gnf',models.BigIntegerField(default=0)),
                ('total_recovered_gnf',models.BigIntegerField(default=0)),
                ('total_defaulted_gnf',models.BigIntegerField(default=0)),
                ('advance_rate_pct',   models.PositiveSmallIntegerField(default=70)),
                ('max_order_gnf',      models.BigIntegerField(default=300000)),
            ],
            options={
                'verbose_name': 'Capital de roulement',
                'verbose_name_plural': 'Capital de roulement',
            },
        ),

        # Seed : créer le singleton avec 10 000 000 GNF
        migrations.RunSQL(
            sql="""
                INSERT INTO orders_capitalreserve
                    (id, balance_gnf, total_advanced_gnf, total_disbursed_gnf,
                     total_recovered_gnf, total_defaulted_gnf,
                     advance_rate_pct, max_order_gnf,
                     created_at, updated_at)
                VALUES
                    (1, 10000000, 0, 0, 0, 0, 70, 300000, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """,
            reverse_sql="DELETE FROM orders_capitalreserve WHERE id = 1;",
        ),

        # ── VendorAdvance ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name='VendorAdvance',
            fields=[
                ('id',                models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',        models.DateTimeField(auto_now_add=True)),
                ('updated_at',        models.DateTimeField(auto_now=True)),
                ('advance_gnf',       models.BigIntegerField()),
                ('held_gnf',          models.BigIntegerField()),
                ('advance_rate_pct',  models.PositiveSmallIntegerField(default=70)),
                ('status',            models.CharField(
                    choices=[
                        ('pending',   'En attente de versement'),
                        ('advanced',  'Avance versée'),
                        ('completed', 'Soldé (acheteur payé)'),
                        ('defaulted', 'Défaut de paiement'),
                    ],
                    default='pending',
                    max_length=10,
                )),
                ('advanced_at',       models.DateTimeField(blank=True, null=True)),
                ('completed_at',      models.DateTimeField(blank=True, null=True)),
                ('payment_reference', models.CharField(blank=True, max_length=100)),
                ('admin_note',        models.TextField(blank=True)),
                ('order',             models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='vendor_advance',
                    to='orders.order',
                )),
            ],
            options={
                'verbose_name': 'Avance vendeur',
                'verbose_name_plural': 'Avances vendeurs',
                'ordering': ['-created_at'],
            },
        ),
    ]
