"""Ajoute le champ pickup_code à DeliveryAssignment (code que le livreur montre au vendeur)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0009_deliveryassignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='deliveryassignment',
            name='pickup_code',
            field=models.CharField(
                blank=True,
                help_text='Code 6 chiffres que le livreur montre au vendeur pour récupérer le colis',
                max_length=6,
            ),
        ),
    ]
