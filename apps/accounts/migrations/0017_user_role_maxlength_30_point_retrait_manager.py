from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_expand_payout_provider_choices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('buyer',                 'Acheteur'),
                    ('seller',                'Vendeur'),
                    ('admin',                 'Administrateur'),
                    ('livreur',               'Livreur'),
                    ('super_admin',           'Super Administrateur'),
                    ('admin_delivery',        'Admin Livraison'),
                    ('admin_marketing',       'Admin Marketing'),
                    ('admin_accounting',      'Admin Comptabilité'),
                    ('point_retrait_manager', 'Gestionnaire Point de Retrait'),
                ],
                default='buyer',
                max_length=30,
            ),
        ),
    ]
