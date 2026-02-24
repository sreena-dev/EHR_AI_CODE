from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal, Dict, Any, Sequence
from datetime import datetime, timezone
import re

class OCRConfidence(BaseModel):
    mean: float = Field(ge=0.0, le=100.0)
    min: float = Field(ge=0.0, le=100.0)
    low_confidence_words: List[str] = Field(default_factory=list)

class PrescriptionField(BaseModel):
    field_type: Literal[
        "PATIENT_NAME", "AGE", "GENDER", "DATE", 
        "MEDICATION", "DOSAGE", "DURATION", 
        "DIAGNOSIS", "DOCTOR_NAME", "HOSPITAL", "SYMPTOM"
    ]
    text: str
    confidence: float = Field(ge=0.0, le=100.0)
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    bounding_box: Optional[List[int]] = None

class LabTestField(BaseModel):
    """Structured lab test result field"""
    test_name: str
    result_value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    interpretation: Optional[Literal["High", "Low", "Normal", "Abnormal"]] = None
    confidence: float = Field(ge=0.0, le=100.0)

class DocumentMetadata(BaseModel):
    """Document-type-specific metadata"""
    metadata: Dict[str, Any] = Field(default_factory=dict)

class OCRExtractionResult(BaseModel):
    encounter_id: str
    original_filename: str
    language_detected: Literal["en", "ta", "hi", "mixed"]
    raw_text: str
    normalized_text: Optional[str] = Field(default=None, description="Medical-domain normalized text (None if no corrections needed)")
    structured_fields: Sequence[PrescriptionField | LabTestField]  # Union type
    confidence: OCRConfidence
    processing_time_ms: int
    safety_flags: List[str] = Field(default_factory=list)
    document_type: str = Field(default="prescription")
    document_metadata: Optional[DocumentMetadata] = None
    type_detection_confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }
    
    @property
    def requires_doctor_review(self) -> bool:
        return any(flag.startswith("LOW_CONFIDENCE") or "MISSING" in flag for flag in self.safety_flags)