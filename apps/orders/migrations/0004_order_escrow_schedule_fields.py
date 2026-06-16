"""
Migration: Ajout des champs escrow_release_at et escrow_admin_hold sur Order.
- escrow_release_at : date/heure planifiée de libération automatique des fonds
- escrow_admin_hold : True si l'admin a bloqué manuellement la libération
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_order_commission_gnf_order_seller_payout_gnf'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='escrow_release_at',
            field=models.DateTimeField(
                null=True,
                blank=True,
                verbose_name='Libération escrow planifiée',
                help_text='Date/heure à laquelle les fonds sont libérés automatiquement.',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='escrow_admin_hold',
            field=models.BooleanField(
                default=False,
                verbose_name='Bloqué par admin',
                help_text="Si True, la libération automatique est suspendue jusqu'à action admin.",
            ),
        ),
    ]
