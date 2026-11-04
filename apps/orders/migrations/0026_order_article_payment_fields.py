from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Les colonnes article_amount_gnf, article_paid et payment_type (sur Payment)
    existent déjà en production. SeparateDatabaseAndState enregistre l'état
    sans exécuter d'ALTER TABLE.
    """

    dependencies = [
        ('orders', '0025_order_essai_return_resolved'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='order',
                    name='article_amount_gnf',
                    field=models.BigIntegerField(
                        default=0,
                        help_text="Prix de l'article — prélevé au PDR à la confirmation (non prélevé à la commande)"
                    ),
                ),
                migrations.AddField(
                    model_name='order',
                    name='article_paid',
                    field=models.BooleanField(
                        default=False,
                        help_text="L'acheteur a payé le prix de l'article (confirmation au PDR)"
                    ),
                ),
                migrations.AddField(
                    model_name='payment',
                    name='payment_type',
                    field=models.CharField(
                        choices=[('commitment', 'Engagement (livraison + service)'), ('article', 'Prix article (au PDR)')],
                        default='commitment',
                        help_text='commitment = paiement à la commande; article = paiement au PDR',
                        max_length=12,
                    ),
                ),
            ],
        ),
    ]
