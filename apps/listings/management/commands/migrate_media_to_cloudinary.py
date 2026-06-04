"""
Migre les images stockées localement vers Cloudinary.

Utilisation :
    python manage.py migrate_media_to_cloudinary           # dry-run (aperçu)
    python manage.py migrate_media_to_cloudinary --commit  # exécution réelle

Pour migrer vers la base de données de production depuis votre machine locale :
    DATABASE_URL=<url-prod> python manage.py migrate_media_to_cloudinary --commit
"""
import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
import cloudinary
import cloudinary.uploader


class Command(BaseCommand):
    help = "Upload des images locales (media/) vers Cloudinary et mise à jour de la DB"

    def add_arguments(self, parser):
        parser.add_argument(
            '--commit',
            action='store_true',
            help='Effectuer réellement les uploads (sans --commit = dry-run)',
        )

    def handle(self, *args, **options):
        from apps.listings.models import ListingMedia
        from apps.accounts.models import UserProfile

        commit = options['commit']

        if not commit:
            self.stdout.write(self.style.WARNING(
                "Mode dry-run — ajoutez --commit pour uploader réellement"
            ))

        cloud_name = (
            os.environ.get('CLOUDINARY_CLOUD_NAME') or
            settings.CLOUDINARY_STORAGE.get('CLOUD_NAME', '')
        )
        if not cloud_name:
            self.stderr.write(self.style.ERROR(
                "Cloudinary non configuré. Définissez CLOUDINARY_CLOUD_NAME."
            ))
            return

        if commit:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=(
                    os.environ.get('CLOUDINARY_API_KEY') or
                    settings.CLOUDINARY_STORAGE.get('API_KEY', '')
                ),
                api_secret=(
                    os.environ.get('CLOUDINARY_API_SECRET') or
                    settings.CLOUDINARY_STORAGE.get('API_SECRET', '')
                ),
                secure=True,
            )

        media_root = Path(settings.MEDIA_ROOT)
        ok = skipped = missing = 0

        self.stdout.write(f"\n--- Annonces (ListingMedia) ---")
        for obj in ListingMedia.objects.exclude(file='').order_by('id'):
            file_name = str(obj.file)
            # Ignorer les chemins déjà absolus (déjà sur Cloudinary)
            if file_name.startswith('http'):
                skipped += 1
                continue

            local_path = media_root / file_name
            if not local_path.exists():
                self.stdout.write(self.style.ERROR(
                    f"  MANQUANT  {file_name}"
                ))
                missing += 1
                continue

            public_id = file_name.rsplit('.', 1)[0]  # chemin sans extension
            self.stdout.write(f"  UPLOAD   {file_name} → cloudinary:{public_id}")

            if commit:
                try:
                    cloudinary.uploader.upload(
                        str(local_path),
                        public_id=public_id,
                        overwrite=False,
                        resource_type='image',
                    )
                    ok += 1
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(f"           Erreur: {exc}"))
            else:
                ok += 1

        self.stdout.write(f"\n--- Profils (avatar) ---")
        for obj in UserProfile.objects.exclude(avatar_url='').order_by('id'):
            file_name = str(obj.avatar_url)
            if file_name.startswith('http'):
                skipped += 1
                continue

            local_path = media_root / file_name
            if not local_path.exists():
                self.stdout.write(self.style.ERROR(
                    f"  MANQUANT  {file_name}"
                ))
                missing += 1
                continue

            public_id = file_name.rsplit('.', 1)[0]
            self.stdout.write(f"  UPLOAD   {file_name} → cloudinary:{public_id}")

            if commit:
                try:
                    cloudinary.uploader.upload(
                        str(local_path),
                        public_id=public_id,
                        overwrite=False,
                        resource_type='image',
                    )
                    ok += 1
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(f"           Erreur: {exc}"))
            else:
                ok += 1

        self.stdout.write("\n" + "=" * 50)
        if commit:
            self.stdout.write(self.style.SUCCESS(
                f"Terminé : {ok} uploadés, {skipped} déjà sur Cloudinary, {missing} fichiers manquants"
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f"Dry-run : {ok} à uploader, {skipped} déjà sur Cloudinary, {missing} fichiers manquants"
            ))
            if ok > 0:
                self.stdout.write("Relancez avec --commit pour effectuer les uploads.")
