from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0022_capitalreserve_buyer_service_fee'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='buyer_service_fee_gnf',
            field=models.BigIntegerField(
                default=0,
                help_text="Frais de service plateforme inclus dans amount_gnf (non affichés à l'acheteur)",
            ),
        ),
    ]
