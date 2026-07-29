from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_fcm_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='payout_phone',
            field=models.CharField(
                max_length=20,
                blank=True,
                default='',
                help_text='Numéro Orange Money ou MTN MoMo pour recevoir vos paiements',
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='payout_provider',
            field=models.CharField(
                max_length=15,
                blank=True,
                default='',
                choices=[
                    ('orange_money', 'Orange Money'),
                    ('mtn_momo',     'MTN MoMo'),
                ],
                help_text='Opérateur mobile money pour les versements',
            ),
        ),
    ]
