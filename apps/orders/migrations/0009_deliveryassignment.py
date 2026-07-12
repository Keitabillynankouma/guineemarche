"""Crée la table DeliveryAssignment pour la flotte de livreurs."""
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders',   '0008_seed_delivery_zones'),
        ('accounts', '0008_user_role_livreur'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliveryAssignment',
            fields=[
                ('id',                models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',        models.DateTimeField(auto_now_add=True)),
                ('updated_at',        models.DateTimeField(auto_now=True)),
                ('status',            models.CharField(
                    choices=[
                        ('assigned',  'Affectée'),
                        ('en_route',  'En route'),
                        ('delivered', 'Livrée'),
                        ('failed',    'Échec livraison'),
                    ],
                    default='assigned',
                    max_length=12,
                )),
                ('verification_code', models.CharField(max_length=6)),
                ('assigned_at',       models.DateTimeField(auto_now_add=True)),
                ('delivered_at',      models.DateTimeField(blank=True, null=True)),
                ('notes',             models.TextField(blank=True)),
                ('order',             models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='delivery_assignment',
                    to='orders.order',
                )),
                ('livreur',           models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='delivery_assignments',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name':        'Affectation livreur',
                'verbose_name_plural': 'Affectations livreurs',
                'ordering':            ['-assigned_at'],
            },
        ),
    ]
