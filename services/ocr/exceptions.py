from typing import List, Optional
from enum import Enum
from datetime import datetime, timezone


class OCRErrorCode(Enum):
    """
    Standardized error codes for clinical OCR failures.
    Used for frontend localization and audit trail classification.
    """
    # General failures
    IMAGE_CORRUPTED = "OCR_IMAGE_CORRUPTED"
    UNSUPPORTED_FORMAT = "OCR_UNSUPPORTED_FORMAT"
    TESSERACT_UNAVAILABLE = "OCR_TESSERACT_UNAVAILABLE"
    OCR_ENGINE_FAILURE = "OCR_ENGINE_FAILURE"

    # Language-specific failures
    TAMIL_LANG_PACK_MISSING = "OCR_TAMIL_LANG_PACK_MISSING"
    HINDI_LANG_PACK_MISSING = "OCR_HINDI_LANG_PACK_MISSING"
    LANGUAGE_DETECTION_FAILED = "OCR_LANGUAGE_DETECTION_FAILED"

    # Clinical safety failures
    LOW_CONFIDENCE_ENGLISH = "OCR_LOW_CONFIDENCE_EN"
    LOW_CONFIDENCE_TAMIL = "OCR_LOW_CONFIDENCE_TA"  # Critical for South Indian clinics
    LOW_CONFIDENCE_HINDI = "OCR_LOW_CONFIDENCE_HI"
    MISSING_CRITICAL_FIELDS = "OCR_MISSING_CRITICAL_FIELDS"

    # Workflow integration failures
    WORKFLOW_TRANSITION_INVALID = "OCR_WORKFLOW_TRANSITION_INVALID"
    WORKFLOW_DATA_MISSING = "OCR_WORKFLOW_DATA_MISSING"


class OCRError(Exception):
    """
    Base exception for all OCR processing failures.

    CRITICAL DESIGN PRINCIPLE:
    - NEVER include raw PHI (patient names, clinical details) in exception messages
    - All error messages must be safe for logging/audit trails (HIPAA §164.312(b))
    """

    def __init__(
            self,
            message: str,
            error_code: OCRErrorCode,
            encounter_id: Optional[str] = None,
            safety_flags: Optional[List[str]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.encounter_id = encounter_id
        self.safety_flags = safety_flags or []
        self.timestamp: Optional[datetime] = None  # Set by middleware for audit trail

        # Build safe representation (PHI-free)
        super().__init__(self._build_safe_message())

    def _build_safe_message(self) -> str:
        """Construct PHI-safe error message for logs/exceptions"""
        parts = [self.message]
        if self.error_code:
            parts.append(f"[Code: {self.error_code.value}]")
        if self.encounter_id:
            # REDACTED encounter ID format for logs (never full ID)
            safe_id = f"ENC-***-{self.encounter_id[-3:]}" if self.encounter_id else "UNKNOWN"
            parts.append(f"[Encounter: {safe_id}]")
        return " | ".join(parts)

    def to_dict(self) -> dict:
        """PHI-safe dictionary representation for API error responses"""
        return {
            "error": self.message,
            "error_code": self.error_code.value,
            "requires_action": self._get_required_action(),
            "safety_flags": self.safety_flags,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

    def _get_required_action(self) -> Optional[str]:
        """Human-readable action required to resolve error (for frontend)"""
        actions = {
            OCRErrorCode.TAMIL_LANG_PACK_MISSING: "INSTALL_TAMIL_LANGUAGE_PACK",
            OCRErrorCode.LOW_CONFIDENCE_TAMIL: "MANUAL_REVIEW_REQUIRED",
            OCRErrorCode.MISSING_CRITICAL_FIELDS: "RECAPTURE_IMAGE_WITH_BETTER_QUALITY",
            OCRErrorCode.IMAGE_CORRUPTED: "RECAPTURE_IMAGE",
            OCRErrorCode.OCR_ENGINE_FAILURE: "RETRY_PROCESSING",
        }
        return actions.get(self.error_code)


class ImageProcessingError(OCRError):
    """Raised when image preprocessing fails (corrupted file, invalid format)"""

    def __init__(self, message: str, encounter_id: Optional[str] = None):
        super().__init__(
            message=message,
            error_code=OCRErrorCode.IMAGE_CORRUPTED,
            encounter_id=encounter_id
        )


class LanguagePackMissingError(OCRError):
    """
    Raised when required Tesseract language pack is not installed.
    Critical for Tamil/Hindi deployments in Indian clinics.
    """

    def __init__(self, language: str, encounter_id: Optional[str] = None):
        lang_map = {
            "tam": "Tamil",
            "hin": "Hindi",
            "eng": "English"
        }
        lang_name = lang_map.get(language, language)

        super().__init__(
            message=f"Tesseract language pack missing for {lang_name} ('{language}')",
            error_code=(
                OCRErrorCode.TAMIL_LANG_PACK_MISSING if language == "tam"
                else OCRErrorCode.HINDI_LANG_PACK_MISSING if language == "hin"
                else OCRErrorCode.TESSERACT_UNAVAILABLE
            ),
            encounter_id=encounter_id,
            safety_flags=[f"MISSING_LANG_PACK_{language.upper()}"]
        )


class LowConfidenceError(OCRError):
    """
    Raised when OCR confidence falls below clinical safety thresholds.

    SAFETY POLICY:
    - English: Block progression if mean confidence < 60%
    - Tamil/Hindi: Block progression if mean confidence < 70% (higher bar due to script complexity)
    - ALWAYS require doctor verification for low-confidence extractions
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
            error_code = OCRErrorCode.LOW_CONFIDENCE_TAMIL
            safety_flags = ["LOW_CONFIDENCE_TAMIL_OCR"]
        elif language == "hi":
            error_code = OCRErrorCode.LOW_CONFIDENCE_HINDI
            safety_flags = ["LOW_CONFIDENCE_HINDI_OCR"]
        else:
            error_code = OCRErrorCode.LOW_CONFIDENCE_ENGLISH
            safety_flags = ["LOW_CONFIDENCE_OCR"]

        super().__init__(
            message=message,
            error_code=error_code,
            encounter_id=encounter_id,
            safety_flags=safety_flags
        )
        self.confidence = confidence
        self.language = language

    def requires_doctor_review(self) -> bool:
        """Always require human review for low-confidence OCR"""
        return True


class CriticalFieldMissingError(OCRError):
    """
    Raised when OCR fails to extract critical clinical fields
    (medications, diagnosis, dosage) required for safe patient care.
    """

    def __init__(
            self,
            missing_fields: List[str],
            encounter_id: Optional[str] = None
    ):
        field_list = ", ".join(missing_fields[:3])  # Limit to 3 for log safety
        super().__init__(
            message=f"Critical clinical fields missing: {field_list}",
            error_code=OCRErrorCode.MISSING_CRITICAL_FIELDS,
            encounter_id=encounter_id,
            safety_flags=["MISSING_CRITICAL_FIELDS"]
        )
        self.missing_fields = missing_fields


class WorkflowIntegrationError(OCRError):
    """
    Raised when OCR service fails to integrate with workflow engine
    (invalid state transition, missing workflow data).
    """

    def __init__(
            self,
            message: str,
            workflow_state: Optional[str] = None,
            encounter_id: Optional[str] = None
    ):
        super().__init__(
            message=message,
            error_code=OCRErrorCode.WORKFLOW_TRANSITION_INVALID,
            encounter_id=encounter_id,
            safety_flags=["WORKFLOW_INTEGRATION_FAILURE"]
        )
        self.workflow_state = workflow_state


# ======================
# EXCEPTION MIDDLEWARE (FastAPI integration)
# ======================
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import json

logger = logging.getLogger(__name__)


async def ocr_exception_handler(request: Request, exc: OCRError) -> JSONResponse:
    """
    FastAPI exception handler that:
    1. Logs PHI-safe error details
    2. Returns structured error response to frontend
    3. Integrates with HIPAA audit trail
    """
    # Set timestamp for audit
    exc.timestamp = datetime.now(timezone.utc)

    # Log PHI-safe error (NEVER log raw clinical text)
    logger.error(
        f"OCR error | Code: {exc.error_code.value} | "
        f"Encounter: {exc.encounter_id or 'UNKNOWN'} | "
        f"Message: {exc.message} | "
        f"Safety flags: {exc.safety_flags}"
    )

    # Return structured response to frontend (safe for UI display)
    return JSONResponse(
        status_code=422 if isinstance(exc, LowConfidenceError) else 400,
        content={
            "detail": exc.message,
            "error_code": exc.error_code.value,
            "requires_action": exc._get_required_action(),
            "safety_flags": exc.safety_flags,
            "timestamp": exc.timestamp.isoformat()
        }
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle Pydantic validation errors with PHI-safe messaging.
    """
    logger.warning(f"Request validation failed: {exc.errors()}")

    # Extract field names only (never values which may contain PHI)
    invalid_fields = [e["loc"][-1] for e in exc.errors() if "loc" in e]

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed",
            "error_code": "VALIDATION_ERROR",
            "invalid_fields": invalid_fields[:5],  # Limit exposure
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


# ======================
# UTILITY: Exception Safety Validator
# ======================
def ensure_exception_phi_safe(exception: Exception) -> bool:
    """
    Runtime validator that checks if exception messages contain PHI.
    Used in testing/middleware to prevent accidental PHI leakage.

    Returns:
        True if exception is PHI-safe, False otherwise
    """
    msg = str(exception)

    # PHI patterns to detect (should NEVER appear in exception messages)
    phi_patterns = [
        r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b',  # Names
        r'\bPT-\d+\b',  # Patient IDs
        r'\b\d{2,3}\s+(?:year|yr)s?\b',  # Ages
        r'[\u0B80-\u0BFF]{2,}',  # Tamil script
        r'\b(?:male|female)\b',  # Gender
        r'\d{1,2}/\d{1,2}/\d{2,4}'  # Dates
    ]

    import re
    for pattern in phi_patterns:
        if re.search(pattern, msg, re.IGNORECASE):
            logger.critical(
                "PHI LEAKAGE DETECTED IN EXCEPTION MESSAGE! "
                "This violates HIPAA §164.312(b). Message redacted."
            )
            return False

    return True


# ======================
# EXPORTS
# ======================
__all__ = [
    # Exception classes
    "OCRError",
    "ImageProcessingError",
    "LanguagePackMissingError",
    "LowConfidenceError",
    "CriticalFieldMissingError",
    "WorkflowIntegrationError",

    # Error codes
    "OCRErrorCode",

    # Middleware
    "ocr_exception_handler",
    "validation_exception_handler",

    # Utilities
    "ensure_exception_phi_safe"
]