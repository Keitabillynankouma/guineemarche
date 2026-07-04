from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Supprime le default='' sur referral_code qui était présent dans 0005
    mais absent dans le modèle actuel (Django détectait une différence).
    """

    dependencies = [
        ('accounts', '0005_referral'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, db_index=True, max_length=12, unique=True),
        ),
    ]
