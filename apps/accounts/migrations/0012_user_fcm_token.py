from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_admin_sub_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='fcm_token',
            field=models.CharField(
                max_length=512,
                blank=True,
                default='',
                help_text='Token FCM du dernier appareil connecté (web ou mobile)',
            ),
        ),
    ]
