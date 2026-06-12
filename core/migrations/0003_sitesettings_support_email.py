from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_alter_sitesettings_commission_pct_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='support_email',
            field=models.EmailField(blank=True, default='', help_text='Adresse email de support visible sur le site.', verbose_name='Email support'),
        ),
        migrations.AlterField(
            model_name='sitesettings',
            name='whatsapp_contact',
            field=models.CharField(blank=True, default='', help_text='Numéro WhatsApp support visible sur le site (ex: 224XXXXXXXXX).', max_length=30, verbose_name='WhatsApp support'),
        ),
    ]
