"""
Validation sécurisée des fichiers uploadés.
Vérifie les magic bytes réels (pas juste l'extension) pour éviter
qu'un fichier malveillant soit uploadé en renommant son extension.
"""
import os
import logging
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# ── Limites ───────────────────────────────────────────────────────────────────

MAX_IMAGE_SIZE  = 10 * 1024 * 1024   # 10 Mo
MAX_VIDEO_SIZE  = 100 * 1024 * 1024  # 100 Mo
MAX_IMAGE_COUNT = 8                   # Par annonce

# ── Magic bytes des formats autorisés ─────────────────────────────────────────

# (signature_bytes, offset, label)
ALLOWED_IMAGE_SIGNATURES = [
    (b'\xff\xd8\xff',           0, 'JPEG'),
    (b'\x89PNG\r\n\x1a\n',     0, 'PNG'),
    (b'GIF87a',                 0, 'GIF'),
    (b'GIF89a',                 0, 'GIF'),
    (b'RIFF',                   0, 'WEBP'),   # WEBP commence par RIFF
    (b'\x00\x00\x00\x0cjP  ',  0, 'JPEG2000'),
    (b'\x00\x00\x00 ftyp',     0, 'HEIC'),
    (b'\x00\x00\x00\x18ftyp',  0, 'HEIC'),
]

ALLOWED_VIDEO_SIGNATURES = [
    (b'\x00\x00\x00\x18ftyp',  0, 'MP4'),
    (b'\x00\x00\x00\x20ftyp',  0, 'MP4'),
    (b'ftyp',                   4, 'MP4/MOV'),
    (b'\x1aE\xdf\xa3',         0, 'WEBM/MKV'),
    (b'RIFF',                   0, 'AVI'),
    (b'\x00\x00\x01\xba',      0, 'MPEG'),
    (b'\x00\x00\x01\xb3',      0, 'MPEG'),
]

# Extensions autorisées (double vérification)
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'}
ALLOWED_VIDEO_EXTENSIONS = {'.mp4', '.mov', '.webm', '.avi', '.mkv', '.mpeg', '.mpg'}

# Patterns dangereux dans les noms de fichiers
DANGEROUS_EXTENSIONS = {
    '.php', '.php3', '.php4', '.php5', '.phtml', '.phar',
    '.asp', '.aspx', '.jsp', '.jspx',
    '.exe', '.sh', '.bat', '.cmd', '.ps1',
    '.py', '.rb', '.pl', '.cgi',
    '.htaccess', '.htpasswd',
    '.svg',   # SVG peut contenir du JavaScript
}


def _read_magic(file_obj, size=32):
    """Lit les premiers octets du fichier sans déplacer le curseur."""
    file_obj.seek(0)
    magic = file_obj.read(size)
    file_obj.seek(0)
    return magic


def _detect_file_type(magic_bytes, signatures):
    """Retourne le label du format détecté, ou None si non reconnu."""
    for sig, offset, label in signatures:
        if magic_bytes[offset:offset + len(sig)] == sig:
            return label
    return None


def validate_image_file(file):
    """
    Validateur pour les images uploadées sur les annonces.
    Vérifie : taille, extension, et magic bytes réels.
    """
    # 1. Taille maximale
    if file.size > MAX_IMAGE_SIZE:
        raise ValidationError(
            f"Image trop lourde ({file.size // (1024*1024)} Mo). Maximum autorisé : 10 Mo."
        )

    # 2. Extension (doit figurer dans la liste blanche)
    ext = os.path.splitext(file.name)[1].lower()
    if ext in DANGEROUS_EXTENSIONS:
        logger.warning("[SECURITY] Upload refusé — extension dangereuse: %s", file.name)
        raise ValidationError(f"Type de fichier '{ext}' non autorisé.")
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f"Extension '{ext}' non acceptée. Formats : JPG, PNG, GIF, WEBP, HEIC."
        )

    # 3. Magic bytes — vérification du contenu réel
    magic = _read_magic(file)
    detected = _detect_file_type(magic, ALLOWED_IMAGE_SIGNATURES)
    if not detected:
        # Vérification spéciale WEBP : RIFF....WEBP
        if magic[:4] == b'RIFF' and magic[8:12] == b'WEBP':
            detected = 'WEBP'
    if not detected:
        logger.warning(
            "[SECURITY] Upload refusé — magic bytes invalides: %s (magic=%s)",
            file.name, magic[:12].hex()
        )
        raise ValidationError(
            "Le fichier ne semble pas être une image valide. "
            "Vérifiez qu'il n'est pas corrompu."
        )

    return file


def validate_video_file(file):
    """
    Validateur pour les vidéos uploadées sur les annonces.
    """
    if file.size > MAX_VIDEO_SIZE:
        raise ValidationError(
            f"Vidéo trop lourde ({file.size // (1024*1024)} Mo). Maximum : 100 Mo."
        )

    ext = os.path.splitext(file.name)[1].lower()
    if ext in DANGEROUS_EXTENSIONS:
        logger.warning("[SECURITY] Upload vidéo refusé — extension dangereuse: %s", file.name)
        raise ValidationError(f"Type de fichier '{ext}' non autorisé.")
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValidationError(
            f"Extension '{ext}' non acceptée. Formats : MP4, MOV, WEBM, AVI."
        )

    magic = _read_magic(file)
    detected = _detect_file_type(magic, ALLOWED_VIDEO_SIGNATURES)
    # MP4/MOV: 'ftyp' peut être à l'offset 4
    if not detected and magic[4:8] == b'ftyp':
        detected = 'MP4'
    if not detected:
        logger.warning(
            "[SECURITY] Upload vidéo refusé — magic bytes invalides: %s",
            file.name
        )
        raise ValidationError(
            "Le fichier ne semble pas être une vidéo valide."
        )

    return file
