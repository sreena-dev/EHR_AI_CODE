"""
SQLAlchemy ORM models for the EHR database.
All tables map 1-to-1 with the schema in the implementation plan.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, Date,
    ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from .database import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════
# STAFF (replaces _staff_db in auth.py)
# ═══════════════════════════════════════════
class Staff(Base):
    __tablename__ = "staff"

    staff_id = Column(String(100), primary_key=True)
    full_name = Column(String(200), nullable=False)
    role = Column(String(50), nullable=False)  # nurse, doctor, admin, receptionist
    password_hash = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active, suspended, locked
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    last_password_change = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    encounters_as_doctor = relationship("Encounter", back_populates="doctor_rel", foreign_keys="Encounter.doctor_id")
    encounters_as_nurse = relationship("Encounter", back_populates="nurse_rel", foreign_keys="Encounter.nurse_id")

    def __repr__(self):
        return f"<Staff {self.staff_id} ({self.role})>"


# ═══════════════════════════════════════════
# PATIENT (replaces _PATIENT_REGISTRY)
# ═══════════════════════════════════════════
class Patient(Base):
    __tablename__ = "patient"

    id = Column(String(50), primary_key=True)  # PID-10001
    name = Column(String(200), nullable=False, index=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)  # M, F, U
    phone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    dob = Column(Date, nullable=True)  # Date of birth (precise age calc)
    blood_group = Column(String(10), nullable=True)
    medical_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    insurance_id = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=True)  # null for staff-created patients
    
    # ABDM Specific Fields
    abha_number = Column(String(14), unique=True, index=True, nullable=True)
    abha_address = Column(String(100), unique=True, index=True, nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    father_name = Column(String(200), nullable=True)
    id_proof_type = Column(String(50), nullable=True)  # aadhaar, driving_license, etc.
    id_proof_number = Column(String(50), nullable=True)
    consent_health_data = Column(Boolean, default=False)
    consent_data_sharing = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime(timezone=True), nullable=True)
    abdm_linked = Column(Boolean, default=False)
    
    registered_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    encounters = relationship("Encounter", back_populates="patient_rel", order_by="Encounter.created_at.desc()")
    consents = relationship("PatientConsent", back_populates="patient_rel", cascade="all, delete-orphan")

# ═══════════════════════════════════════════
# PATIENT CONSENT (ABDM Audit Trail)
# ═══════════════════════════════════════════
class PatientConsent(Base):
    __tablename__ = "patient_consent"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String(50), ForeignKey("patient.id"))
    consent_type = Column(String(50))  # health_data, data_sharing, hiu_request
    granted = Column(Boolean, default=False)
    purpose = Column(String(200))
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    ip_address = Column(String(50), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    patient_rel = relationship("Patient", back_populates="consents")

    def __repr__(self):
        return f"<Patient {self.id}: {self.name}>"


# ═══════════════════════════════════════════
# ENCOUNTER (replaces _ENCOUNTERS + _MOCK_ENCOUNTERS)
# ═══════════════════════════════════════════
class Encounter(Base):
    __tablename__ = "encounter"

    id = Column(String(50), primary_key=True)  # ENC-2026-001
    patient_id = Column(String(50), ForeignKey("patient.id"), nullable=True, index=True)
    doctor_id = Column(String(100), ForeignKey("staff.staff_id"), nullable=True)
    nurse_id = Column(String(100), ForeignKey("staff.staff_id"), nullable=True)
    type = Column(String(50), default="Prescription OCR")  # Prescription OCR, Lab Report, Vitals Entry
    status = Column(String(50), default="Waiting")  # Waiting, Checked In, In Consultation, OCR Processing, Completed
    chief_complaint = Column(Text, nullable=True)
    language = Column(String(20), default="en")
    visit_type = Column(String(50), default="Standard Consult")  # Standard Consult, Follow-up, Emergency
    created_at = Column(DateTime(timezone=True), default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    patient_rel = relationship("Patient", back_populates="encounters")
    doctor_rel = relationship("Staff", back_populates="encounters_as_doctor", foreign_keys=[doctor_id])
    nurse_rel = relationship("Staff", back_populates="encounters_as_nurse", foreign_keys=[nurse_id])
    ocr_results = relationship("OCRResult", back_populates="encounter_rel", order_by="OCRResult.created_at.desc()")
    clinical_note = relationship("ClinicalNote", back_populates="encounter_rel", uselist=False)
    audit_entries = relationship("WorkflowAudit", back_populates="encounter_rel", order_by="WorkflowAudit.timestamp")
    vitals = relationship("Vitals", back_populates="encounter_rel", uselist=False)

    __table_args__ = (
        Index("ix_encounter_status", "status"),
        Index("ix_encounter_date_status", "created_at", "status"),
    )

    def __repr__(self):
        return f"<Encounter {self.id} [{self.status}]>"


# ═══════════════════════════════════════════
# OCR RESULT
# ═══════════════════════════════════════════
class OCRResult(Base):
    __tablename__ = "ocr_result"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), ForeignKey("encounter.id"), nullable=False, index=True)
    document_type = Column(String(50), default="prescription")
    language_detected = Column(String(20), nullable=True)
    confidence_mean = Column(Float, default=0.0)
    processing_time_ms = Column(Integer, default=0)
    raw_text = Column(Text, nullable=True)
    normalized_text = Column(Text, nullable=True)
    structured_fields = Column(JSON, nullable=True)  # List of field dicts
    safety_flags = Column(JSON, default=list)
    requires_doctor_review = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    encounter_rel = relationship("Encounter", back_populates="ocr_results")

    def __repr__(self):
        return f"<OCRResult enc={self.encounter_id} conf={self.confidence_mean:.0f}%>"


# ═══════════════════════════════════════════
# CLINICAL NOTE
# ═══════════════════════════════════════════
class ClinicalNote(Base):
    __tablename__ = "clinical_note"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), ForeignKey("encounter.id"), nullable=False, unique=True, index=True)
    patient_id = Column(String(50), ForeignKey("patient.id"), nullable=True)
    language = Column(String(10), default="en")
    transcript = Column(Text, nullable=True)
    entities = Column(JSON, nullable=True)  # List of ClinicalEntity dicts
    ai_draft = Column(Text, nullable=True)
    final_note = Column(Text, nullable=True)
    doctor_verified = Column(Boolean, default=False)
    verified_by = Column(String(100), ForeignKey("staff.staff_id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    safety_flags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    encounter_rel = relationship("Encounter", back_populates="clinical_note")

    def __repr__(self):
        return f"<ClinicalNote enc={self.encounter_id} verified={self.doctor_verified}>"


# ═══════════════════════════════════════════
# WORKFLOW AUDIT (HIPAA compliance trail)
# ═══════════════════════════════════════════
class WorkflowAudit(Base):
    __tablename__ = "workflow_audit"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), ForeignKey("encounter.id"), nullable=False, index=True)
    from_state = Column(String(50), nullable=True)
    to_state = Column(String(50), nullable=False)
    triggered_by = Column(String(100), nullable=False)
    safety_flags = Column(JSON, default=list)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow, index=True)

    # Relationships
    encounter_rel = relationship("Encounter", back_populates="audit_entries")

    def __repr__(self):
        return f"<WorkflowAudit {self.from_state}->{self.to_state}>"


# ═══════════════════════════════════════════
# VITALS
# ═══════════════════════════════════════════
class Vitals(Base):
    __tablename__ = "vitals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    encounter_id = Column(String(50), ForeignKey("encounter.id"), nullable=False, unique=True, index=True)
    patient_id = Column(String(50), ForeignKey("patient.id"), nullable=True)
    temperature = Column(Float, nullable=True)  # °F
    pulse = Column(Integer, nullable=True)  # bpm
    bp_systolic = Column(Integer, nullable=True)  # mmHg
    bp_diastolic = Column(Integer, nullable=True)  # mmHg
    resp_rate = Column(Integer, nullable=True)  # breaths/min
    spo2 = Column(Float, nullable=True)  # %
    weight = Column(Float, nullable=True)  # kg
    height = Column(Float, nullable=True)  # cm
    notes = Column(Text, nullable=True)
    recorded_by = Column(String(100), ForeignKey("staff.staff_id"), nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    encounter_rel = relationship("Encounter", back_populates="vitals")

    def __repr__(self):
        return f"<Vitals enc={self.encounter_id}>"

# ═══════════════════════════════════════════
# SAAS BILLING & SUBSCRIPTIONS
# ═══════════════════════════════════════════
class SubscriptionPlan(Base):
    """Reference table for SaaS Subscription Tiers (e.g., Pro, Elite)"""
    __tablename__ = "subscription_plan"

    id = Column(String(50), primary_key=True)  # e.g., plan_pro, plan_elite
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    price_inr = Column(Integer, nullable=False) # e.g. 12000 for Pro, 18000 for Elite
    interval = Column(String(20), default="year")
    features = Column(JSON, default=dict)       # {"teleconsult": true, "analytics": false}
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    def __repr__(self):
        return f"<SubscriptionPlan {self.name} - ₹{self.price_inr}/{self.interval}>"

class ClinicSubscription(Base):
    """Tracks the active subscription for a clinic (or head doctor)"""
    __tablename__ = "clinic_subscription"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Tying the subscription to a specific owner/staff member
    staff_id = Column(String(100), ForeignKey("staff.staff_id"), unique=True, nullable=False)
    plan_id = Column(String(50), ForeignKey("subscription_plan.id"), nullable=False)
    status = Column(String(50), default="active")  # active, past_due, canceled, trial
    current_period_end = Column(DateTime(timezone=True), nullable=False)
    cancel_at_period_end = Column(Boolean, default=False)
    stripe_subscription_id = Column(String(100), nullable=True) # Mock external ID
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    staff_rel = relationship("Staff", foreign_keys=[staff_id])
    plan_rel = relationship("SubscriptionPlan")
    invoices = relationship("BillingInvoice", back_populates="subscription_rel", order_by="BillingInvoice.created_at.desc()")

    def __repr__(self):
        return f"<ClinicSubscription {self.staff_id} on {self.plan_id} ({self.status})>"

class BillingInvoice(Base):
    """Audit trail of payments and invoices generated for the subscription"""
    __tablename__ = "billing_invoice"

    id = Column(String(100), primary_key=True)  # Mock invoice ID e.g., inv_12345
    subscription_id = Column(Integer, ForeignKey("clinic_subscription.id"), nullable=False)
    amount_paid = Column(Integer, nullable=False)
    currency = Column(String(10), default="inr")
    status = Column(String(50), default="paid") # paid, open, void, uncollectible
    invoice_pdf_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    subscription_rel = relationship("ClinicSubscription", back_populates="invoices")

    def __repr__(self):
        return f"<BillingInvoice {self.id} - {self.amount_paid} {self.currency}>"
