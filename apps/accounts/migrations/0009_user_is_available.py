"""Ajoute is_available sur User — statut de disponibilité du livreur."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_user_role_livreur'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_available',
            field=models.BooleanField(
                default=True,
                help_text='Livreur disponible pour recevoir des commandes',
            ),
        ),
    ]
