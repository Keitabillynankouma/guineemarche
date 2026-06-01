import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PickupPoint',
            fields=[
                ('id',         models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('name',       models.CharField(max_length=200)),
                ('address',    models.CharField(max_length=300)),
                ('city',       models.CharField(default='Conakry', max_length=100)),
                ('commune',    models.CharField(blank=True, max_length=100)),
                ('phone',      models.CharField(blank=True, max_length=20)),
                ('is_active',  models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Point de retrait',
                'verbose_name_plural': 'Points de retrait',
                'ordering': ['city', 'name'],
            },
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_mode',
            field=models.CharField(
                choices=[
                    ('meeting_point', 'Remise en main propre'),
                    ('pickup_point',  'Point de retrait'),
                    ('home_delivery', 'Livraison à domicile'),
                ],
                default='meeting_point',
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='pickup_point',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='orders',
                to='orders.pickuppoint',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='escrow_status',
            field=models.CharField(
                choices=[
                    ('none',     'Sans escrow'),
                    ('held',     'Fonds retenus'),
                    ('released', 'Fonds libérés'),
                    ('refunded', 'Remboursé'),
                ],
                default='none',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='escrow_released_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
