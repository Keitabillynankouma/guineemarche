from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0010_deliveryassignment_pickup_code'),
    ]

    operations = [
        # DeliveryZone — nouveaux champs de tarification
        migrations.AddField(
            model_name='deliveryzone',
            name='free_km_radius',
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text='Km inclus dans le tarif de base (0 = aucun)'
            ),
        ),
        migrations.AddField(
            model_name='deliveryzone',
            name='price_per_km_gnf',
            field=models.BigIntegerField(
                default=0,
                help_text='Surcharge par km supplémentaire en GNF (0 = pas de surcharge)'
            ),
        ),
        migrations.AddField(
            model_name='deliveryzone',
            name='free_weight_kg',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=6,
                help_text='Poids inclus dans le tarif de base en kg (0 = aucun)'
            ),
        ),
        migrations.AddField(
            model_name='deliveryzone',
            name='price_per_kg_gnf',
            field=models.BigIntegerField(
                default=0,
                help_text='Surcharge par kg supplémentaire en GNF (0 = pas de surcharge)'
            ),
        ),

        # Order — distance et poids saisis par l'acheteur
        migrations.AddField(
            model_name='order',
            name='delivery_distance_km',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=7, null=True,
                help_text="Distance de livraison en km (saisie par l'acheteur)"
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_weight_kg',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=6, null=True,
                help_text="Poids du colis en kg (saisie par l'acheteur)"
            ),
        ),
    ]
