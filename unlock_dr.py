import os
import sys

# Add current path to python path to import db.models
sys.path.append(os.getcwd())

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Staff

DB_URL = None
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                DB_URL = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                
if DB_URL and DB_URL.startswith("postgres://"):
    DB_URL = DB_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to database...")
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

staff = db.query(Staff).filter(Staff.staff_id == "dr_anand").first()
if staff:
    staff.status = "active"
    staff.failed_attempts = 0
    staff.locked_until = None
    db.commit()
    print("SUCCESS: unlocked dr_anand")
else:
    print("ERROR: dr_anand not found")
db.close()
