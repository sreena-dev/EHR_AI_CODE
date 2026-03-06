"""
Seed default data — runs once when the DB is empty.
Populates staff accounts and patient registry so the app works out of the box.
"""
import logging
from sqlalchemy.orm import Session
from .models import Staff, Patient

logger = logging.getLogger(__name__)


def seed_default_data(db: Session):
    """Seed default staff and patients if the database is empty."""
    _seed_staff(db)
    _seed_patients(db)


def _seed_staff(db: Session):
    """Seed the 3 default staff accounts (matches existing mock data)."""
    if db.query(Staff).count() > 0:
        logger.info("Staff table already populated — skipping seed.")
        return

    from api.middleware.auth import PasswordManager
    pm = PasswordManager()

    default_staff = [
        {
            "staff_id": "nurse_001",
            "full_name": "Nurse Priya",
            "role": "nurse",
            "password": "Nurse@2024!",
            "department": "General Ward",
        },
        {
            "staff_id": "dr_anand",
            "full_name": "Dr. Anand Kumar",
            "role": "doctor",
            "password": "Doctor@2024!",
            "department": "Internal Medicine",
        },
        {
            "staff_id": "admin_001",
            "full_name": "Admin User",
            "role": "admin",
            "password": "Admin@2024!",
            "department": "Administration",
        },
    ]

    for s in default_staff:
        staff = Staff(
            staff_id=s["staff_id"],
            full_name=s["full_name"],
            role=s["role"],
            password_hash=pm.hash_password(s["password"]),
            department=s["department"],
            status="active",
        )
        db.add(staff)

    logger.info(f"Seeded {len(default_staff)} staff accounts.")


def _seed_patients(db: Session):
    """Seed the 8 default patients (matches existing _PATIENT_REGISTRY)."""
    if db.query(Patient).count() > 0:
        logger.info("Patient table already populated — skipping seed.")
        return

    from api.middleware.auth import PasswordManager
    pm = PasswordManager()

    default_patients = [
        {"id": "PID-10001", "name": "Priya Sharma",  "age": 28, "gender": "F", "phone": "9876543210", "address": "12 MG Road, Chennai",
         "password_hash": pm.hash_password("Patient@2024!"), "emergency_contact_name": "Raj Sharma", "emergency_contact_phone": "9876543200"},
        {"id": "PID-10002", "name": "Rajesh Kumar",   "age": 45, "gender": "M", "phone": "9876543211", "address": "45 Anna Nagar, Chennai"},
        {"id": "PID-10003", "name": "Meena Devi",     "age": 62, "gender": "F", "phone": "9876543212", "address": "78 T Nagar, Chennai"},
        {"id": "PID-10004", "name": "Arjun Patel",    "age": 35, "gender": "M", "phone": "9876543213", "address": "23 Velachery, Chennai"},
        {"id": "PID-10005", "name": "Lakshmi R.",     "age": 50, "gender": "F", "phone": "9876543214", "address": "56 Adyar, Chennai"},
        {"id": "PID-10006", "name": "Suresh M.",      "age": 70, "gender": "M", "phone": "9876543215", "address": "89 Mylapore, Chennai"},
        {"id": "PID-10007", "name": "Kavitha S.",     "age": 42, "gender": "F", "phone": "9876543216", "address": "34 Tambaram, Chennai"},
        {"id": "PID-10008", "name": "Ramesh V.",      "age": 55, "gender": "M", "phone": "9876543217", "address": "67 Porur, Chennai"},
    ]

    for p in default_patients:
        patient = Patient(**p)
        db.add(patient)

    logger.info(f"Seeded {len(default_patients)} patients (PID-10001 has login credentials).")

