import psycopg2
import sys

# Railway PostgreSQL public URL
DB_URL = "postgresql://postgres:zwdkBYcoIdSqKxeWADRPnxMDhlEUCKGr@acela.proxy.rlwy.net:20200/railway"

SQL_FILE = r"C:\Users\DNTCP\guineemarche\guimatrix_backup.sql"

print("Connexion a Railway PostgreSQL...")
conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

print(f"Lecture du fichier backup: {SQL_FILE}")
with open(SQL_FILE, 'r', encoding='utf-8') as f:
    sql = f.read()

print("Execution du backup SQL...")
try:
    cur.execute(sql)
    conn.commit()
    print("Import reussi !")
except Exception as e:
    conn.rollback()
    print(f"Erreur: {e}")
    # Try statement by statement
    print("Tentative instruction par instruction...")
    conn2 = psycopg2.connect(DB_URL)
    conn2.autocommit = True
    cur2 = conn2.cursor()

    statements = sql.split(';')
    errors = 0
    success = 0
    for i, stmt in enumerate(statements):
        stmt = stmt.strip()
        if not stmt:
            continue
        try:
            cur2.execute(stmt)
            success += 1
        except Exception as e2:
            errors += 1
            if errors <= 5:
                print(f"  Erreur stmt {i}: {e2}")

    print(f"Termine: {success} succes, {errors} erreurs")
    conn2.close()
finally:
    cur.close()
    conn.close()

print("Import termine.")
