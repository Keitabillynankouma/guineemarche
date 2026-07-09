"""
Migration : inscription diaspora
- phone_number devient nullable (les utilisateurs diaspora n'ont pas de numéro guinéen)
- email devient unique (null=True — PostgreSQL accepte plusieurs NULL dans une contrainte unique)
"""
import phonenumber_field.modelfields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_alter_user_referral_code'),
    ]

    operations = [
        # 1. phone_number nullable (les utilisateurs existants gardent leur numéro)
        migrations.AlterField(
            model_name='user',
            name='phone_number',
            field=phonenumber_field.modelfields.PhoneNumberField(
                blank=True, null=True, region='GN', unique=True, max_length=128,
            ),
        ),
        # 2. email unique (null=True : pas de conflit entre plusieurs utilisateurs sans email)
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(blank=True, null=True, unique=True, max_length=254),
        ),
    ]
