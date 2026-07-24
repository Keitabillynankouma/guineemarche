from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_adminuser_proxy'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('buyer',            'Acheteur'),
                    ('seller',           'Vendeur'),
                    ('admin',            'Administrateur'),
                    ('livreur',          'Livreur'),
                    ('super_admin',      'Super Administrateur'),
                    ('admin_delivery',   'Admin Livraison'),
                    ('admin_marketing',  'Admin Marketing'),
                    ('admin_accounting', 'Admin Comptabilité'),
                ],
                default='buyer',
            ),
        ),
    ]
