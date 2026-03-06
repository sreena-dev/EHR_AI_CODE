"""
Patient Authentication Router
===============================
Provides patient self-registration and login endpoints.
Patients authenticate with Patient ID + Password (separate from staff auth).

COMPLIANCE:
- HIPAA §164.312(a)(2)(iii): Unique user identification for patients
- HIPAA §164.312(d): Person or entity authentication
"""
import logging
import re
import secrets
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from api.middleware.auth import PasswordManager, JWTManager, RateLimiter
from api.services import abdm_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/patient", tags=["Patient Authentication"])

# Singletons
_jwt_manager = JWTManager()
_rate_limiter = RateLimiter()
_password_manager = PasswordManager()


# ═══════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════

class PatientRegisterRequest(BaseModel):
    """Patient self-registration request."""
    full_name: str = Field(..., min_length=2, max_length=200)
    dob: str = Field(..., description="Date of birth in YYYY-MM-DD format")
    gender: str = Field(..., description="M, F, O, or U")
    phone: str = Field(..., min_length=10, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    address: str = Field(..., min_length=5, max_length=500)
    blood_group: Optional[str] = Field(None, max_length=10)
    allergies: Optional[str] = Field(None, max_length=1000)
    medical_history: Optional[str] = Field(None, max_length=2000)
    emergency_contact_name: str = Field(..., min_length=2, max_length=200)
    emergency_contact_phone: str = Field(..., min_length=10, max_length=20)
    insurance_id: Optional[str] = Field(None, max_length=100)
    
    # ABDM Fields
    abha_number: Optional[str] = Field(None, description="14-digit ABHA ID")
    abha_address: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    pincode: Optional[str] = Field(None, max_length=10)
    father_name: Optional[str] = Field(None, max_length=200)
    id_proof_type: Optional[str] = Field(None, max_length=50)
    id_proof_number: Optional[str] = Field(None, max_length=50)
    consent_health_data: bool = False
    consent_data_sharing: bool = False
    
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("abha_number")
    @classmethod
    def validate_abha(cls, v):
        if v and not abdm_service.validate_abha_number(v):
            raise ValueError("Invalid 14-digit ABHA number")
        return v
        
    @field_validator("abha_address")
    @classmethod
    def validate_abha_address(cls, v):
        if v and not abdm_service.validate_abha_address(v):
            raise ValueError("Invalid ABHA Address format")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v):
        """Enforce patient password policy."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain a lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a digit")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        allowed = {"M", "F", "O", "U"}
        normalized = v.strip().upper()[:1]
        if normalized not in allowed:
            raise ValueError("Gender must be M, F, O, or U")
        return normalized

    @field_validator("dob")
    @classmethod
    def validate_dob(cls, v):
        try:
            dob = datetime.strptime(v, "%Y-%m-%d").date()
            if dob > date.today():
                raise ValueError("Date of birth cannot be in the future")
            return v
        except ValueError as e:
            if "does not match format" in str(e) or "unconverted data" in str(e):
                raise ValueError("Date of birth must be in YYYY-MM-DD format")
            raise


class PatientLoginRequest(BaseModel):
    """Patient login request."""
    patient_id: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)


class PatientLoginResponse(BaseModel):
    """Patient login response."""
    success: bool
    message: Optional[str] = None
    token: Optional[dict] = None
    patient: Optional[dict] = None
    account_locked: bool = False
    remaining_attempts: Optional[int] = None


# ═══════════════════════════════════════════
# HELPER: Calculate age from DOB
# ═══════════════════════════════════════════

def _calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


# ═══════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════

@router.post(
    "/register",
    summary="Patient Self-Registration",
    description="Register a new patient account with demographics and medical info"
)
async def patient_register(data: PatientRegisterRequest, request: Request):
    """
    Patient self-registration endpoint.
    Creates Patient record with hashed password.
    """
    from db.database import SessionLocal
    from db import crud

    db = SessionLocal()
    try:
        # Check for duplicate by phone
        existing = db.query(__import__('db.models', fromlist=['Patient']).Patient).filter_by(
            phone=data.phone.strip()
        ).first()

        if existing and existing.password_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number already exists. Please login instead."
            )

        # If patient exists (created by staff) but has no password, let them set one
        if existing and not existing.password_hash:
            existing.password_hash = _password_manager.hash_password(data.password)
            existing.email = data.email
            existing.dob = datetime.strptime(data.dob, "%Y-%m-%d").date() if data.dob else None
            existing.emergency_contact_name = data.emergency_contact_name
            existing.emergency_contact_phone = data.emergency_contact_phone
            existing.insurance_id = data.insurance_id
            existing.abha_number = data.abha_number
            existing.abha_address = data.abha_address
            existing.district = data.district
            existing.state = data.state
            existing.pincode = data.pincode
            existing.father_name = data.father_name
            existing.id_proof_type = data.id_proof_type
            existing.id_proof_number = abdm_service.mask_id_number(data.id_proof_number) if data.id_proof_number else None
            existing.consent_health_data = data.consent_health_data
            existing.consent_data_sharing = data.consent_data_sharing
            
            if data.consent_health_data or data.consent_data_sharing:
                existing.consent_timestamp = datetime.now(timezone.utc)
                from db.models import PatientConsent
                if data.consent_health_data:
                    db.add(PatientConsent(patient_id=existing.id, consent_type="health_data", granted=True))
                if data.consent_data_sharing:
                    db.add(PatientConsent(patient_id=existing.id, consent_type="data_sharing", granted=True))
                    
            if data.blood_group:
                existing.blood_group = data.blood_group
            if data.allergies:
                existing.allergies = data.allergies
            if data.medical_history:
                existing.medical_history = data.medical_history
            db.commit()
            db.refresh(existing)

            logger.info(f"Patient account activated (existing): {existing.id}")
            return {
                "success": True,
                "message": "Account activated successfully",
                "patient_id": existing.id
            }

        # Create new patient
        dob_date = datetime.strptime(data.dob, "%Y-%m-%d").date() if data.dob else None
        age = _calculate_age(dob_date) if dob_date else None

        patient_id = crud.get_next_patient_id(db)
        from db.models import Patient
        patient = Patient(
            id=patient_id,
            name=data.full_name.strip(),
            age=age,
            gender=data.gender,
            phone=data.phone.strip(),
            email=data.email.strip() if data.email else None,
            address=data.address.strip(),
            dob=dob_date,
            blood_group=data.blood_group,
            allergies=data.allergies,
            medical_history=data.medical_history,
            emergency_contact_name=data.emergency_contact_name.strip(),
            emergency_contact_phone=data.emergency_contact_phone.strip(),
            insurance_id=data.insurance_id,
            abha_number=data.abha_number,
            abha_address=data.abha_address,
            district=data.district,
            state=data.state,
            pincode=data.pincode,
            father_name=data.father_name,
            id_proof_type=data.id_proof_type,
            id_proof_number=abdm_service.mask_id_number(data.id_proof_number) if data.id_proof_number else None,
            consent_health_data=data.consent_health_data,
            consent_data_sharing=data.consent_data_sharing,
            consent_timestamp=datetime.now(timezone.utc) if (data.consent_health_data or data.consent_data_sharing) else None,
            password_hash=_password_manager.hash_password(data.password),
        )
        db.add(patient)
        
        from db.models import PatientConsent
        if data.consent_health_data:
            db.add(PatientConsent(patient_id=patient_id, consent_type="health_data", granted=True))
        if data.consent_data_sharing:
            db.add(PatientConsent(patient_id=patient_id, consent_type="data_sharing", granted=True))
        db.commit()
        db.refresh(patient)

        logger.info(f"New patient registered: {patient_id}")
        return {
            "success": True,
            "message": "Registration successful! You can now log in.",
            "patient_id": patient_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Patient registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )
    finally:
        db.close()


@router.post(
    "/login",
    response_model=PatientLoginResponse,
    summary="Patient Login",
    description="Authenticate patient with Patient ID and password"
)
async def patient_login(credentials: PatientLoginRequest, request: Request):
    """
    Patient login endpoint.
    Returns JWT tokens on success with role='patient'.
    """
    patient_id = credentials.patient_id
    client_ip = request.client.host if request.client else None

    # Rate limiting
    if _rate_limiter.is_locked(patient_id):
        logger.warning(f"Patient login attempt on locked account: {patient_id}")
        return PatientLoginResponse(
            success=False,
            message="Account temporarily locked due to too many failed attempts",
            account_locked=True
        )

    from db.database import SessionLocal
    from db.models import Patient

    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()

        if not patient:
            _rate_limiter.record_attempt(patient_id, success=False)
            logger.warning(f"Patient login with invalid ID: {patient_id}")
            return PatientLoginResponse(
                success=False,
                message="Invalid credentials"
            )

        if not patient.password_hash:
            return PatientLoginResponse(
                success=False,
                message="No account password set. Please register first."
            )

        # Verify password
        password_valid = _password_manager.verify_password(
            credentials.password,
            patient.password_hash
        )

        attempt_result = _rate_limiter.record_attempt(patient_id, password_valid)

        if not password_valid:
            logger.warning(
                f"Failed patient login | ID: {patient_id} | "
                f"IP: {client_ip or 'unknown'} | "
                f"Remaining: {attempt_result['remaining_attempts']}"
            )

            if attempt_result["locked"]:
                return PatientLoginResponse(
                    success=False,
                    message="Account locked for 30 minutes due to too many failed attempts",
                    account_locked=True,
                    remaining_attempts=0
                )

            return PatientLoginResponse(
                success=False,
                message="Invalid credentials",
                remaining_attempts=attempt_result["remaining_attempts"]
            )

        # Success — generate JWT with role=patient
        access_token, access_expire = _jwt_manager.create_access_token(
            staff_id=patient_id,  # Reuses staff_id field in JWT
            role="patient"
        )
        refresh_token, _ = _jwt_manager.create_refresh_token(
            staff_id=patient_id,
            role="patient"
        )

        logger.info(f"Patient login successful: {patient_id} | IP: {client_ip or 'unknown'}")

        return PatientLoginResponse(
            success=True,
            message="Login successful",
            token={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": int((access_expire - datetime.now(timezone.utc)).total_seconds()),
                "staff_id": patient_id,  # Kept for frontend compatibility
                "role": "patient"
            },
            patient={
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
            }
        )

    except Exception as e:
        logger.error(f"Patient login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )
    finally:
        db.close()


@router.get(
    "/{patient_id}/fhir",
    summary="Get Patient as FHIR R4",
    description="Returns the patient record formatted as an ABDM-compliant FHIR R4 Patient resource"
)
async def get_patient_fhir(patient_id: str):
    from db.database import SessionLocal
    from db.models import Patient
    
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
            
        return abdm_service.serialize_fhir_patient(patient)
    finally:
        db.close()


@router.get(
    "/{patient_id}/consent",
    summary="Get Patient Consent History",
    description="Returns the ABDM consent audit trail for the patient"
)
async def get_patient_consents(patient_id: str):
    from db.database import SessionLocal
    from db.models import PatientConsent
    
    db = SessionLocal()
    try:
        consents = db.query(PatientConsent).filter(PatientConsent.patient_id == patient_id).order_by(PatientConsent.timestamp.desc()).all()
        return [
            {
                "id": c.id,
                "consent_type": c.consent_type,
                "granted": c.granted,
                "purpose": c.purpose,
                "timestamp": c.timestamp,
                "revoked_at": c.revoked_at
            }
            for c in consents
        ]
    finally:
        db.close()
