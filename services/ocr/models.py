from pydantic import BaseModel, Field, ConfigDict
from typing import Literal, Any, ClassVar
from collections.abc import Sequence
from datetime import datetime, timezone

class OCRConfidence(BaseModel):
    mean: float = Field(ge=0.0, le=100.0)
    min: float = Field(ge=0.0, le=100.0)
    low_confidence_words: list[str] = Field(default_factory=list)

class PrescriptionField(BaseModel):
    field_type: Literal[
        "PATIENT_NAME", "AGE", "GENDER", "DATE", 
        "MEDICATION", "DOSAGE", "DURATION", 
        "DIAGNOSIS", "DOCTOR_NAME", "HOSPITAL", "SYMPTOM"
    ]
    text: str
    confidence: float = Field(ge=0.0, le=100.0)
    dosage: str | None = None
    frequency: str | None = None
    bounding_box: list[int] | None = None

class LabTestField(BaseModel):
    """Structured lab test result field"""
    test_name: str
    result_value: str
    unit: str | None = None
    reference_range: str | None = None
    interpretation: Literal["High", "Low", "Normal", "Abnormal"] | None = None
    confidence: float = Field(ge=0.0, le=100.0)

class DocumentMetadata(BaseModel):
    """Document-type-specific metadata"""
    metadata: dict[str, Any] = Field(default_factory=dict)

class OCRExtractionResult(BaseModel):
    encounter_id: str
    original_filename: str
    language_detected: Literal["en", "ta", "hi", "mixed"]
    raw_text: str
    normalized_text: str | None = Field(default=None, description="Medical-domain normalized text (None if no corrections needed)")
    structured_fields: Sequence[PrescriptionField | LabTestField]
    confidence: OCRConfidence
    processing_time_ms: int
    safety_flags: list[str] = Field(default_factory=list)
    document_type: str = Field(default="prescription")
    document_metadata: DocumentMetadata | None = None
    type_detection_confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )
    
    @property
    def requires_doctor_review(self) -> bool:
        return any(flag.startswith("LOW_CONFIDENCE") or "MISSING" in flag for flag in self.safety_flags)
