from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

class ClinicalEntity(BaseModel):
    text: str
    label: Literal["CONDITION", "MEDICATION", "SYMPTOM", "PROCEDURE"]
    confidence: float = Field(ge=0.0, le=1.0)
    timeline: Optional[str] = None  # e.g., "10 years", "acute onset"

class ClinicalNote(BaseModel):
    patient_id: str
    encounter_id: str
    language: Literal["en", "ta", "hi", "es", "fr"]  # Tamil = "ta"
    transcript: str
    entities: List[ClinicalEntity]
    ai_draft: str
    doctor_verified: bool = False  # 🔒 HUMAN-IN-THE-LOOP GATE
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    safety_flags: List[str] = []  # e.g., ["LOW_CONFIDENCE_TAMIL", "CONTRADICTORY_SYMPTOMS"]