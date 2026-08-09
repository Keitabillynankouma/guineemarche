from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('listings', '0007_listing_boost_expires_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='listing',
            name='allowed_delivery_modes',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Liste des modes de livraison autorisés : ['home_delivery', 'pickup']",
            ),
        ),
        migrations.AddField(
            model_name='listing',
            name='pickup_address',
            field=models.CharField(
                blank=True,
                max_length=300,
                help_text='Adresse/description du point de retrait (si mode retrait activé)',
            ),
        ),
    ]
