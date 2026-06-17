from django.db import migrations, models
import uuid


def _seed_meeting_zones(apps, schema_editor):
    MeetingZone = apps.get_model('orders', 'MeetingZone')

    ZONES = {
        'Conakry': [
            'Centre Commercial Kaloum', 'Boulbinet — Marché', 'Port de Conakry',
            'Coleah Centre', 'Belle-Vue', 'Dixinn Centre',
            'Marché Madina', 'Carrefour Hamdallaye', 'Carrefour Bambéto',
            'Carrefour Kipé', 'Carrefour Cosa', 'Carrefour Kaporo',
            'Sonfonia Centre', 'Wanindara Carrefour', 'Gbessia Port',
            'Carrefour Matoto', 'Kobaya Centre', 'Kagbelen Centre', 'Carrefour Enta',
        ],
        'Kindia':      ['Grand Marché de Kindia', 'Carrefour Central Kindia', 'Gare Routière de Kindia'],
        'Mamou':       ['Grand Marché de Mamou', 'Carrefour Central Mamou', 'Gare Routière de Mamou'],
        'Labé':        ['Grand Marché de Labé', 'Carrefour Central Labé', 'Gare Routière de Labé', 'Tata Centre'],
        'Kankan':      ['Grand Marché de Kankan', 'Carrefour Central Kankan', 'Gare Routière de Kankan', 'Quartier Farako'],
        'Faranah':     ['Grand Marché de Faranah', 'Carrefour Central Faranah', 'Gare Routière de Faranah'],
        'Kissidougou': ['Grand Marché de Kissidougou', 'Carrefour Central Kissidougou'],
        'Guéckédou':   ['Grand Marché de Guéckédou', 'Carrefour Central Guéckédou'],
        'Macenta':     ['Grand Marché de Macenta', 'Carrefour Central Macenta'],
        'Nzérékoré':   ['Grand Marché de Nzérékoré', 'Carrefour Central Nzérékoré', 'Quartier Yomou', 'Gare Routière Nzérékoré'],
        'Boké':        ['Grand Marché de Boké', 'Carrefour Central Boké'],
        'Fria':        ['Carrefour de Fria', 'Grand Marché de Fria'],
        'Coyah':       ['Carrefour de Coyah', 'Grand Marché de Coyah'],
        'Dubréka':     ['Grand Marché de Dubréka', 'Carrefour Central Dubréka'],
        'Télimélé':    ['Grand Marché de Télimélé'],
        'Pita':        ['Grand Marché de Pita', 'Carrefour Pita Centre'],
        'Dinguiraye':  ['Grand Marché de Dinguiraye'],
        'Siguiri':     ['Grand Marché de Siguiri', 'Carrefour Siguiri Centre'],
        'Kérouané':    ['Grand Marché de Kérouané'],
        'Koundara':    ['Grand Marché de Koundara'],
        'Gaoual':      ['Grand Marché de Gaoual'],
    }

    objs = []
    for city, names in ZONES.items():
        for name in names:
            objs.append(MeetingZone(city=city, name=name))
    MeetingZone.objects.bulk_create(objs, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_order_escrow_schedule_fields'),
    ]

    operations = [
        # Nouveau modèle MeetingZone
        migrations.CreateModel(
            name='MeetingZone',
            fields=[
                ('id',        models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('created_at',models.DateTimeField(auto_now_add=True)),
                ('updated_at',models.DateTimeField(auto_now=True)),
                ('city',      models.CharField(db_index=True, max_length=100)),
                ('name',      models.CharField(max_length=200)),
                ('address',   models.CharField(blank=True, max_length=300)),
                ('latitude',  models.FloatField(blank=True, null=True)),
                ('longitude', models.FloatField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Zone de rencontre',
                'verbose_name_plural': 'Zones de rencontre',
                'ordering': ['city', 'name'],
            },
        ),
        # Ajouter MTN_MOMO dans Payment.provider
        migrations.AlterField(
            model_name='payment',
            name='provider',
            field=models.CharField(
                choices=[
                    ('orange_money', 'Orange Money'),
                    ('mtn_momo',     'MTN Mobile Money'),
                    ('cash',         'Espèces (remise en main)'),
                    ('card',         'Carte bancaire'),
                ],
                max_length=15,
            ),
        ),
        # Pré-remplir les zones depuis le fichier statique
        migrations.RunPython(
            code=_seed_meeting_zones,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
