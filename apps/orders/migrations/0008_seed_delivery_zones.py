"""Pré-charge les zones de livraison pour les principales villes guinéennes."""
from django.db import migrations


ZONES = [
    # (city, fee_gnf, estimated_days)
    ('Conakry',    25_000, 1),
    ('Kankan',     50_000, 2),
    ('Labé',       50_000, 2),
    ('Kindia',     35_000, 1),
    ('Faranah',    60_000, 3),
    ('Nzérékoré',  70_000, 3),
    ('Boké',       45_000, 2),
    ('Mamou',      45_000, 2),
    ('Siguiri',    65_000, 3),
    ('Kissidougou', 65_000, 3),
]


def create_zones(apps, schema_editor):
    DeliveryZone = apps.get_model('orders', 'DeliveryZone')
    for city, fee_gnf, estimated_days in ZONES:
        DeliveryZone.objects.get_or_create(
            city=city,
            defaults={'fee_gnf': fee_gnf, 'estimated_days': estimated_days, 'is_active': True},
        )


def delete_zones(apps, schema_editor):
    DeliveryZone = apps.get_model('orders', 'DeliveryZone')
    DeliveryZone.objects.filter(city__in=[c for c, _, _ in ZONES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_deliveryzone_and_order_delivery_fields'),
    ]

    operations = [
        migrations.RunPython(create_zones, delete_zones),
    ]
