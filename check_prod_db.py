"""
Check and fix staff records in the production (Supabase) database.
"""
import os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Try multiple Supabase connection formats
URLS_TO_TRY = [
    "postgresql://postgres.pmoacizmvyalchbxbhmf:AIRAHealth2026!Secure@db.pmoacizmvyalchbxbhmf.supabase.co:5432/postgres",
    "postgresql://postgres.pmoacizmvyalchbxbhmf:AIRAHealth2026!Secure@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres.pmoacizmvyalchbxbhmf:AIRAHealth2026!Secure@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
]

engine = None
for url in URLS_TO_TRY:
    short = url.split("@")[1].split("/")[0]
    print(f"Trying {short}...")
    try:
        eng = create_engine(url, connect_args={"connect_timeout": 8})
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = eng
        print(f"  ✅ Connected!")
        break
    except Exception as e:
        err = str(e).split('\n')[0][:80]
        print(f"  ❌ {err}")

if not engine:
    print("\nAll connection attempts failed. Please check the DATABASE_URL on Render.")
    sys.exit(1)

db = sessionmaker(bind=engine)()

# Check staff records
try:
    rows = db.execute(text("SELECT staff_id, full_name, role, status, failed_attempts FROM staff")).fetchall()
    print(f"\n📋 Staff records: {len(rows)}")
    for r in rows:
        print(f"  {r[0]}: {r[1]} ({r[2]}) status={r[3]} attempts={r[4]}")
    
    if len(rows) == 0:
        print("\n⚠️  Staff table is EMPTY — seed data never ran on this database!")
except Exception as e:
    print(f"\n❌ Staff table error: {e}")
    print("   Table may not exist.")

# Check patients
try:
    rows = db.execute(text("SELECT id, name FROM patient LIMIT 5")).fetchall()
    print(f"\n📋 Patient records: {len(rows)}")
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
except Exception as e:
    print(f"\n❌ Patient table: {e}")

db.close()
print("\nDone.")
