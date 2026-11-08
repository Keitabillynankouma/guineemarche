from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0026_order_article_payment_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='pickup_photo',
            field=models.ImageField(
                blank=True, null=True,
                upload_to='pickup_photos/',
                help_text="Photo du colis emballé prise par le livreur lors de la collecte chez le vendeur",
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='pickup_collected_at',
            field=models.DateTimeField(
                blank=True, null=True,
                help_text="Date/heure exacte de la collecte chez le vendeur",
            ),
        ),
    ]
