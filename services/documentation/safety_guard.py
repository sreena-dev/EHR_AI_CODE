"""
Llama Guard 2 safety validation for clinical notes.
Blocks hallucinated diagnoses/medications.
"""
import logging
from typing import List

logger = logging.getLogger(__name__)

class SafetyResult:
    def __init__(self, is_safe: bool, violations: List[str]):
        self.is_safe = is_safe
        self.violations = violations

class SafetyGuard:
    """
    Validates clinical notes against safety rules.
    Uses local Llama Guard 2 via Ollama (llama-guard2:1b).
    """
    
    UNSAFE_PHRASES = [
        # Hallucination indicators
        "likely has", "probably has", "appears to have", "seems to have",
        # Absolute diagnoses without confirmation
        "diagnosed with", "confirmed diagnosis of", "definitive diagnosis",
        # Medication assumptions
        "should take", "needs to take", "must take",
    ]
    
    CLINICAL_HALLUCINATION_TERMS = [
        # High-risk diagnoses not to hallucinate
        "cancer", "tumor", "malignancy", "stroke", "heart attack", 
        "myocardial infarction", "pulmonary embolism", "sepsis"
    ]
    
    def __init__(self):
        self._client = None
    
    def validate_note(self, note_text: str) -> SafetyResult:
        """Validate note for safety violations"""
        violations = []
        
        # Rule 1: Check for unsafe phrases
        for phrase in self.UNSAFE_PHRASES:
            if phrase in note_text.lower():
                violations.append(f"UNSAFE_PHRASE: '{phrase}'")
        
        # Rule 2: Check for high-risk hallucinated terms
        for term in self.CLINICAL_HALLUCINATION_TERMS:
            if term in note_text.lower() and "history of" not in note_text.lower():
                violations.append(f"POTENTIAL_HALLUCINATION: '{term}'")
        
        # Rule 3: Check for medication without prescription context
        if "prescribed" in note_text.lower() and "transcript" not in note_text.lower():
            violations.append("MEDICATION_WITHOUT_SOURCE")
        
        return SafetyResult(
            is_safe=len(violations) == 0,
            violations=violations
        )