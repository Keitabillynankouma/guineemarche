"""
Management command to seed the initial pickup points for Guimatrix.

Usage:
    python manage.py seed_pickup_points
    python manage.py seed_pickup_points --force   # re-create even if already exists
"""

from django.core.management.base import BaseCommand
from apps.orders.models import PickupPoint


PICKUP_POINTS = [
    {
        "name": "Camp Carrefour Yimbaya",
        "address": "Camp Carrefour, Yimbaya",
        "city": "Conakry",
        "commune": "Matoto",
        "phone": "620349502",
        "latitude": 9.5937307,
        "longitude": -13.6047636,
        "opening_hours": "Lun-Sam 8h-18h",
        "is_active": True,
    },
    {
        "name": "Kondébougni Matoto",
        "address": "Kondébougni, Matoto",
        "city": "Conakry",
        "commune": "Matoto",
        "phone": "622855564",
        "latitude": 9.585261,
        "longitude": -13.605361,
        "opening_hours": "Lun-Sam 8h-18h",
        "is_active": True,
    },
]


class Command(BaseCommand):
    help = "Crée les points de retrait initiaux de Guimatrix"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Met à jour les enregistrements existants",
        )

    def handle(self, *args, **options):
        force = options["force"]
        created_count = 0
        updated_count = 0

        for data in PICKUP_POINTS:
            phone = data["phone"]
            obj, created = PickupPoint.objects.update_or_create(
                phone=phone,
                defaults=data,
            ) if force else (
                PickupPoint.objects.get_or_create(phone=phone, defaults=data)
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  ✅ Créé : {obj.name}"))
            else:
                if force:
                    updated_count += 1
                    self.stdout.write(self.style.WARNING(f"  🔄 Mis à jour : {obj.name}"))
                else:
                    self.stdout.write(f"  — Existe déjà : {obj.name} (utilise --force pour mettre à jour)")

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✔ Terminé — {created_count} créé(s), {updated_count} mis à jour."
            )
        )
