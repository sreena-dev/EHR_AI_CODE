from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional
import tempfile
import os
import logging
from pathlib import Path

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

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nurse", tags=["Nurse Station"])


# ─── Mock encounter data (replace with DB query in production) ───
_MOCK_ENCOUNTERS = [
    {
        "id": "ENC-2026-001",
        "patient_name": "Priya Sharma",
        "type": "Prescription OCR",
        "status": "Completed",
        "time": "10:30 AM",
    },
    {
        "id": "ENC-2026-002",
        "patient_name": "Rajesh Kumar",
        "type": "Lab Report",
        "status": "Pending OCR",
        "time": "11:15 AM",
    },
    {
        "id": "ENC-2026-003",
        "patient_name": "Meena Devi",
        "type": "Prescription OCR",
        "status": "Completed",
        "time": "11:45 AM",
    },
    {
        "id": "ENC-2026-004",
        "patient_name": "Arjun Patel",
        "type": "Prescription OCR",
        "status": "Requires Review",
        "time": "12:00 PM",
    },
    {
        "id": "ENC-2026-005",
        "patient_name": "Lakshmi R.",
        "type": "Lab Report",
        "status": "Pending OCR",
        "time": "12:30 PM",
    },
    {
        "id": "ENC-2026-006",
        "patient_name": "Suresh M.",
        "type": "Prescription OCR",
        "status": "Completed",
        "time": "01:00 PM",
    },
    {
        "id": "ENC-2026-007",
        "patient_name": "Kavitha S.",
        "type": "Lab Report",
        "status": "Requires Review",
        "time": "01:30 PM",
    },
    {
        "id": "ENC-2026-008",
        "patient_name": "Ramesh V.",
        "type": "Prescription OCR",
        "status": "Pending OCR",
        "time": "02:00 PM",
    },
]


@router.get(
    "/dashboard-stats",
    summary="Nurse Dashboard Stats",
    description="Returns encounter list and aggregate counts for the nurse dashboard.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def get_dashboard_stats():
    """
    Returns today's encounters and aggregated stat counts.
    Production: Replace _MOCK_ENCOUNTERS with a DB query filtered by today's date.
    """
    encounters = _MOCK_ENCOUNTERS

    total = len(encounters)
    pending_ocr = sum(1 for e in encounters if e["status"] == "Pending OCR")
    requires_review = sum(1 for e in encounters if e["status"] == "Requires Review")
    completed = sum(1 for e in encounters if e["status"] == "Completed")

    return {
        "encounters": encounters,
        "counts": {
            "total": total,
            "pending_ocr": pending_ocr,
            "requires_review": requires_review,
            "completed": completed,
        },
    }


# ─── Mock patient queue data ───
_MOCK_QUEUE = [
    {"token": "#001", "name": "Priya Sharma",  "age": 28, "gender": "F", "reason": "Follow-up",               "doctor": "Dr. Kumar", "status": "In Consultation", "wait_time": "-"},
    {"token": "#002", "name": "Rajesh Kumar",   "age": 45, "gender": "M", "reason": "New Visit — Chest Pain",  "doctor": "Dr. Kumar", "status": "Waiting",          "wait_time": "15 min"},
    {"token": "#003", "name": "Meena Devi",     "age": 62, "gender": "F", "reason": "Lab Review",              "doctor": "Dr. Priya", "status": "Waiting",          "wait_time": "22 min"},
    {"token": "#004", "name": "Arjun Patel",    "age": 35, "gender": "M", "reason": "Prescription Refill",     "doctor": "Dr. Kumar", "status": "Waiting",          "wait_time": "30 min"},
    {"token": "#005", "name": "Lakshmi R.",     "age": 50, "gender": "F", "reason": "New Visit — Diabetes",    "doctor": "Dr. Priya", "status": "Checked In",       "wait_time": "5 min"},
    {"token": "#006", "name": "Suresh M.",      "age": 70, "gender": "M", "reason": "Follow-up — Heart",       "doctor": "Dr. Kumar", "status": "OCR Processing",   "wait_time": "8 min"},
    {"token": "#007", "name": "Kavitha S.",     "age": 42, "gender": "F", "reason": "Skin Allergy",            "doctor": "Dr. Priya", "status": "Completed",        "wait_time": "-"},
    {"token": "#008", "name": "Ramesh V.",      "age": 55, "gender": "M", "reason": "Blood Pressure Check",    "doctor": "Dr. Kumar", "status": "Completed",        "wait_time": "-"},
    {"token": "#009", "name": "Anitha K.",      "age": 33, "gender": "F", "reason": "Prenatal Checkup",        "doctor": "Dr. Priya", "status": "Waiting",          "wait_time": "40 min"},
    {"token": "#010", "name": "Deepak N.",      "age": 60, "gender": "M", "reason": "Post-Op Review",          "doctor": "Dr. Kumar", "status": "In Consultation",  "wait_time": "-"},
]


@router.get(
    "/queue-stats",
    summary="Patient Queue Stats",
    description="Returns the patient queue with status counts for the queue page.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def get_queue_stats():
    """
    Returns the patient queue list and aggregated counts.
    Production: Replace _MOCK_QUEUE with a DB query.
    """
    patients = _MOCK_QUEUE

    total = len(patients)
    waiting = sum(1 for p in patients if p["status"] in ("Waiting", "Checked In"))
    in_progress = sum(1 for p in patients if p["status"] in ("In Consultation", "OCR Processing"))
    completed = sum(1 for p in patients if p["status"] == "Completed")

    return {
        "patients": patients,
        "counts": {
            "total": total,
            "waiting": waiting,
            "in_progress": in_progress,
            "completed": completed,
        },
    }


# ─── Mock patient registry (production: database) ───
_PATIENT_REGISTRY = [
    {"id": "PID-10001", "name": "Priya Sharma",   "age": 28, "gender": "F", "phone": "9876543210", "address": "12 MG Road, Chennai",     "registered": "2025-06-15"},
    {"id": "PID-10002", "name": "Rajesh Kumar",    "age": 45, "gender": "M", "phone": "9876543211", "address": "45 Anna Nagar, Chennai",   "registered": "2025-08-20"},
    {"id": "PID-10003", "name": "Meena Devi",      "age": 62, "gender": "F", "phone": "9876543212", "address": "78 T Nagar, Chennai",      "registered": "2024-12-01"},
    {"id": "PID-10004", "name": "Arjun Patel",     "age": 35, "gender": "M", "phone": "9876543213", "address": "23 Velachery, Chennai",    "registered": "2025-11-10"},
    {"id": "PID-10005", "name": "Lakshmi R.",      "age": 50, "gender": "F", "phone": "9876543214", "address": "56 Adyar, Chennai",        "registered": "2025-03-05"},
    {"id": "PID-10006", "name": "Suresh M.",       "age": 70, "gender": "M", "phone": "9876543215", "address": "89 Mylapore, Chennai",     "registered": "2024-07-22"},
    {"id": "PID-10007", "name": "Kavitha S.",      "age": 42, "gender": "F", "phone": "9876543216", "address": "34 Tambaram, Chennai",     "registered": "2025-01-18"},
    {"id": "PID-10008", "name": "Ramesh V.",       "age": 55, "gender": "M", "phone": "9876543217", "address": "67 Porur, Chennai",        "registered": "2025-09-30"},
]

_next_pid = 10009  # auto-increment for new registrations


@router.get(
    "/patients/search",
    summary="Search Patient Registry",
    description="Search patients by name, ID, or phone number.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def search_patients(q: str = ""):
    """Search mock patient registry. Production: DB query with LIKE / full-text."""
    if not q or len(q) < 2:
        return {"patients": _PATIENT_REGISTRY[:5]}  # return first 5 if no query

    q_lower = q.lower()
    results = [
        p for p in _PATIENT_REGISTRY
        if q_lower in p["name"].lower()
        or q_lower in p["id"].lower()
        or q_lower in p["phone"]
    ]
    return {"patients": results}


@router.post(
    "/patients/register",
    summary="Register New Patient",
    description="Register a new patient and return the assigned patient ID.",
    dependencies=[Depends(verify_staff_role(["nurse", "admin"]))],
)
async def register_patient(body: dict):
    """Register a new patient. Production: insert into DB."""
    global _next_pid

    name = body.get("name", "").strip()
    age = body.get("age")
    gender = body.get("gender", "").strip()
    phone = body.get("phone", "").strip()
    address = body.get("address", "").strip()

    if not name:
        return JSONResponse(status_code=400, content={"detail": "Patient name is required"})

    new_patient = {
        "id": f"PID-{_next_pid}",
        "name": name,
        "age": int(age) if age else None,
        "gender": gender or "U",
        "phone": phone,
        "address": address,
        "registered": "2026-02-25",
    }
    _PATIENT_REGISTRY.append(new_patient)
    _next_pid += 1

    return {"patient": new_patient, "message": "Patient registered successfully"}


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
        image: UploadFile = File(..., description="Prescription image (JPG/PNG, max 10MB)")
):
    """
    Nurse station endpoint: Upload prescription image → OCR → workflow advancement.

    SECURITY CONTROLS:
    - Role-based access (nurses/admins only)
    - File type/size validation
    - Async processing with timeout protection
    - PHI-safe responses (raw text NOT logged)
    - Automatic workflow state advancement

    TAMIL SUPPORT:
    - Auto-detects Tamil script
    - Applies Tamil-optimized preprocessing
    - Flags low-confidence Tamil OCR for doctor review
    """

    # 1. Validate file type and size
    if image.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPG/PNG images supported"
        )

    # 2. Enforce 10MB size limit (prevent DoS)
    try:
        contents = await image.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB
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

    # 4. Get dependencies
    ocr_processor = get_ocr_processor(language_mode.value)
    workflow = get_or_create_workflow(encounter_id, patient_id)

    # 5. Save to temp file for OCR processing
    temp_dir = tempfile.mkdtemp(prefix="aira_ocr_")
    temp_path = Path(temp_dir) / f"ocr_{encounter_id}_{image.filename}"

    try:
        # Write image to disk (Tesseract requires file path)
        with open(temp_path, "wb") as f:
            f.write(contents)

        # 6. Execute OCR with workflow integration
        try:
            result = await ocr_processor.process_document(
                image_path=temp_path,
                encounter_id=encounter_id,
                workflow=workflow,
                triggered_by=captured_by,
                auto_detect_type=True
            )

            # 7. Build response with extracted data
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
            # Non-fatal: Return result with safety flags (requires doctor review)
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
        # 8. Cleanup temp file (critical for PHI security)
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
        "auto": LanguageMode.ENGLISH_TAMIL,  # Default bilingual mode
        "eng+tam": LanguageMode.ENGLISH_TAMIL,
        "eng+hin": LanguageMode.ENGLISH_HINDI
    }
    return mapping.get(hint, LanguageMode.ENGLISH_TAMIL)