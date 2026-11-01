from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0024_order_essai_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='essai_return_resolved',
            field=models.BooleanField(
                default=False,
                help_text="Retour essai traité par l'admin (remboursement acheteur + déduction vendeur si applicable)"
            ),
        ),
    ]
