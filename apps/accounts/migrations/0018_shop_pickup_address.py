"""Migration vide — placeholder pour coexister avec 0018_alter_user_payout_phone_and_more
qui existe sur le serveur de production mais pas dans le repo local.
Le vrai champ pickup_address est ajouté dans 0019_shop_pickup_address.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_user_role_maxlength_30_point_retrait_manager'),
    ]

    operations = []
