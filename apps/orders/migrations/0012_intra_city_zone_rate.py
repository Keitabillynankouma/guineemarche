from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0011_delivery_pricing_fields'),
    ]

    operations = [
        # Nouveau modèle IntraCityZoneRate
        migrations.CreateModel(
            name='IntraCityZoneRate',
            fields=[
                ('id',              models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',      models.DateTimeField(auto_now_add=True)),
                ('updated_at',      models.DateTimeField(auto_now=True)),
                ('city',            models.CharField(db_index=True, max_length=100)),
                ('from_commune',    models.CharField(max_length=100, help_text='Commune du vendeur')),
                ('to_commune',      models.CharField(max_length=100, help_text="Commune de l'acheteur")),
                ('fee_gnf',         models.BigIntegerField(default=0)),
                ('estimated_hours', models.PositiveSmallIntegerField(default=2, help_text='Délai indicatif en heures')),
                ('is_active',       models.BooleanField(default=True)),
            ],
            options={
                'verbose_name':        'Tarif inter-commune',
                'verbose_name_plural': 'Tarifs inter-communes',
                'ordering':            ['city', 'from_commune', 'to_commune'],
                'unique_together':     {('city', 'from_commune', 'to_commune')},
            },
        ),

        # Commune de l'acheteur sur Order
        migrations.AddField(
            model_name='order',
            name='delivery_buyer_commune',
            field=models.CharField(
                blank=True, max_length=100,
                help_text="Commune de l'acheteur — déclenche la tarification inter-commune"
            ),
        ),
    ]
