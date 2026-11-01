from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0021_pickuppoint_gps_manager'),
    ]

    operations = [
        migrations.AddField(
            model_name='capitalreserve',
            name='buyer_service_fee',
            field=models.PositiveIntegerField(
                default=10000,
                help_text='Frais de service prélevés sur l\'acheteur (inclus silencieusement dans le total)',
            ),
        ),
    ]
