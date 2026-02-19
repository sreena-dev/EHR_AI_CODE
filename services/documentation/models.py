from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

class NoteSection(str, Enum):
    SUBJECTIVE = "subjective"
    OBJECTIVE = "objective"
    ASSESSMENT = "assessment"
    PLAN = "plan"

class ClinicalNote(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    safety_flags: List[str] = []
    requires_verification: bool = True
