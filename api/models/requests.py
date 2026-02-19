from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class OCRRquest(BaseModel):
    """
    Nurse station OCR upload request.
    Note: image file uploaded via multipart/form-data (not in JSON body)
    """
    encounter_id: str = Field(..., min_length=5, max_length=50)
    patient_id: Optional[str] = Field(None, min_length=3, max_length=50)
    language_hint: Optional[str] = Field(
        default="auto",
        description="Hint for OCR language: 'en', 'ta', 'hi', 'auto'"
    )
    image_filename: str = Field(..., min_length=1, max_length=255)
    captured_by: str = Field(..., min_length=3, max_length=100)  # Nurse/staff ID

    @validator("language_hint")
    def validate_language(cls, v):
        allowed = {"en", "ta", "hi", "auto", "eng+tam", "eng+hin"}
        if v not in allowed:
            raise ValueError(f"language_hint must be one of {allowed}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "encounter_id": "ENC-2024-001",
                "patient_id": "PT-789",
                "language_hint": "ta",
                "image_filename": "prescription.jpg",
                "captured_by": "nurse_id_456"
            }
        }