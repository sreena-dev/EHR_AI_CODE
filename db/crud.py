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


# ═══════════════════════════════════════════
# ADMIN CRUD
# ═══════════════════════════════════════════

def list_all_staff(db: Session) -> list[Staff]:
    """List all staff members ordered by role then name."""
    return db.query(Staff).order_by(Staff.role, Staff.full_name).all()


def update_staff_status(db: Session, staff_id: str, new_status: str) -> Optional[Staff]:
    """Activate or deactivate a staff member."""
    staff = get_staff(db, staff_id)
    if staff:
        staff.status = new_status
        db.commit()
        db.refresh(staff)
    return staff


def update_staff_profile(db: Session, staff_id: str, **kwargs) -> Optional[Staff]:
    """Update staff fields (role, department, full_name, status)."""
    staff = get_staff(db, staff_id)
    if not staff:
        return None
    for key, value in kwargs.items():
        if hasattr(staff, key) and key not in ("staff_id", "password_hash"):
            setattr(staff, key, value)
    db.commit()
    db.refresh(staff)
    return staff


def get_admin_dashboard_stats(db: Session) -> dict:
    """
    Aggregate stats for the admin dashboard.
    Returns system-wide encounter counts, staff counts by role, patient count,
    recent encounters for the inline table, and alerts.
    """
    # Use naive datetime for SQLite compatibility (SQLite stores naive datetimes)
    today_start = datetime.combine(date.today(), datetime.min.time())

    def _make_naive(dt):
        """Strip tzinfo for safe comparison with SQLite naive datetimes."""
        if dt and dt.tzinfo is not None:
            return dt.replace(tzinfo=None)
        return dt

    # ─── All encounters in the system ───
    all_encounters = db.query(Encounter).order_by(Encounter.created_at.desc()).all()

    total_encounters = len(all_encounters)
    completed = sum(1 for e in all_encounters if e.status == "Completed")

    # ─── Staff counts by role ───
    all_staff = db.query(Staff).filter(Staff.status == "active").all()

    # Nurses
    all_nurses = [s for s in all_staff if s.role == "nurse"]
    nurses_on_duty = sum(
        1 for s in all_nurses
        if s.last_login and _make_naive(s.last_login) >= today_start
    )

    # Doctors
    all_doctors = [s for s in all_staff if s.role == "doctor"]
    doctors_on_duty = sum(
        1 for s in all_doctors
        if s.last_login and _make_naive(s.last_login) >= today_start
    )

    # All staff on duty (any role logged in today)
    staff_on_duty = sum(
        1 for s in all_staff
        if s.last_login and _make_naive(s.last_login) >= today_start
    )

    # ─── Patient count ───
    patient_count = db.query(Patient).count()

    # ─── Recent encounters for inline table (last 20) ───
    recent_encounters = []
    for enc in all_encounters[:20]:
        patient_name = enc.patient_rel.name if enc.patient_rel else "Unknown"
        recent_encounters.append({
            "id": enc.id,
            "patient_name": patient_name,
            "doctor_id": enc.doctor_id or "—",
            "type": enc.type,
            "status": enc.status,
            "chief_complaint": enc.chief_complaint or "—",
            "created_at": enc.created_at.isoformat() if enc.created_at else "",
        })

    # ─── Alerts: encounters stuck in non-terminal states for > 30 min ───
    now_naive = datetime.utcnow()
    alerts = []
    for enc in all_encounters:
        if enc.status in ("Waiting", "Checked In"):
            enc_created = _make_naive(enc.created_at) if enc.created_at else None
            if enc_created:
                wait_mins = (now_naive - enc_created).total_seconds() / 60
                if wait_mins > 30:
                    patient_name = enc.patient_rel.name if enc.patient_rel else "Unknown"
                    alerts.append({
                        "type": "long_wait",
                        "severity": "warning" if wait_mins < 60 else "critical",
                        "message": f"{patient_name} waiting for {int(wait_mins)} minutes",
                        "encounter_id": enc.id,
                        "wait_minutes": int(wait_mins),
                    })

    # OCR failures needing review
    ocr_review_count = db.query(OCRResult).filter(
        OCRResult.requires_doctor_review == True,
    ).count()
    if ocr_review_count > 0:
        alerts.append({
            "type": "ocr_review",
            "severity": "warning",
            "message": f"{ocr_review_count} OCR result(s) require manual review",
        })

    return {
        "encounters": {
            "total": total_encounters,
            "completed": completed,
            "recent": recent_encounters,
        },
        "staff": {
            "total": len(all_staff),
            "active": len(all_staff),
            "on_duty": staff_on_duty,
            "total_nurses": len(all_nurses),
            "nurses_on_duty": nurses_on_duty,
            "total_doctors": len(all_doctors),
            "doctors_on_duty": doctors_on_duty,
        },
        "patients": {
            "total": patient_count,
        },
        "alerts": alerts,
    }


def list_all_encounters_filtered(
    db: Session,
    status_filter: Optional[str] = None,
    doctor_filter: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 100,
) -> list[Encounter]:
    """List encounters with optional filters for admin oversight."""
    q = db.query(Encounter)

    if status_filter:
        q = q.filter(Encounter.status == status_filter)
    if doctor_filter:
        q = q.filter(Encounter.doctor_id == doctor_filter)
    if date_from:
        start = datetime.combine(date_from, datetime.min.time())
        q = q.filter(Encounter.created_at >= start)
    if date_to:
        end = datetime.combine(date_to, datetime.max.time())
        q = q.filter(Encounter.created_at <= end)

    return q.order_by(Encounter.created_at.desc()).limit(limit).all()


def get_recent_audit_entries(db: Session, limit: int = 50) -> list[WorkflowAudit]:
    """Get the most recent audit trail entries across all encounters."""
    return db.query(WorkflowAudit).order_by(
        WorkflowAudit.timestamp.desc()
    ).limit(limit).all()


# ═══════════════════════════════════════════
# PATIENT CRUD
# ═══════════════════════════════════════════

def get_next_patient_id(db: Session) -> str:
    """Generate next patient ID (PID-XXXXX format)."""
    last = db.query(Patient).order_by(Patient.id.desc()).first()
    if not last:
        return "PID-10001"
    # Extract numeric part from PID-XXXXX
    try:
        num = int(last.id.split("-")[1])
        return f"PID-{num + 1}"
    except (ValueError, IndexError):
        return f"PID-{10001 + db.query(Patient).count()}"


# ═══════════════════════════════════════════
# VITALS CRUD
# ═══════════════════════════════════════════

def create_vitals(db: Session, **kwargs) -> Vitals:
    """
    Create a new Vitals record.
    Accepts all Vitals model fields as keyword arguments:
    encounter_id, patient_id, temperature, pulse, bp_systolic, bp_diastolic,
    resp_rate, spo2, weight, height, notes, recorded_by.
    """
    vitals = Vitals(**kwargs)
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    return vitals


def get_vitals(db: Session, encounter_id: str) -> Optional[Vitals]:
    """Get vitals for a specific encounter."""
    return db.query(Vitals).filter(Vitals.encounter_id == encounter_id).first()


def get_patient_vitals(db: Session, patient_id: str) -> list[Vitals]:
    """Get all vitals for a patient across all their encounters, most recent first."""
    return (
        db.query(Vitals)
        .filter(Vitals.patient_id == patient_id)
        .order_by(Vitals.recorded_at.desc())
        .all()
    )
