from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class OCRStatus(str, Enum):
    SUCCESS = "success"
    LOW_CONFIDENCE = "low_confidence"  # Requires doctor review
    FAILED = "failed"


class OCRResultResponse(BaseModel):
    """
    OCR response schema with full extracted data for development.
    NOTE: In production, consider removing raw_text to keep responses PHI-safe.
    """
    status: OCRStatus
    encounter_id: str
    workflow_state: str  # e.g., "ocr_complete"
    document_type: str = Field(default="prescription", description="Detected document type")
    language_detected: str  # "en", "ta", "mixed"
    confidence_mean: float = Field(ge=0.0, le=100.0)
    processing_time_ms: int
    raw_text: Optional[str] = Field(default=None, description="Full extracted text from OCR")
    normalized_text: Optional[str] = Field(default=None, description="Medical-domain normalized OCR text")
    structured_fields: Optional[List[dict]] = Field(default=None, description="Parsed structured fields")
    safety_flags: List[str] = Field(default_factory=list)
    requires_doctor_review: bool = Field(
        description="True if safety flags require human verification before NLP"
    )
    extracted_fields_count: int = Field(
        description="Count of structured fields extracted"
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "status": "success",
                "encounter_id": "ENC-2024-001",
                "workflow_state": "ocr_complete",
                "document_type": "lab_report",
                "language_detected": "en",
                "confidence_mean": 82.5,
                "processing_time_ms": 2340,
                "raw_text": "BLOOD GLUCOSE - FASTING 171 mg/dL ...",
                "structured_fields": [{"field_type": "MEDICATION", "text": "Metformin", "confidence": 85.0}],
                "safety_flags": [],
                "requires_doctor_review": False,
                "extracted_fields_count": 7,
                "timestamp": "2024-02-03T14:30:00Z"
            }
        }


class OCRErrorResponse(BaseModel):
    detail: str
    error_code: str  # e.g., "OCR_FAILED", "MISSING_TAMIL_LANG_PACK"
    requires_action: Optional[str] = None  # e.g., "INSTALL_TAMIL_LANGUAGE_PACK"