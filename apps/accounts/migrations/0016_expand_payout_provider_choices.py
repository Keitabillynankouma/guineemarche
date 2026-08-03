from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_alter_user_payout_phone_alter_user_payout_provider_and_more'),
    ]

    operations = [
        # User.payout_provider — ajouter PayCard, Kulu, Soutra Money, Akiba
        migrations.AlterField(
            model_name='user',
            name='payout_provider',
            field=models.CharField(
                blank=True,
                choices=[
                    ('orange_money', 'Orange Money'),
                    ('mtn_momo',     'MTN MoMo'),
                    ('paycard',      'PayCard'),
                    ('kulu',         'Kulu'),
                    ('soutra_money', 'Soutra Money'),
                    ('akiba',        'Akiba'),
                ],
                help_text='Opérateur pour les virements',
                max_length=15,
            ),
        ),
        # UserProfile.payout_provider — même extension
        migrations.AlterField(
            model_name='userprofile',
            name='payout_provider',
            field=models.CharField(
                blank=True,
                choices=[
                    ('orange_money', 'Orange Money'),
                    ('mtn_momo',     'MTN MoMo'),
                    ('paycard',      'PayCard'),
                    ('kulu',         'Kulu'),
                    ('soutra_money', 'Soutra Money'),
                    ('akiba',        'Akiba'),
                ],
                help_text='Opérateur pour les versements',
                max_length=15,
            ),
        ),
    ]
