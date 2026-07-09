import psycopg2
import psycopg2.extras

RENDER_URL = "postgresql://guineemarche_db_user:FpIC8b1kUpUfwjOeRkHa473b2bnTtWnl@dpg-d8e49dv7f7vs73cq19a0-a.frankfurt-postgres.render.com/guineemarche_db"
RAILWAY_URL = "postgresql://postgres:zwdkBYcoIdSqKxeWADRPnxMDhlEUCKGr@acela.proxy.rlwy.net:20200/railway"

print("Connexion aux deux bases...")
src = psycopg2.connect(RENDER_URL)
dst = psycopg2.connect(RAILWAY_URL)
src.autocommit = True
dst.autocommit = False

src_cur = src.cursor()
dst_cur = dst.cursor()

# Desactiver les contraintes FK sur Railway (session_replication_role = replica)
print("\n=== Desactivation des contraintes FK ===")
dst_cur.execute("SET session_replication_role = 'replica'")
dst.commit()

# Lister toutes les tables source
src_cur.execute("""
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
""")
tables = [row[0] for row in src_cur.fetchall()]
print(f"Tables trouvees: {tables}")

errors = []
migrated = {}

# Copier chaque table
for table in tables:
    print(f"\nTable: {table}")

    src_cur.execute(f'SELECT * FROM "{table}"')
    rows = src_cur.fetchall()
    print(f"  {len(rows)} lignes")

    if not rows:
        migrated[table] = 0
        continue

    col_names = [desc[0] for desc in src_cur.description]
    cols_str = ', '.join(f'"{c}"' for c in col_names)

    try:
        psycopg2.extras.execute_values(
            dst_cur,
            f'INSERT INTO "{table}" ({cols_str}) VALUES %s ON CONFLICT DO NOTHING',
            rows,
            page_size=500
        )
        dst.commit()
        migrated[table] = len(rows)
        print(f"  OK - {len(rows)} lignes inserees")
    except Exception as e:
        dst.rollback()
        errors.append((table, str(e)))
        print(f"  ERREUR: {e}")

# Reactiver les contraintes FK
print("\n=== Reactivation des contraintes FK ===")
dst_cur.execute("SET session_replication_role = 'origin'")
dst.commit()

# Mettre a jour les sequences (eviter les conflits d'ID futurs)
print("\n=== Mise a jour des sequences ===")
dst_cur.execute("""
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
""")
sequences = [row[0] for row in dst_cur.fetchall()]

for seq in sequences:
    try:
        dst_cur.execute(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM \"{seq.replace('_id_seq', '')}\"), 1))")
        dst.commit()
        print(f"  Sequence {seq} mise a jour")
    except Exception as e:
        dst.rollback()
        print(f"  Sequence {seq} ignoree: {e}")

src.close()
dst.close()

print("\n=== RESUME ===")
print(f"Tables migrees: {len(migrated)}")
for t, n in migrated.items():
    print(f"  {t}: {n} lignes")

if errors:
    print(f"\nERREURS ({len(errors)}):")
    for t, e in errors:
        print(f"  {t}: {e}")
else:
    print("\nAucune erreur !")

print("\nMigration terminee !")
