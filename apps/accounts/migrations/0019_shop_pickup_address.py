from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0018_shop_pickup_address'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='pickup_address',
            field=models.CharField(
                blank=True,
                help_text='Adresse de collecte des colis par le livreur',
                max_length=300,
            ),
        ),
    ]
