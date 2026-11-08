from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_shop_pickup_address'),
    ]

    operations = [
        migrations.AddField(
            model_name='shop',
            name='pickup_latitude',
            field=models.FloatField(
                blank=True, null=True,
                help_text="Latitude GPS de l'adresse de collecte",
            ),
        ),
        migrations.AddField(
            model_name='shop',
            name='pickup_longitude',
            field=models.FloatField(
                blank=True, null=True,
                help_text="Longitude GPS de l'adresse de collecte",
            ),
        ),
    ]
