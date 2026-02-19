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