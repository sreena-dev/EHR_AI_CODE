from pydantic import BaseModel, Field, validator, ConfigDict
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import re


class EntityType(str, Enum):
    """
    Clinical entity types based on UMLS semantic groups.
    Used for structured EMR integration.
    """
    CONDITION = "CONDITION"  # Diseases, diagnoses
    SYMPTOM = "SYMPTOM"  # Patient-reported symptoms
    MEDICATION = "MEDICATION"  # Drugs, prescriptions
    DOSAGE = "DOSAGE"  # Drug dosage/frequency
    PROCEDURE = "PROCEDURE"  # Medical procedures
    TEST = "TEST"  # Lab tests, imaging
    ANATOMY = "ANATOMY"  # Body parts, organs
    SEVERITY = "SEVERITY"  # Severity modifiers
    DURATION = "DURATION"  # Timeline expressions
    ALLERGY = "ALLERGY"  # Allergies
    FAMILY_HISTORY = "FAMILY_HISTORY"  # Family medical history
    SOCIAL_HISTORY = "SOCIAL_HISTORY"  # Smoking, alcohol, occupation


class EntityConfidence(BaseModel):
    """Confidence metrics for clinical entity extraction"""
    score: float = Field(ge=0.0, le=1.0, description="Model confidence score")
    normalized_score: float = Field(ge=0.0, le=1.0, description="Calibrated confidence")
    evidence_count: int = Field(ge=0, description="Supporting context tokens")
    ambiguity_flags: List[str] = Field(default_factory=list)  # e.g., "AMBIGUOUS_ACRONYM"
    
    model_config = ConfigDict(arbitrary_types_allowed=True)


class ClinicalEntity(BaseModel):
    """Structured clinical entity with provenance"""
    text: str = Field(..., min_length=1)
    entity_type: EntityType
    start_char: int
    end_char: int
    confidence: EntityConfidence
    normalized_form: Optional[str] = None  # Standardized term (e.g., SNOMED CT)
    cui: Optional[str] = None  # UMLS Concept Unique Identifier (from MedCAT)
    semantic_type: Optional[str] = None  # UMLS semantic type
    context: Optional[str] = None  # Surrounding text snippet
    negated: bool = False  # True if negated (e.g., "no fever")
    temporality: Literal["PAST", "PRESENT", "FUTURE", "UNKNOWN"] = "UNKNOWN"
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @validator("text")
    def sanitize_text(cls, v):
        """Remove excessive whitespace and normalize"""
        return re.sub(r'\s+', ' ', v.strip())


class TimelineExpression(BaseModel):
    """Extracted temporal information"""
    text: str
    normalized: str  # e.g., "10 years" -> "P10Y"
    entity_refs: List[int] = Field(default_factory=list)  # Indices of related entities
    confidence: float = Field(ge=0.0, le=1.0)


class NLPEngineResult(BaseModel):
    """Complete NLP extraction result for workflow integration"""
    encounter_id: str
    source_text: str  # OCR output (truncated in logs for PHI safety)
    language: Literal["en", "ta", "hi", "mixed"]
    entities: List[ClinicalEntity]
    timelines: List[TimelineExpression]
    summary: Dict[str, Any] = Field(default_factory=dict)  # Aggregated insights
    processing_time_ms: int
    model_version: str
    safety_flags: List[str] = Field(default_factory=list)
    confidence_metrics: Dict[str, float] = Field(default_factory=dict)
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        json_encoders={datetime: lambda dt: dt.isoformat()}
    )

    @property
    def entity_count(self) -> int:
        return len(self.entities)

    @property
    def avg_confidence(self) -> float:
        if not self.entities:
            return 0.0
        return sum(e.confidence.score for e in self.entities) / len(self.entities)

    def get_entities_by_type(self, entity_type: EntityType) -> List[ClinicalEntity]:
        """Filter entities by type"""
        return [e for e in self.entities if e.entity_type == entity_type]

    def to_phi_safe_dict(self) -> Dict:
        """PHI-safe dictionary for logging (never includes full clinical text)"""
        return {
            "encounter_id": self.encounter_id,
            "language": self.language,
            "entity_count": self.entity_count,
            "entity_types": list(set(e.entity_type for e in self.entities)),
            "avg_confidence": round(self.avg_confidence, 3),
            "safety_flags": self.safety_flags,
            "processing_time_ms": self.processing_time_ms
        }


class ExtractionSummary(BaseModel):
    """Human-readable summary for doctor review UI"""
    conditions: List[str]
    symptoms: List[str]
    medications: List[str]
    tests_ordered: List[str]
    key_concerns: List[str]  # High-severity findings
    data_quality: Literal["HIGH", "MEDIUM", "LOW"]
    requires_clarification: bool
    clarification_questions: List[str]