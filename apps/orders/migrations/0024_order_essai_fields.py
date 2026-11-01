from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0023_order_buyer_service_fee_gnf'),
    ]

    operations = [
        # Nouveaux statuts : au_point_retrait, en_essai, retourne
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending',           'En attente'),
                    ('confirmed',         'Confirmée'),
                    ('pickup_confirmed',  'Collecté par livreur'),
                    ('au_point_retrait',  'Arrivé au point de retrait'),
                    ('en_essai',          "En cours d'essai"),
                    ('completed',         'Terminée'),
                    ('cancelled',         'Annulée'),
                    ('disputed',          'Litige'),
                    ('retourne',          'Retourné'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        # Champs essai
        migrations.AddField(
            model_name='order',
            name='essai_started_at',
            field=models.DateTimeField(blank=True, null=True, help_text="Heure de début d'essai"),
        ),
        migrations.AddField(
            model_name='order',
            name='essai_return_reason',
            field=models.CharField(
                blank=True, max_length=30,
                choices=[
                    ('taille_incorrecte',  "Taille incorrecte selon l'annonce"),
                    ('couleur_differente', 'Couleur différente des photos'),
                    ('article_abime',      'Article abîmé / défectueux'),
                    ('changement_avis',    "Changement d'avis"),
                    ('autre',              'Autre raison'),
                ],
                help_text='Motif de retour après essai',
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='essai_return_photo',
            field=models.ImageField(
                blank=True, null=True,
                upload_to='essai_returns/',
                help_text="Photo de l'article au moment du retour",
            ),
        ),
    ]
