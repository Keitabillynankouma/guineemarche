from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='SiteSettings',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('free_listings_enabled', models.BooleanField(default=True, help_text='Si activé, tous les utilisateurs publient sans limite.', verbose_name='Publications gratuites illimitées')),
                ('subscriptions_enabled', models.BooleanField(default=False, help_text='Affiche la page Tarifs et active les vérifications de plan.', verbose_name='Abonnements actifs')),
                ('max_free_listings', models.PositiveSmallIntegerField(default=5, verbose_name='Limite annonces gratuites')),
                ('commission_pct', models.PositiveSmallIntegerField(default=4, verbose_name='Commission escrow (%)')),
                ('escrow_enabled', models.BooleanField(default=True, verbose_name='Paiement escrow activé')),
                ('shop_approval_required', models.BooleanField(default=True, verbose_name='Validation boutique par admin')),
                ('whatsapp_contact', models.CharField(blank=True, default='', max_length=30, verbose_name='WhatsApp contact admin')),
                ('site_name', models.CharField(default='GuinéeMarché', max_length=100)),
                ('tagline', models.CharField(blank=True, default='Le marché en ligne de la Guinée', max_length=200)),
                ('maintenance_mode', models.BooleanField(default=False, verbose_name='Mode maintenance')),
                ('maintenance_message', models.TextField(blank=True, default='', verbose_name='Message de maintenance')),
            ],
            options={'verbose_name': 'Paramètres du site'},
        ),
    ]
