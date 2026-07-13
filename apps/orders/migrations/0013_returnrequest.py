from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0012_intra_city_zone_rate'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReturnRequest',
            fields=[
                ('id',          models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
                ('order',       models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='return_request',
                    to='orders.order',
                    help_text='La commande concernée (doit être terminée)',
                )),
                ('reason',      models.CharField(
                    max_length=20,
                    choices=[
                        ('defective',        'Article défectueux'),
                        ('not_as_described', 'Ne correspond pas à la description'),
                        ('wrong_item',       'Mauvais article reçu'),
                        ('changed_mind',     "Changement d'avis"),
                        ('other',            'Autre'),
                    ],
                )),
                ('description', models.TextField(blank=True, help_text='Détail optionnel de la demande')),
                ('status',      models.CharField(
                    max_length=12, default='pending',
                    choices=[
                        ('pending',   'En attente'),
                        ('approved',  'Approuvé'),
                        ('rejected',  'Refusé'),
                        ('completed', 'Retour effectué'),
                    ],
                )),
                ('admin_note',  models.TextField(blank=True, help_text="Note interne de l'admin")),
                ('resolved_at', models.DateTimeField(null=True, blank=True)),
            ],
            options={
                'verbose_name':        'Demande de retour',
                'verbose_name_plural': 'Demandes de retour',
                'ordering':            ['-created_at'],
            },
        ),
    ]
