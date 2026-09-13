import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('orders', '0019_sellerpayout'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AffiliateProfile',
            fields=[
                ('id',             models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',     models.DateTimeField(auto_now_add=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('status',         models.CharField(choices=[('pending','En attente'),('active','Actif'),('inactive','Inactif'),('banned','Banni')], db_index=True, default='pending', max_length=10)),
                ('display_name',   models.CharField(blank=True, max_length=150)),
                ('bio',            models.TextField(blank=True)),
                ('total_clicks',   models.PositiveIntegerField(default=0)),
                ('total_conversions', models.PositiveIntegerField(default=0)),
                ('total_earned_gnf',  models.BigIntegerField(default=0)),
                ('balance_gnf',    models.BigIntegerField(default=0)),
                ('payout_phone',   models.CharField(blank=True, max_length=20)),
                ('payout_provider', models.CharField(blank=True, choices=[('orange_money','Orange Money'),('mtn_momo','MTN MoMo'),('paycard','PayCard'),('kulu','Kulu'),('soutra_money','Soutra Money'),('akiba','Akiba')], max_length=15)),
                ('admin_note',     models.TextField(blank=True)),
                ('user',           models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='affiliate_profile', to=settings.AUTH_USER_MODEL)),
            ],
            options={'verbose_name': 'Profil affilié', 'verbose_name_plural': 'Profils affiliés', 'ordering': ['-total_earned_gnf']},
        ),
        migrations.CreateModel(
            name='AffiliateCommission',
            fields=[
                ('id',             models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',     models.DateTimeField(auto_now_add=True)),
                ('updated_at',     models.DateTimeField(auto_now=True)),
                ('level',          models.PositiveSmallIntegerField(choices=[(1,'Niveau 1 — 3%'),(2,'Niveau 2 — 1,5%'),(3,'Niveau 3 — 0,5%')])),
                ('rate_pct',       models.DecimalField(decimal_places=2, max_digits=4)),
                ('base_amount_gnf', models.BigIntegerField()),
                ('commission_gnf', models.BigIntegerField()),
                ('status',         models.CharField(choices=[('pending','En attente'),('credited','Créditée'),('reversed','Annulée')], db_index=True, default='pending', max_length=10)),
                ('credited_at',    models.DateTimeField(blank=True, null=True)),
                ('affiliate',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='commissions', to='affiliates.affiliateprofile')),
                ('order',          models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='affiliate_commissions', to='orders.order')),
            ],
            options={'verbose_name': 'Commission affilié', 'verbose_name_plural': 'Commissions affiliés', 'ordering': ['-created_at']},
        ),
        migrations.AlterUniqueTogether(
            name='affiliatecommission',
            unique_together={('affiliate', 'order', 'level')},
        ),
        migrations.CreateModel(
            name='AffiliateWithdrawal',
            fields=[
                ('id',              models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',      models.DateTimeField(auto_now_add=True)),
                ('updated_at',      models.DateTimeField(auto_now=True)),
                ('amount_gnf',      models.BigIntegerField()),
                ('payout_phone',    models.CharField(max_length=20)),
                ('payout_provider', models.CharField(choices=[('orange_money','Orange Money'),('mtn_momo','MTN MoMo'),('paycard','PayCard'),('kulu','Kulu'),('soutra_money','Soutra Money'),('akiba','Akiba')], max_length=15)),
                ('status',          models.CharField(choices=[('pending','En attente'),('approved','Approuvée'),('paid','Versée'),('rejected','Rejetée')], db_index=True, default='pending', max_length=10)),
                ('admin_note',      models.TextField(blank=True)),
                ('paid_at',         models.DateTimeField(blank=True, null=True)),
                ('payment_ref',     models.CharField(blank=True, max_length=150)),
                ('affiliate',       models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='withdrawals', to='affiliates.affiliateprofile')),
            ],
            options={'verbose_name': 'Retrait affilié', 'verbose_name_plural': 'Retraits affiliés', 'ordering': ['-created_at']},
        ),
    ]
