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
    ]
    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only WAV/MP3 audio supported"
        )
    
    # Save to temp file
    temp_dir = tempfile.mkdtemp(prefix="aira_audio_")
    temp_path = Path(temp_dir) / f"audio_{encounter_id}_{audio.filename}"
    
    try:
        # Write audio file
        contents = await audio.read()
        with open(temp_path, "wb") as f:
            f.write(contents)
        
        # Get workflow instance
        from api.dependencies import get_or_create_workflow
        workflow = get_or_create_workflow(encounter_id, patient_id)
        
        # Transcribe
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
                "safety_flags": e.safety_flags,
                "requires_verification": True,
                "workflow_state": workflow.current_state.name
            }, status_code=202)  # 202 Accepted (processing continues with human review)
            
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