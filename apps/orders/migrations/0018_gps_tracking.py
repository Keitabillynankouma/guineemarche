import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0017_alter_deliveryassignment_verification_code_and_more'),
    ]

    operations = [
        # 1. Champs GPS sur DeliveryAssignment
        migrations.AddField(
            model_name='deliveryassignment',
            name='current_lat',
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True,
                help_text='Latitude courante du livreur',
            ),
        ),
        migrations.AddField(
            model_name='deliveryassignment',
            name='current_lng',
            field=models.DecimalField(
                blank=True, decimal_places=6, max_digits=9, null=True,
                help_text='Longitude courante du livreur',
            ),
        ),
        migrations.AddField(
            model_name='deliveryassignment',
            name='position_updated_at',
            field=models.DateTimeField(
                blank=True, null=True,
                help_text='Dernière mise à jour de position',
            ),
        ),

        # 2. Nouveau modèle DeliveryPositionHistory
        migrations.CreateModel(
            name='DeliveryPositionHistory',
            fields=[
                ('id',          models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
                ('lat',         models.DecimalField(decimal_places=6, max_digits=9)),
                ('lng',         models.DecimalField(decimal_places=6, max_digits=9)),
                ('recorded_at', models.DateTimeField(auto_now_add=True)),
                ('assignment',  models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='position_history',
                    to='orders.deliveryassignment',
                )),
            ],
            options={
                'verbose_name':        'Position livreur',
                'verbose_name_plural': 'Positions livreurs',
                'ordering':            ['-recorded_at'],
            },
        ),
    ]
