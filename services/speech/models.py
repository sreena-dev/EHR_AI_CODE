from pydantic import BaseModel
from typing import List, Optional, Union

class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    speaker_id: str = "SPEAKER_00"

class LanguageConfidence(BaseModel):
    detected: str
    probability: float
    is_reliable: bool

class SpeakerSegment(BaseModel):
    speaker_id: str
    speaker_role: Optional[str] = None
    start: float
    end: float
    text: str

class TranscriptionResult(BaseModel):
    encounter_id: str
    audio_duration_sec: float
    language: str
    language_confidence: float
    segments: List[Union[TranscriptSegment, SpeakerSegment]]
    full_transcript: str
    processing_time_ms: int
    model_version: str
    safety_flags: List[str]
    requires_verification: bool
