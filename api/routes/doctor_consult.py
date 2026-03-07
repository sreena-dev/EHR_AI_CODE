"""
Doctor consultation endpoints: real-time transcription + note generation.
"""
from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import tempfile
import os
from pathlib import Path
from typing import Optional
import logging

from ..dependencies import get_current_staff, verify_staff_role
from services.speech.transcribe import ClinicalTranscriber
from services.documentation.generator import ClinicalNoteGenerator
from core.workflow import AIRAWorkflow, WorkflowState
from services.speech.exceptions import TranscriptionError, LowConfidenceError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/doctor", tags=["Doctor Consultation"])

# Singleton instances (production: use dependency injection)
_transcriber = None
_note_generator = None

def get_transcriber() -> ClinicalTranscriber:
    global _transcriber
    if _transcriber is None:
        _transcriber = ClinicalTranscriber(model_size="small")  # CPU-friendly
    return _transcriber

def get_note_generator() -> ClinicalNoteGenerator:
    global _note_generator
    if _note_generator is None:
        _note_generator = ClinicalNoteGenerator()
    return _note_generator

@router.get(
    "/upcoming-patients",
    summary="Upcoming Patients for Doctor",
    description="Returns encounters created by nurses that are assigned to or available for the doctor.",
    dependencies=[Depends(verify_staff_role(["doctor", "admin"]))],
)
async def get_upcoming_patients():
    """
    Fetch encounters from the database.
    Returns upcoming (non-completed) patients plus aggregate counts.
    """
    from db.database import SessionLocal
    from db import crud

    db = SessionLocal()
    try:
        encounters = crud.list_encounters(db)
        counts = crud.get_encounter_counts(db)

        # Build upcoming list (everything not completed)
        upcoming = []
        for enc in encounters:
            if enc.status == "Completed":
                continue

            patient = crud.get_patient(db, enc.patient_id) if enc.patient_id else None
            doctor = crud.get_staff(db, enc.doctor_id) if enc.doctor_id else None

            upcoming.append({
                "id": enc.id,
                "patient_name": patient.name if patient else "Unknown",
                "patient_id": enc.patient_id or "",
                "type": enc.type or "—",
                "status": enc.status or "Waiting",
                "time": enc.created_at.strftime("%I:%M %p") if enc.created_at else "—",
                "age": patient.age if patient else "—",
                "gender": patient.gender if patient else "—",
                "doctor": doctor.full_name if doctor else "—",
            })

        return {
            "upcoming": upcoming,
            "counts": {
                "total": counts["total"],
                "waiting": counts["waiting"],
                "in_progress": counts["in_progress"],
                "completed": counts["completed"],
            },
        }
    finally:
        db.close()


@router.get(
    "/patient-detail",
    summary="Patient Detail for Doctor",
    description="Returns full patient info with encounters, OCR results, and vitals.",
    dependencies=[Depends(verify_staff_role(["doctor", "admin"]))],
)
async def get_patient_detail(patient_id: str):
    """
    Fetch complete patient context for the doctor:
    - Patient demographics
    - All encounters with OCR results and vitals
    """
    from db.database import SessionLocal
    from db import crud
    from db.models import Encounter

    db = SessionLocal()
    try:
        patient = crud.get_patient(db, patient_id)
        if not patient:
            return JSONResponse(status_code=404, content={"detail": "Patient not found"})

        # Get all encounters for this patient
        encounters_data = []
        encounters = db.query(Encounter).filter(
            Encounter.patient_id == patient_id
        ).order_by(Encounter.created_at.desc()).all()

        # ── Collect ALL vitals for this patient ──
        # First try direct patient_id lookup (works for newly-saved vitals),
        # then fall back to encounter_id join for older records missing patient_id.
        from db.models import Vitals as VitalsModel
        from sqlalchemy import or_
        all_encounter_ids = [enc.id for enc in encounters]

        all_vitals_rows = (
            db.query(VitalsModel)
            .filter(
                or_(
                    VitalsModel.patient_id == patient_id,
                    *(
                        [VitalsModel.encounter_id.in_(all_encounter_ids)]
                        if all_encounter_ids else []
                    ),
                )
            )
            .order_by(VitalsModel.recorded_at.desc())
            .all()
        )

        def _vitals_to_dict(v):
            return {
                "temperature":  v.temperature,
                "pulse":        v.pulse,
                "bp_systolic":  v.bp_systolic,
                "bp_diastolic": v.bp_diastolic,
                "resp_rate":    v.resp_rate,
                "spo2":         v.spo2,
                "weight":       v.weight,
                "height":       v.height,
                "notes":        v.notes,
                "encounter_id": v.encounter_id,
                "recorded_at":  v.recorded_at.strftime("%Y-%m-%d %I:%M %p") if v.recorded_at else "—",
            }

        all_vitals_list  = [_vitals_to_dict(v) for v in all_vitals_rows]
        vitals_by_enc    = {v["encounter_id"]: v for v in all_vitals_list}

        for enc in encounters:
            # OCR results for this encounter
            ocr_results = crud.get_ocr_results_for_encounter(db, enc.id)
            ocr_list = []
            for ocr in ocr_results:
                ocr_list.append({
                    "id": ocr.id,
                    "document_type": ocr.document_type,
                    "language_detected": ocr.language_detected,
                    "confidence": ocr.confidence_mean,
                    "raw_text": ocr.raw_text,
                    "normalized_text": ocr.normalized_text,
                    "structured_fields": ocr.structured_fields or [],
                    "safety_flags": ocr.safety_flags or [],
                    "requires_review": ocr.requires_doctor_review,
                    "created_at": ocr.created_at.strftime("%Y-%m-%d %I:%M %p") if ocr.created_at else "—",
                })

            # Vitals: use pre-fetched lookup (covers VIT-*, ENC-*, any encounter type)
            vitals_data = vitals_by_enc.get(enc.id)

            # Clinical note
            note = crud.get_clinical_note(db, enc.id)
            note_data = None
            if note:
                note_data = {
                    "ai_draft": note.ai_draft,
                    "final_note": note.final_note,
                    "doctor_verified": note.doctor_verified,
                    "verified_at": note.verified_at.strftime("%Y-%m-%d %I:%M %p") if note.verified_at else None,
                }

            encounters_data.append({
                "id": enc.id,
                "type": enc.type or "—",
                "status": enc.status or "—",
                "chief_complaint": enc.chief_complaint or "",
                "visit_type": enc.visit_type or "",
                "language": enc.language or "en",
                "created_at": enc.created_at.strftime("%Y-%m-%d %I:%M %p") if enc.created_at else "—",
                "ocr_results": ocr_list,
                "vitals": vitals_data,
                "clinical_note": note_data,
            })

        return {
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "phone": patient.phone,
                "address": patient.address,
                "blood_group": patient.blood_group,
                "medical_history": patient.medical_history,
                "allergies": patient.allergies,
            },
            "encounters": encounters_data,
            # Top-level list so sidebar shows vitals regardless of which encounter type stored them
            "all_vitals": all_vitals_list,
        }
    finally:
        db.close()

@router.post(
    "/transcribe",
    dependencies=[Depends(verify_staff_role(["doctor", "nurse"]))]
)
async def transcribe_consultation_audio(
    encounter_id: str = Form(...),
    patient_id: str = Form(...),
    language_hint: Optional[str] = Form(None),
    audio: UploadFile = File(...),
    staff_id: str = Depends(get_current_staff)
):
    """
    Transcribe doctor-patient consultation audio.
    Returns structured transcript with safety flags.
    """
    # Validate audio type
    ALLOWED_AUDIO_TYPES = [
        "audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave",  # WAV variants
        "audio/mpeg", "audio/mp3",  # MP3 variants
        "audio/webm", "audio/ogg",  # Browser recording defaults
    ]
    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: {audio.content_type}. Only WAV, MP3, WEBM, OGG supported."
        )
    
    # Save to temp file
    temp_dir = tempfile.mkdtemp(prefix="aira_audio_")
    temp_path = Path(temp_dir) / f"audio_{encounter_id}_{audio.filename}"
    
    try:
        # Write audio file
        contents = await audio.read()
        with open(temp_path, "wb") as f:
            f.write(contents)
        logger.info(f"Audio file written to {temp_path}. Size: {len(contents)} bytes")
        
        # Get workflow instance
        logger.info(f"Initializing/fetching workflow for encounter {encounter_id}")
        from api.dependencies import get_or_create_workflow
        workflow = get_or_create_workflow(encounter_id, patient_id)
        
        # Transcribe
        logger.info(f"Starting transcription for {encounter_id} with language_hint={language_hint}")
        transcriber = get_transcriber()
        try:
            result = await transcriber.transcribe_clinical_audio(
                audio_path=temp_path,
                encounter_id=encounter_id,
                workflow=workflow,
                triggered_by=staff_id,
                language_hint=language_hint,
                enable_diarization=True
            )
            
            return JSONResponse({
                "status": "success",
                "encounter_id": encounter_id,
                "language": result.language,
                "confidence": result.language_confidence,
                "transcript": result.full_transcript,
                "safety_flags": result.safety_flags,
                "requires_verification": result.requires_verification,
                "workflow_state": workflow.current_state.name
            })
            
        except LowConfidenceError as e:
            # Non-fatal: Return result with verification flag
            return JSONResponse({
                "status": "low_confidence",
                "encounter_id": encounter_id,
                "message": str(e),
                "safety_flags": getattr(e, 'safety_flags', ["LOW_CONFIDENCE"]),
                "requires_verification": True,
                "workflow_state": workflow.current_state.name
            }, status_code=202)  # 202 Accepted (processing continues with human review)
        except TranscriptionError as e:
            # Structural transcription failure
            logger.error(f"TranscriptionError for {encounter_id}: {e}")
            return JSONResponse({
                "status": "error",
                "encounter_id": encounter_id,
                "message": f"Transcription failed: {str(e)}"
            }, status_code=500)
        except Exception as e:
            # Unexpected system crash
            logger.exception(f"Unhandled error in transcription: {e}")
            return JSONResponse({
                "status": "error",
                "message": "A system error occurred during transcription processing"
            }, status_code=500)
            
    finally:
        # Cleanup
        try:
            if temp_path.exists():
                os.remove(temp_path)
            os.rmdir(temp_dir)
        except Exception as e:
            logger.warning(f"Temp file cleanup failed: {e}")

@router.post(
    "/generate-note",
    dependencies=[Depends(verify_staff_role(["doctor"]))]
)
async def generate_clinical_note(
    encounter_id: str = Form(...),
    patient_id: str = Form(...),
    staff_id: str = Depends(get_current_staff)
):
    """
    Generate clinical note draft from transcript + OCR/NLP data.
    Requires workflow to be in DOCTOR_REVIEW_PENDING state.
    """
    from api.dependencies import get_or_create_workflow
    
    workflow = get_or_create_workflow(encounter_id, patient_id)
    
    # Safety check: Must be in DOCTOR_REVIEW_PENDING state
    if workflow.current_state != WorkflowState.DOCTOR_REVIEW_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workflow not in DOCTOR_REVIEW_PENDING state (current: {workflow.current_state.name})"
        )
    
    # Get required data
    transcript = workflow.get_data("transcript")
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No transcript found in workflow"
        )
    
    clinical_entities = workflow.get_data("clinical_entities", [])
    ocr_text = workflow.get_data("ocr_text", "")
    
    # Generate note
    generator = get_note_generator()
    try:
        note = await generator.generate_note(
            workflow=workflow,
            encounter_id=encounter_id,
            transcript=transcript,
            clinical_entities=clinical_entities,
            ocr_text=ocr_text
        )
        
        return {
            "status": "success",
            "encounter_id": encounter_id,
            "note_draft": note.model_dump(),
            "requires_verification": True,  # Always require doctor edit
            "safety_flags": note.safety_flags
        }
        
    except Exception as e:
        logger.error(f"Note generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Note generation failed - please try again"
        )

@router.post(
    "/verify-note",
    dependencies=[Depends(verify_staff_role(["doctor"]))]
)
async def verify_clinical_note(
    encounter_id: str = Form(...),
    patient_id: str = Form(...),
    verified_note: str = Form(...),
    staff_id: str = Depends(get_current_staff)
):
    """
    Doctor verifies and approves clinical note for EMR save.
    This is the FINAL safety gate before EMR persistence.
    """
    from api.dependencies import get_or_create_workflow
    
    workflow = get_or_create_workflow(encounter_id, patient_id)
    
    # Mark as verified
    workflow.mark_doctor_verified(
        staff_id=staff_id,
        notes="Clinical note verified and approved"
    )
    
    # Advance to EMR_SAVED (safety gate enforced in workflow engine)
    await workflow.advance_to(
        WorkflowState.EMR_SAVED,
        triggered_by=staff_id
    )
    
    # Store final note
    workflow.set_data("final_clinical_note", verified_note)
    
    return {
        "status": "success",
        "encounter_id": encounter_id,
        "message": "Clinical note verified and saved to EMR",
        "workflow_state": workflow.current_state.name,
        "audit_trail_entries": len(workflow.audit_trail)
    }