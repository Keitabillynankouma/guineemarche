import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_alter_order_escrow_admin_hold_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliveryZone',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('city', models.CharField(db_index=True, max_length=100, unique=True)),
                ('fee_gnf', models.BigIntegerField(default=0, help_text='Frais de livraison en GNF')),
                ('estimated_days', models.PositiveSmallIntegerField(default=1, help_text='Délai estimé en jours ouvrables')),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Zone de livraison',
                'verbose_name_plural': 'Zones de livraison',
                'ordering': ['city'],
            },
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_address',
            field=models.CharField(blank=True, help_text='Adresse de livraison à domicile', max_length=400),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_fee_gnf',
            field=models.BigIntegerField(default=0, help_text='Frais de livraison inclus dans amount_gnf'),
        ),
    ]
