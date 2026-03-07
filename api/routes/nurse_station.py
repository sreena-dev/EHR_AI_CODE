from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional
from sqlalchemy.orm import Session
import tempfile
import os
import logging
import random
from pathlib import Path
from datetime import datetime

from ..models.requests import OCRRquest
from ..models.responses import OCRResultResponse, OCRErrorResponse, OCRStatus
from ..dependencies import (
    get_ocr_processor,
    get_or_create_workflow,
    verify_staff_role
)
from services.ocr.exceptions import OCRError, LowConfidenceError
from core.workflow import WorkflowState
from services.ocr.config import LanguageMode
from db.database import get_db
from db import crud

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nurse", tags=["Nurse Station"])

# Available doctors for auto-assignment
_AVAILABLE_DOCTORS = ["Dr. Kumar", "Dr. Priya", "Dr. Anand"]


@router.get(
    "/dashboard-stats",
    summary="Nurse Dashboard Stats",
    description="Returns encounter list and aggregate counts for the nurse dashboard.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns today's encounters and aggregated stat counts from the database.
    """
    encounters = crud.list_encounters(db)
    counts = crud.get_encounter_counts(db)

    # Serialize encounters for the frontend
    enc_list = []
    for enc in encounters:
        patient = crud.get_patient(db, enc.patient_id) if enc.patient_id else None
        enc_list.append({
            "id": enc.id,
            "patient_name": patient.name if patient else "Unknown",
            "type": enc.type,
            "status": enc.status,
            "time": enc.created_at.strftime("%I:%M %p") if enc.created_at else "—",
        })

    return {
        "encounters": enc_list,
        "counts": {
            "total": counts["total"],
            "pending_ocr": counts["pending_ocr"],
            "requires_review": counts["requires_review"],
            "completed": counts["completed"],
        },
    }


@router.get(
    "/queue-stats",
    summary="Patient Queue Stats",
    description="Returns the patient queue with status counts for the queue page.",
    dependencies=[Depends(verify_staff_role(["nurse", "doctor", "admin"]))],
)
async def get_queue_stats(db: Session = Depends(get_db)):
    """
    Returns the patient queue list and aggregated counts from the database.
    """
    encounters = crud.list_encounters(db)
    counts = crud.get_encounter_counts(db)

    patients = []
    for enc in encounters:
        patient = crud.get_patient(db, enc.patient_id) if enc.patient_id else None
        doctor = None
        if enc.doctor_id:
            doctor = crud.get_staff(db, enc.doctor_id)

        patients.append({
            "token": enc.id,
            "name": patient.name if patient else "Unknown",
            "age": patient.age if patient else "—",
            "gender": patient.gender if patient else "—",
            "reason": enc.type or "—",
            "doctor": doctor.full_name if doctor else "—",
            "status": enc.status or "—",
            "wait_time": enc.created_at.strftime("%I:%M %p") if enc.created_at else "—",
        })

    return {
        "patients": patients,
        "counts": {
            "total": counts["total"],
            "waiting": counts["waiting"],
            "in_progress": counts["in_progress"],
            "completed": counts["completed"],
        },
    }


@router.get(
    "/encounters",
    summary="List Encounters",
    description="Returns all encounters in the system.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def list_encounters_endpoint(db: Session = Depends(get_db)):
    """List all encounters from the database."""
    encounters = crud.list_encounters(db)
    return {
        "encounters": [
            {
                "id": enc.id,
                "patient_id": enc.patient_id,
                "patient_name": (crud.get_patient(db, enc.patient_id).name
                                 if enc.patient_id and crud.get_patient(db, enc.patient_id) else "Unknown"),
                "type": enc.type,
                "status": enc.status,
                "time": enc.created_at.strftime("%I:%M %p") if enc.created_at else "—",
                "doctor": enc.doctor_id or "—",
            }
            for enc in encounters
        ]
    }


@router.post(
    "/encounters",
    summary="Create Encounter",
    description="Creates a new encounter and adds it to the patient queue.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def create_encounter_endpoint(body: dict, db: Session = Depends(get_db)):
    """
    Create a new encounter. The frontend POSTs encounter data here
    so it appears in the queue with all fields populated.
    """
    patient_name = body.get("patient_name", "Unknown")
    patient_id = body.get("patient_id", "")
    encounter_type = body.get("type", "Prescription OCR")
    enc_status = body.get("status", "Waiting")
    doctor_name = body.get("doctor", "")
    age = body.get("age")
    gender = body.get("gender", "")

    # Try to find or enrich from patient registry
    if patient_id:
        patient = crud.get_patient(db, patient_id)
        if patient:
            if not age:
                age = patient.age
            if not gender:
                gender = patient.gender
            if not patient_name or patient_name == "Unknown":
                patient_name = patient.name
    else:
        # Search by name
        results = crud.search_patients(db, patient_name, limit=1)
        if results:
            patient = results[0]
            patient_id = patient.id
            if not age:
                age = patient.age
            if not gender:
                gender = patient.gender

    # Auto-assign a doctor if none provided
    doctor_id = None
    if not doctor_name:
        doctor_name = random.choice(_AVAILABLE_DOCTORS)

    # Try to resolve doctor_name to a staff_id
    # Search for staff with matching name
    from db.models import Staff
    doctor_staff = db.query(Staff).filter(Staff.full_name == doctor_name, Staff.role == "doctor").first()
    if doctor_staff:
        doctor_id = doctor_staff.staff_id

    # Generate encounter ID
    enc_id = body.get("id", "")
    if not enc_id:
        enc_id = crud.get_next_encounter_id(db)

    # Check if encounter already exists (avoid duplicates from frontend sync)
    existing = crud.get_encounter(db, enc_id)
    if existing:
        return {"encounter": {
            "id": existing.id,
            "patient_name": patient_name,
            "patient_id": existing.patient_id,
            "type": existing.type,
            "status": existing.status,
            "time": existing.created_at.strftime("%I:%M %p") if existing.created_at else "—",
            "age": age,
            "gender": gender,
            "doctor": doctor_name,
        }, "message": "Encounter already exists"}

    encounter = crud.create_encounter(
        db,
        id=enc_id,
        patient_id=patient_id or None,
        doctor_id=doctor_id,
        type=encounter_type,
        status=enc_status,
    )

    time_str = body.get("time", encounter.created_at.strftime("%I:%M %p") if encounter.created_at else "—")

    return {
        "encounter": {
            "id": encounter.id,
            "patient_name": patient_name,
            "patient_id": patient_id,
            "type": encounter.type,
            "status": encounter.status,
            "time": time_str,
            "age": age,
            "gender": gender,
            "doctor": doctor_name,
        },
        "message": "Encounter created successfully",
    }


@router.get(
    "/patients/search",
    summary="Search Patient Registry",
    description="Search patients by name, ID, or phone number.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def search_patients_endpoint(q: str = "", db: Session = Depends(get_db)):
    """Search patient registry from database."""
    patients = crud.search_patients(db, q)
    return {
        "patients": [
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "phone": p.phone,
                "address": p.address,
                "registered": p.registered_at.strftime("%Y-%m-%d") if p.registered_at else "—",
            }
            for p in patients
        ]
    }


@router.post(
    "/patients/register",
    summary="Register New Patient",
    description="Register a new patient and return the assigned patient ID.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def register_patient_endpoint(body: dict, db: Session = Depends(get_db)):
    """Register a new patient into the database."""
    name = body.get("name", "").strip()
    age = body.get("age")
    gender = body.get("gender", "").strip()
    phone = body.get("phone", "").strip()
    address = body.get("address", "").strip()
    force = body.get("force", False)  # Allow override if nurse confirms

    if not name:
        return JSONResponse(status_code=400, content={"detail": "Patient name is required"})

    # ── Duplicate detection (medical safety) ──
    if not force:
        existing = crud.find_duplicate_patient(
            db, name=name, phone=phone,
            age=int(age) if age else None,
            gender=gender,
        )
        if existing:
            return JSONResponse(
                status_code=409,
                content={
                    "detail": f"A patient with similar details already exists: {existing.name} ({existing.id})",
                    "existing_patient": {
                        "id": existing.id,
                        "name": existing.name,
                        "age": existing.age,
                        "gender": existing.gender,
                        "phone": existing.phone,
                        "address": existing.address,
                    },
                },
            )

    patient = crud.create_patient(
        db,
        name=name,
        age=int(age) if age else None,
        gender=gender or "U",
        phone=phone,
        address=address,
    )

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "phone": patient.phone,
            "address": patient.address,
            "registered": patient.registered_at.strftime("%Y-%m-%d") if patient.registered_at else "—",
        },
        "message": "Patient registered successfully",
    }


@router.post(
    "/vitals",
    summary="Save Vitals to Database",
    description="Persist nurse-recorded vital signs for a patient encounter into the database.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def save_vitals_endpoint(body: dict, db: Session = Depends(get_db)):
    """
    Receives a vitals payload from the nurse vitals-entry page and writes
    all measurements to the Vitals table, linked to the VIT-* encounter and patient.

    Expected body keys (all optional except encounter_id + patient_id):
        encounter_id, patient_id,
        temperature (°C → stored as °F if needed, here we store as-is),
        pulse, bp_systolic, bp_diastolic, resp_rate, spo2, weight, height, notes
    """
    encounter_id = body.get("encounter_id", "").strip()
    patient_id   = body.get("patient_id", "").strip()
    recorded_by  = body.get("recorded_by", "").strip() or None

    if not encounter_id or not patient_id:
        return JSONResponse(
            status_code=400,
            content={"detail": "encounter_id and patient_id are required"}
        )

    # Ensure the encounter exists (auto-create if the frontend hasn't yet)
    enc = crud.get_encounter(db, encounter_id)
    if not enc:
        crud.create_encounter(
            db,
            id=encounter_id,
            patient_id=patient_id,
            type="Vitals Entry",
            status="Completed",
        )

    # If a Vitals row already exists for this encounter, update it (idempotent)
    from db.models import Vitals as VitalsModel
    existing_vitals = db.query(VitalsModel).filter(
        VitalsModel.encounter_id == encounter_id
    ).first()

    def _maybe_float(key):
        v = body.get(key)
        try: return float(v) if v not in (None, "", "null") else None
        except (TypeError, ValueError): return None

    def _maybe_int(key):
        v = body.get(key)
        try: return int(float(v)) if v not in (None, "", "null") else None
        except (TypeError, ValueError): return None

    if existing_vitals:
        # Merge new readings into the existing row (don't overwrite with None)
        if _maybe_float("temperature") is not None:
            existing_vitals.temperature  = _maybe_float("temperature")
        if _maybe_int("pulse") is not None:
            existing_vitals.pulse        = _maybe_int("pulse")
        if _maybe_int("bp_systolic") is not None:
            existing_vitals.bp_systolic  = _maybe_int("bp_systolic")
        if _maybe_int("bp_diastolic") is not None:
            existing_vitals.bp_diastolic = _maybe_int("bp_diastolic")
        if _maybe_int("resp_rate") is not None:
            existing_vitals.resp_rate    = _maybe_int("resp_rate")
        if _maybe_float("spo2") is not None:
            existing_vitals.spo2         = _maybe_float("spo2")
        if _maybe_float("weight") is not None:
            existing_vitals.weight       = _maybe_float("weight")
        if _maybe_float("height") is not None:
            existing_vitals.height       = _maybe_float("height")
        if body.get("notes"):
            existing_vitals.notes = body["notes"]
        db.commit()
        db.refresh(existing_vitals)
        vitals_row = existing_vitals
    else:
        vitals_row = crud.create_vitals(
            db,
            encounter_id  = encounter_id,
            patient_id    = patient_id,
            temperature   = _maybe_float("temperature"),
            pulse         = _maybe_int("pulse"),
            bp_systolic   = _maybe_int("bp_systolic"),
            bp_diastolic  = _maybe_int("bp_diastolic"),
            resp_rate     = _maybe_int("resp_rate"),
            spo2          = _maybe_float("spo2"),
            weight        = _maybe_float("weight"),
            height        = _maybe_float("height"),
            notes         = body.get("notes") or None,
            recorded_by   = recorded_by,
        )

    return {
        "message": "Vitals saved successfully",
        "encounter_id": encounter_id,
        "patient_id": patient_id,
        "vitals_id": vitals_row.id,
    }



@router.post(
    "/ocr",
    response_model=OCRResultResponse,
    responses={
        400: {"model": OCRErrorResponse},
        422: {"model": OCRErrorResponse},
        500: {"model": OCRErrorResponse}
    },
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))]
)
async def upload_prescription_for_ocr(
        encounter_id: str = Form(..., description="Clinical encounter ID"),
        patient_id: str = Form(..., description="Patient ID"),
        language_hint: Optional[str] = Form("auto", description="Language hint: 'en', 'ta', 'hi', 'auto'"),
        captured_by: str = Form(..., description="Staff ID of nurse capturing image"),
        image: UploadFile = File(..., description="Prescription image (JPG/PNG, max 10MB)"),
        db: Session = Depends(get_db),
):
    """
    Nurse station endpoint: Upload prescription image → OCR → workflow advancement.
    Results are saved to the database.
    """

    # 1. Validate file type and size
    if image.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPG/PNG images supported"
        )

    # 2. Enforce 10MB size limit
    try:
        contents = await image.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Image exceeds 10MB limit"
            )
    except Exception as e:
        logger.error(f"File read error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file"
        )

    # 3. Determine language mode
    language_mode = _map_language_hint(language_hint)

    # 4. Ensure the encounter exists in DB (it may have been created via localStorage pre-DB)
    existing_enc = crud.get_encounter(db, encounter_id)
    if not existing_enc:
        crud.create_encounter(
            db,
            id=encounter_id,
            patient_id=patient_id or None,
            type="Prescription OCR",
            status="OCR Processing",
        )
        logger.info(f"Auto-created encounter {encounter_id} in DB (was missing)")

    # 5. Get dependencies
    ocr_processor = get_ocr_processor(language_mode.value)
    workflow = get_or_create_workflow(encounter_id, patient_id)

    # 5. Save to temp file for OCR processing
    temp_dir = tempfile.mkdtemp(prefix="aira_ocr_")
    temp_path = Path(temp_dir) / f"ocr_{encounter_id}_{image.filename}"

    try:
        with open(temp_path, "wb") as f:
            f.write(contents)

        # 6. Execute OCR
        try:
            result = await ocr_processor.process_document(
                image_path=temp_path,
                encounter_id=encounter_id,
                workflow=workflow,
                triggered_by=captured_by,
                auto_detect_type=True
            )

            # 7. Save OCR result to database
            crud.create_ocr_result(
                db,
                encounter_id=encounter_id,
                document_type=result.document_type,
                language_detected=result.language_detected,
                confidence_mean=result.confidence.mean,
                processing_time_ms=result.processing_time_ms,
                raw_text=result.raw_text,
                normalized_text=result.normalized_text,
                structured_fields=[f.model_dump() for f in result.structured_fields],
                safety_flags=result.safety_flags,
                requires_doctor_review=(
                    "LOW_CONFIDENCE_TAMIL_OCR" in result.safety_flags
                    or "LOW_OCR_CONFIDENCE" in result.safety_flags
                ),
            )

            response = OCRResultResponse(
                status=OCRStatus.SUCCESS if not result.safety_flags else OCRStatus.LOW_CONFIDENCE,
                encounter_id=encounter_id,
                workflow_state=workflow.current_state.name,
                document_type=result.document_type,
                language_detected=result.language_detected,
                confidence_mean=result.confidence.mean,
                processing_time_ms=result.processing_time_ms,
                raw_text=result.raw_text,
                normalized_text=result.normalized_text,
                structured_fields=[f.model_dump() for f in result.structured_fields],
                safety_flags=result.safety_flags,
                requires_doctor_review=(
                        "LOW_CONFIDENCE_TAMIL_OCR" in result.safety_flags
                        or "LOW_OCR_CONFIDENCE" in result.safety_flags
                ),
                extracted_fields_count=len(result.structured_fields)
            )

            logger.info(
                f"OCR complete | encounter={encounter_id} | "
                f"lang={result.language_detected} | conf={result.confidence.mean:.0f}% | "
                f"fields={len(result.structured_fields)} | flags={result.safety_flags}"
            )

            return response

        except LowConfidenceError as e:
            logger.warning(f"Low confidence OCR | encounter={encounter_id}")
            result = getattr(e, 'result', None)
            if result:
                return OCRResultResponse(
                    status=OCRStatus.LOW_CONFIDENCE,
                    encounter_id=encounter_id,
                    workflow_state=workflow.current_state.name,
                    document_type=result.document_type,
                    language_detected=result.language_detected,
                    confidence_mean=result.confidence.mean,
                    processing_time_ms=result.processing_time_ms,
                    raw_text=result.raw_text,
                    normalized_text=result.normalized_text,
                    structured_fields=[f.model_dump() for f in result.structured_fields],
                    safety_flags=result.safety_flags,
                    requires_doctor_review=True,
                    extracted_fields_count=len(result.structured_fields)
                )
            return OCRResultResponse(
                status=OCRStatus.LOW_CONFIDENCE,
                encounter_id=encounter_id,
                workflow_state=workflow.current_state.name,
                language_detected="unknown",
                confidence_mean=0.0,
                processing_time_ms=0,
                safety_flags=["LOW_CONFIDENCE_TAMIL_OCR"],
                requires_doctor_review=True,
                extracted_fields_count=0
            )

        except OCRError as e:
            logger.error(f"OCR failed | encounter={encounter_id} | {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OCR processing failed - please retake image"
            )

    finally:
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception as cleanup_err:
            logger.warning(f"Temp file cleanup failed: {cleanup_err}")


def _map_language_hint(hint: str) -> LanguageMode:
    """Map language hints to Tesseract language modes"""
    mapping = {
        "en": LanguageMode.ENGLISH,
        "ta": LanguageMode.TAMIL,
        "hi": LanguageMode.HINDI,
        "auto": LanguageMode.ENGLISH_TAMIL,
        "eng+tam": LanguageMode.ENGLISH_TAMIL,
        "eng+hin": LanguageMode.ENGLISH_HINDI
    }
    return mapping.get(hint, LanguageMode.ENGLISH_TAMIL)