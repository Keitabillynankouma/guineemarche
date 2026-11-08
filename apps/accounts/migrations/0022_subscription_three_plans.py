from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0021_shopreview_shopfollow'),
    ]

    operations = [
        # Mise à jour des choix du champ plan + max_length 10 → 10 (inchangé)
        migrations.AlterField(
            model_name='subscription',
            name='plan',
            field=models.CharField(
                choices=[
                    ('free',     'Gratuit — 3 annonces'),
                    ('pro',      'Pro — 15 annonces + boost'),
                    ('business', 'Business — illimité + support prioritaire'),
                ],
                default='free',
                max_length=10,
            ),
        ),
    ]
