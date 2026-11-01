from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0025_order_essai_return_resolved'),
    ]

    operations = [
        # ── Paiement en deux étapes ───────────────────────────────────────────
        # Étape 1 (commande) : delivery_fee + buyer_service_fee — prélevé immédiatement
        # Étape 2 (PDR)      : article_amount_gnf               — prélevé si l'acheteur garde l'article
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
        # ── Type de paiement sur Payment ──────────────────────────────────────
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
    ]
