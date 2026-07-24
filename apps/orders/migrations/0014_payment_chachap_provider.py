from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0013_returnrequest'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='provider',
            field=models.CharField(
                max_length=15,
                choices=[
                    ('chachap',      'ChaChap Pay'),
                    ('orange_money', 'Orange Money'),
                    ('mtn_momo',     'MTN Mobile Money'),
                    ('cash',         'Espèces (remise en main)'),
                    ('card',         'Carte bancaire'),
                ],
            ),
        ),
    ]
