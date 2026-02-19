from typing import List, Optional
from enum import Enum


class NLPErrorCode(Enum):
    """Standardized NLP error codes"""
    EXTRACTION_FAILED = "NLP_EXTRACTION_FAILED"
    MODEL_LOADING_FAILED = "NLP_MODEL_LOADING_FAILED"
    LOW_CONFIDENCE_ENGLISH = "NLP_LOW_CONFIDENCE_EN"
    LOW_CONFIDENCE_TAMIL = "NLP_LOW_CONFIDENCE_TA"
    LOW_CONFIDENCE_HINDI = "NLP_LOW_CONFIDENCE_HI"
    MISSING_CRITICAL_ENTITIES = "NLP_MISSING_CRITICAL_ENTITIES"
    TEXT_TOO_SHORT = "NLP_TEXT_TOO_SHORT"
    LANGUAGE_DETECTION_FAILED = "NLP_LANGUAGE_DETECTION_FAILED"


class NLPExtractionError(Exception):
    """
    Base exception for NLP extraction failures.
    PHI-safe: Never includes raw clinical text in error messages.
    """

    def __init__(
            self,
            message: str,
            encounter_id: Optional[str] = None,
            error_code: NLPErrorCode = NLPErrorCode.EXTRACTION_FAILED,
            safety_flags: Optional[List[str]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.encounter_id = encounter_id
        self.safety_flags = safety_flags or []
        self.timestamp = None

        # Build PHI-safe representation
        safe_parts = [message]
        if error_code:
            safe_parts.append(f"[Code: {error_code.value}]")
        if encounter_id:
            safe_id = f"ENC-***-{encounter_id[-3:]}" if encounter_id else "UNKNOWN"
            safe_parts.append(f"[Encounter: {safe_id}]")

        super().__init__(" | ".join(safe_parts))

    def to_dict(self) -> dict:
        """PHI-safe dictionary for API responses"""
        return {
            "error": self.message,
            "error_code": self.error_code.value,
            "requires_action": self._get_required_action(),
            "safety_flags": self.safety_flags,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

    def _get_required_action(self) -> Optional[str]:
        """Human-readable action required"""
        actions = {
            NLPErrorCode.MODEL_LOADING_FAILED: "RESTART_NLP_SERVICE",
            NLPErrorCode.TEXT_TOO_SHORT: "RECAPTURE_IMAGE_WITH_MORE_TEXT",
            NLPErrorCode.LOW_CONFIDENCE_TAMIL: "MANUAL_REVIEW_REQUIRED",
        }
        return actions.get(self.error_code)


class LowConfidenceError(NLPExtractionError):
    """
    Raised when NLP extraction confidence falls below clinical safety thresholds.
    Requires doctor review before proceeding.
    """

    def __init__(
            self,
            message: str,
            confidence: float,
            language: str,
            encounter_id: Optional[str] = None
    ):
        # Determine error code based on language
        if language == "ta":
            error_code = NLPErrorCode.LOW_CONFIDENCE_TAMIL
            safety_flags = ["LOW_CONFIDENCE_TAMIL_NLP"]
        elif language == "hi":
            error_code = NLPErrorCode.LOW_CONFIDENCE_HINDI
            safety_flags = ["LOW_CONFIDENCE_HINDI_NLP"]
        else:
            error_code = NLPErrorCode.LOW_CONFIDENCE_ENGLISH
            safety_flags = ["LOW_CONFIDENCE_NLP"]

        super().__init__(
            message=message,
            encounter_id=encounter_id,
            error_code=error_code,
            safety_flags=safety_flags
        )
        self.confidence = confidence
        self.language = language

    def requires_doctor_review(self) -> bool:
        """Always require human review for low-confidence NLP"""
        return True


# FastAPI exception handlers
from fastapi import Request
from fastapi.responses import JSONResponse
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def nlp_exception_handler(request: Request, exc: NLPExtractionError) -> JSONResponse:
    """FastAPI exception handler for NLP errors"""
    exc.timestamp = datetime.utcnow()

    # Log PHI-safe error
    logger.error(
        f"NLP error | Code: {exc.error_code.value} | "
        f"Encounter: {exc.encounter_id or 'UNKNOWN'} | "
        f"Message: {exc.message}"
    )

    return JSONResponse(
        status_code=422 if isinstance(exc, LowConfidenceError) else 400,
        content=exc.to_dict()
    )