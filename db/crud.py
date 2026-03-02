"""
CRUD operations for all EHR models.
Used by API routes instead of in-memory lists.
"""
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from .models import Staff, Patient, Encounter, OCRResult, ClinicalNote, WorkflowAudit, Vitals


# ═══════════════════════════════════════════
# STAFF CRUD
# ═══════════════════════════════════════════

def get_staff(db: Session, staff_id: str) -> Optional[Staff]:
    """Get staff by ID."""
    return db.query(Staff).filter(Staff.staff_id == staff_id).first()


def get_staff_roles(db: Session, staff_id: str) -> list[str]:
    """Get list of roles for a staff member (for RBAC)."""
    staff = get_staff(db, staff_id)
    if not staff:
        return []
    roles = [staff.role]
    # Admin gets nurse role too (matches existing mock logic)
    if staff.role == "admin":
        roles.append("nurse")
    return roles


def update_staff_login(db: Session, staff_id: str):
    """Record successful login timestamp."""
    staff = get_staff(db, staff_id)
    if staff:
        staff.last_login = datetime.now(timezone.utc)
        staff.failed_attempts = 0
        db.commit()


def update_staff_failed_attempt(db: Session, staff_id: str):
    """Increment failed login counter."""
    staff = get_staff(db, staff_id)
    if staff:
        staff.failed_attempts += 1
        db.commit()


def update_staff_password(db: Session, staff_id: str, password_hash: str):
    """Update staff password hash."""
    staff = get_staff(db, staff_id)
    if staff:
        staff.password_hash = password_hash
        staff.last_password_change = datetime.now(timezone.utc)
        db.commit()


def create_staff(db: Session, **kwargs) -> Staff:
    """Create a new staff member."""
    staff = Staff(**kwargs)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


# ═══════════════════════════════════════════
# PATIENT CRUD
# ═══════════════════════════════════════════

def get_patient(db: Session, patient_id: str) -> Optional[Patient]:
    """Get patient by ID."""
    return db.query(Patient).filter(Patient.id == patient_id).first()


def search_patients(db: Session, query: str = "", limit: int = 10) -> list[Patient]:
    """Search patients by name, ID, or phone."""
    if not query or len(query) < 2:
        return db.query(Patient).limit(limit).all()

    q = f"%{query}%"
    return db.query(Patient).filter(
        or_(
            Patient.name.ilike(q),
            Patient.id.ilike(q),
            Patient.phone.like(q),
        )
    ).limit(limit).all()


def get_next_patient_id(db: Session) -> str:
    """Generate the next PID-XXXXX patient ID."""
    last = db.query(Patient).order_by(Patient.id.desc()).first()
    if last and last.id.startswith("PID-"):
        try:
            num = int(last.id.split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 10001
    else:
        num = 10001
    return f"PID-{num}"


def find_duplicate_patient(db: Session, name: str, phone: str = "",
                           age: int | None = None, gender: str = "") -> Patient | None:
    """
    Check for a potential duplicate patient.
    Match priority:
      1. Exact name + phone (strongest match — phones are unique identifiers)
      2. Exact name + age + gender (fallback when phone not provided)
    Returns the existing patient if a duplicate is found, else None.
    """
    name_clean = name.strip().lower()
    if not name_clean:
        return None

    # Priority 1: name + phone match (phone is the strongest disambiguator)
    if phone and phone.strip():
        match = db.query(Patient).filter(
            func.lower(Patient.name) == name_clean,
            Patient.phone == phone.strip(),
        ).first()
        if match:
            return match

    # Priority 2: name + age + gender match
    if age is not None and gender:
        match = db.query(Patient).filter(
            func.lower(Patient.name) == name_clean,
            Patient.age == age,
            Patient.gender == gender.strip().upper()[:1],  # Normalize to single char
        ).first()
        if match:
            return match

    # Priority 3: exact name-only match (weakest — only if exactly one result)
    matches = db.query(Patient).filter(
        func.lower(Patient.name) == name_clean,
    ).all()
    if len(matches) == 1:
        return matches[0]

    return None


def create_patient(db: Session, **kwargs) -> Patient:
    """Create a new patient. Auto-generates ID if not provided."""
    if "id" not in kwargs or not kwargs["id"]:
        kwargs["id"] = get_next_patient_id(db)
    patient = Patient(**kwargs)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


# ═══════════════════════════════════════════
# ENCOUNTER CRUD
# ═══════════════════════════════════════════

def get_encounter(db: Session, encounter_id: str) -> Optional[Encounter]:
    """Get encounter by ID."""
    return db.query(Encounter).filter(Encounter.id == encounter_id).first()


def list_encounters(db: Session, today_only: bool = False) -> list[Encounter]:
    """List all encounters, optionally filtered to today."""
    q = db.query(Encounter)
    if today_only:
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        q = q.filter(Encounter.created_at >= today_start)
    return q.order_by(Encounter.created_at.desc()).all()


def list_encounters_by_status(db: Session, statuses: list[str]) -> list[Encounter]:
    """List encounters filtered by status list."""
    return db.query(Encounter).filter(
        Encounter.status.in_(statuses)
    ).order_by(Encounter.created_at.desc()).all()


def get_encounter_counts(db: Session, today_only: bool = False) -> dict:
    """Get aggregate encounter counts."""
    q = db.query(Encounter)
    if today_only:
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        q = q.filter(Encounter.created_at >= today_start)

    encounters = q.all()
    total = len(encounters)
    return {
        "total": total,
        "pending_ocr": sum(1 for e in encounters if e.status == "Pending OCR"),
        "requires_review": sum(1 for e in encounters if e.status == "Requires Review"),
        "waiting": sum(1 for e in encounters if e.status in ("Waiting", "Checked In")),
        "in_progress": sum(1 for e in encounters if e.status in ("In Consultation", "OCR Processing")),
        "completed": sum(1 for e in encounters if e.status == "Completed"),
    }


def get_next_encounter_id(db: Session) -> str:
    """Generate the next ENC-YYYY-NNN encounter ID."""
    year = datetime.now().year
    prefix = f"ENC-{year}-"

    last = db.query(Encounter).filter(
        Encounter.id.like(f"{prefix}%")
    ).order_by(Encounter.id.desc()).first()

    if last:
        try:
            num = int(last.id.split("-")[-1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1

    return f"{prefix}{str(num).zfill(3)}"


def create_encounter(db: Session, **kwargs) -> Encounter:
    """Create a new encounter. Auto-generates ID if not provided."""
    if "id" not in kwargs or not kwargs["id"]:
        kwargs["id"] = get_next_encounter_id(db)
    enc = Encounter(**kwargs)
    db.add(enc)
    db.commit()
    db.refresh(enc)
    return enc


def update_encounter_status(db: Session, encounter_id: str, new_status: str) -> Optional[Encounter]:
    """Update encounter status."""
    enc = get_encounter(db, encounter_id)
    if enc:
        enc.status = new_status
        enc.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(enc)
    return enc


# ═══════════════════════════════════════════
# OCR RESULT CRUD
# ═══════════════════════════════════════════

def create_ocr_result(db: Session, **kwargs) -> OCRResult:
    """Save an OCR result to the database."""
    result = OCRResult(**kwargs)
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_ocr_results_for_encounter(db: Session, encounter_id: str) -> list[OCRResult]:
    """Get all OCR results for an encounter."""
    return db.query(OCRResult).filter(
        OCRResult.encounter_id == encounter_id
    ).order_by(OCRResult.created_at.desc()).all()


# ═══════════════════════════════════════════
# CLINICAL NOTE CRUD
# ═══════════════════════════════════════════

def create_clinical_note(db: Session, **kwargs) -> ClinicalNote:
    """Create a clinical note for an encounter."""
    note = ClinicalNote(**kwargs)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_clinical_note(db: Session, encounter_id: str) -> Optional[ClinicalNote]:
    """Get the clinical note for an encounter."""
    return db.query(ClinicalNote).filter(
        ClinicalNote.encounter_id == encounter_id
    ).first()


def verify_clinical_note(db: Session, encounter_id: str, verified_by: str, final_note: str) -> Optional[ClinicalNote]:
    """Mark a clinical note as doctor-verified."""
    note = get_clinical_note(db, encounter_id)
    if note:
        note.doctor_verified = True
        note.verified_by = verified_by
        note.verified_at = datetime.now(timezone.utc)
        note.final_note = final_note
        db.commit()
        db.refresh(note)
    return note


# ═══════════════════════════════════════════
# WORKFLOW AUDIT CRUD
# ═══════════════════════════════════════════

def create_audit_entry(db: Session, **kwargs) -> WorkflowAudit:
    """Record a workflow state transition (HIPAA audit trail)."""
    entry = WorkflowAudit(**kwargs)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_audit_trail(db: Session, encounter_id: str) -> list[WorkflowAudit]:
    """Get the full audit trail for an encounter."""
    return db.query(WorkflowAudit).filter(
        WorkflowAudit.encounter_id == encounter_id
    ).order_by(WorkflowAudit.timestamp).all()


# ═══════════════════════════════════════════
# VITALS CRUD
# ═══════════════════════════════════════════

def create_vitals(db: Session, **kwargs) -> Vitals:
    """Record vitals for an encounter."""
    v = Vitals(**kwargs)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def get_vitals(db: Session, encounter_id: str) -> Optional[Vitals]:
    """Get vitals for an encounter."""
    return db.query(Vitals).filter(
        Vitals.encounter_id == encounter_id
    ).first()
