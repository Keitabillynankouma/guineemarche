from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_sitesettings_support_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='auto_approve_listings',
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Si activé, les annonces douteuses (review) sont publiées immédiatement. "
                    "Seules les annonces clairement interdites sont bloquées."
                ),
                verbose_name='Auto-publication des annonces',
            ),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='livreur_commission_pct',
            field=models.PositiveSmallIntegerField(
                default=80,
                help_text="Pourcentage des frais de livraison reversé au livreur (ex: 80 = le livreur garde 80%).",
                verbose_name='Part livreur (%)',
            ),
        ),
    ]
