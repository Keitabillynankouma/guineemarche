import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0015_livreur_payment'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LivreurFine',
            fields=[
                ('id',           models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('updated_at',   models.DateTimeField(auto_now=True)),
                ('amount_gnf',   models.BigIntegerField(help_text="Montant de l'amende en GNF")),
                ('reason',       models.CharField(
                    choices=[
                        ('late_delivery',   'Retard de livraison'),
                        ('damaged_package', 'Colis abîmé'),
                        ('bad_behavior',    'Mauvaise conduite'),
                        ('fraud_attempt',   'Tentative de fraude'),
                        ('no_show',         'Absence injustifiée'),
                        ('other',           'Autre'),
                    ],
                    default='other', max_length=20,
                )),
                ('description',  models.TextField(blank=True)),
                ('status',       models.CharField(
                    choices=[('pending', 'À déduire'), ('deducted', 'Déduite'), ('waived', 'Annulée')],
                    default='pending', max_length=10,
                )),
                ('deducted_at',  models.DateTimeField(blank=True, null=True)),
                ('admin_note',   models.TextField(blank=True)),
                ('livreur',      models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='fines', to=settings.AUTH_USER_MODEL,
                )),
                ('order',        models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='livreur_fines', to='orders.order',
                )),
            ],
            options={
                'verbose_name': 'Amende livreur',
                'verbose_name_plural': 'Amendes livreurs',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='LivreurWeeklyPayout',
            fields=[
                ('id',               models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',       models.DateTimeField(auto_now_add=True)),
                ('updated_at',       models.DateTimeField(auto_now=True)),
                ('week_start',       models.DateField(help_text='Lundi de la semaine (ISO)')),
                ('week_end',         models.DateField(help_text='Dimanche de la semaine (ISO)')),
                ('deliveries_count', models.PositiveIntegerField(default=0)),
                ('gross_gnf',        models.BigIntegerField(default=0)),
                ('fines_gnf',        models.BigIntegerField(default=0)),
                ('net_gnf',          models.BigIntegerField(default=0)),
                ('status',           models.CharField(
                    choices=[('pending', 'En attente'), ('paid', 'Versé'), ('partial', 'Versement partiel'), ('on_hold', 'Bloqué')],
                    default='pending', max_length=10,
                )),
                ('paid_at',          models.DateTimeField(blank=True, null=True)),
                ('payment_ref',      models.CharField(blank=True, max_length=150)),
                ('payment_method',   models.CharField(blank=True, max_length=50)),
                ('note',             models.TextField(blank=True)),
                ('livreur',          models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='weekly_payouts', to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Virement hebdomadaire livreur',
                'verbose_name_plural': 'Virements hebdomadaires livreurs',
                'ordering': ['-week_start'],
                'unique_together': {('livreur', 'week_start')},
            },
        ),
    ]
