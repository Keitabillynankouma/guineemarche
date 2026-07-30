"""
Génère les assets placeholder pour le build EAS.
Lance depuis le dossier mobile/ :
    python generate_assets.py
"""
import os
import struct
import zlib

def make_png(width, height, r, g, b, filepath):
    """Crée un PNG monochrome sans dépendances externes."""
    def png_chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw = b''
    row = b'\x00' + bytes([r, g, b] * width)
    raw = row * height
    idat = zlib.compress(raw)

    png  = b'\x89PNG\r\n\x1a\n'
    png += png_chunk(b'IHDR', ihdr)
    png += png_chunk(b'IDAT', idat)
    png += png_chunk(b'IEND', b'')

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        f.write(png)
    print(f"  ✓ {os.path.basename(filepath)} ({width}x{height})")

assets = os.path.join(os.path.dirname(__file__), 'assets')

print("Génération des assets Guimatrix (vert #16a34a)...")
make_png(1024, 1024, 22, 163,  74, os.path.join(assets, 'icon.png'))
make_png(1024, 1024, 22, 163,  74, os.path.join(assets, 'adaptive-icon.png'))
make_png(1284, 2778, 22, 163,  74, os.path.join(assets, 'splash.png'))
print("Done — dossier assets/ prêt.")
print("Maintenant : npm install && npm run build:android")
