from django.db import migrations, models


class Migration(migrations.Migration):
    """
    La colonne essai_return_resolved existe déjà en production (créée manuellement
    ou lors d'un déploiement partiel). On utilise SeparateDatabaseAndState pour
    enregistrer l'état dans django_migrations sans exécuter l'ALTER TABLE.
    """

    dependencies = [
        ('orders', '0024_order_essai_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # database_operations = vide → ne touche pas à la DB
            database_operations=[],
            # state_operations → Django sait que le champ existe
            state_operations=[
                migrations.AddField(
                    model_name='order',
                    name='essai_return_resolved',
                    field=models.BooleanField(
                        default=False,
                        help_text="Retour essai traité par l'admin (remboursement acheteur + déduction vendeur si applicable)"
                    ),
                ),
            ],
        ),
    ]
