"""Ajoute le rôle LIVREUR aux choix du champ User.role."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_email_unique_phone_nullable'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('buyer',   'Acheteur'),
                    ('seller',  'Vendeur'),
                    ('admin',   'Administrateur'),
                    ('livreur', 'Livreur'),
                ],
                default='buyer',
            ),
        ),
    ]
