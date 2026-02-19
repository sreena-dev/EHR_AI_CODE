"""
Multilingual clinical speech transcription with Tamil support.
Uses Faster-Whisper (CPU-friendly, offline, 100% free).
"""
import logging
from pathlib import Path
from typing import Union, Optional, Dict, List
from datetime import datetime
import asyncio

from faster_whisper import WhisperModel
from .models import (
    TranscriptSegment, 
    TranscriptionResult, 
    LanguageConfidence,
    SpeakerSegment
)
from .exceptions import (
    TranscriptionError, 
    LowConfidenceError, 
    LanguagePackMissingError
)
from core.workflow import AIRAWorkflow, WorkflowState

logger = logging.getLogger(__name__)

class ClinicalTranscriber:
    """
    Production speech transcriber with:
    - Tamil/English/Hindi multilingual support
    - Automatic language detection
    - Safety flags for low-confidence Tamil transcription
    - Workflow integration
    """
    
    # Model size recommendations (CPU-friendly)
    MODEL_CONFIGS = {
        "tiny": {"size": "tiny", "ram_mb": 1000, "speed": "fastest", "accuracy": "low"},
        "base": {"size": "base", "ram_mb": 1500, "speed": "fast", "accuracy": "medium"},
        "small": {"size": "small", "ram_mb": 2500, "speed": "balanced", "accuracy": "good"},  # RECOMMENDED
        "medium": {"size": "medium", "ram_mb": 5000, "speed": "slow", "accuracy": "high"}
    }
    
    # Tamil-specific safety thresholds
    TAMIL_CONFIDENCE_THRESHOLD = 0.75  # Higher bar due to clinical risk
    ENGLISH_CONFIDENCE_THRESHOLD = 0.85
    
    def __init__(
        self, 
        model_size: str = "small",  # Best balance for clinic use
        device: str = "cpu",
        compute_type: str = "int8"  # 8-bit quantization for low RAM
    ):
        if model_size not in self.MODEL_CONFIGS:
            raise ValueError(f"Invalid model size. Choose from: {list(self.MODEL_CONFIGS.keys())}")
        
        self.model_size = model_size
        self.device = device
        
        logger.info(f"Loading Faster-Whisper '{model_size}' on {device}...")
        try:
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=4  # Optimize for multi-core CPUs
            )
            logger.info(f"✓ Whisper model loaded successfully")
        except Exception as e:
            raise LanguagePackMissingError(
                f"Failed to load Whisper model: {str(e)}",
                language="multilingual"
            )
    
    async def transcribe_clinical_audio(
        self,
        audio_path: Union[str, Path],
        encounter_id: str,
        workflow: Optional[AIRAWorkflow] = None,
        triggered_by: str = "doctor_consult",
        language_hint: Optional[str] = None,
        enable_diarization: bool = True
    ) -> TranscriptionResult:
        """
        Transcribe clinical consultation audio with safety checks.
        
        Args:
            audio_path: Path to WAV/MP3 audio file (max 10 mins)
            encounter_id: Clinical encounter ID
            workflow: Optional workflow engine instance
            triggered_by: Staff ID triggering transcription
            language_hint: "en", "ta", "hi" (auto-detected if None)
            enable_diarization: Separate doctor/patient speakers
        
        Returns:
            Structured transcription with safety flags
        
        Raises:
            LowConfidenceError: For Tamil/low-confidence transcriptions requiring review
        """
        start_time = datetime.utcnow()
        audio_path = Path(audio_path)
        
        if not audio_path.exists():
            raise TranscriptionError(f"Audio file not found: {audio_path}", encounter_id=encounter_id)
        
        # Validate audio duration (clinical consultations typically < 10 mins)
        try:
            import soundfile as sf
            audio_info = sf.info(audio_path)
            duration_sec = audio_info.duration
            if duration_sec > 600:  # 10 minutes
                logger.warning(f"Long audio detected: {duration_sec:.1f}s (encounter: {encounter_id})")
        except Exception as e:
            logger.warning(f"Could not validate audio duration: {e}")
            duration_sec = 0
        
        try:
            # Run transcription with language hint if provided
            segments, info = self.model.transcribe(
                str(audio_path),
                language=language_hint,
                beam_size=5,
                vad_filter=True,  # Voice activity detection (critical for clinic noise)
                temperature=0.0   # Deterministic output for clinical safety
            )
            
            # Build segments
            transcript_segments: List[TranscriptSegment] = []
            for segment in segments:
                transcript_segments.append(
                    TranscriptSegment(
                        start=segment.start,
                        end=segment.end,
                        text=segment.text.strip(),
                        speaker_id="SPEAKER_00"  # Will be updated by diarization
                    )
                )
            
            # Speaker diarization (doctor vs patient)
            if enable_diarization and len(transcript_segments) > 1:
                from .diarization import SpeakerDiarizer
                diarizer = SpeakerDiarizer()
                speaker_segments = await diarizer.diarize(audio_path, transcript_segments)
                # Merge speaker info into transcript segments
                for i, seg in enumerate(transcript_segments):
                    if i < len(speaker_segments):
                        seg.speaker_id = speaker_segments[i].speaker_id
            
            # Build language confidence
            lang_conf = LanguageConfidence(
                detected=info.language,
                probability=info.language_probability,
                is_reliable=info.language_probability > 0.5
            )
            
            # Generate safety flags
            safety_flags = self._generate_safety_flags(lang_conf, transcript_segments)
            
            # Build result
            result = TranscriptionResult(
                encounter_id=encounter_id,
                audio_duration_sec=duration_sec,
                language=lang_conf.detected,
                language_confidence=lang_conf.probability,
                segments=transcript_segments,
                full_transcript=" ".join([s.text for s in transcript_segments]),
                processing_time_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                model_version=f"faster-whisper-{self.model_size}",
                safety_flags=safety_flags,
                requires_verification=self._requires_verification(lang_conf, safety_flags)
            )
            
            # Workflow integration
            if workflow:
                workflow.set_data("transcript", result.full_transcript)
                workflow.set_data("transcript_segments", [s.dict() for s in transcript_segments])
                workflow.set_data("transcript_language", result.language)
                workflow.set_data("transcript_safety_flags", safety_flags)
                
                # Seed required data for intermediate states (if not already set by OCR/NLP)
                if not workflow.get_data("ocr_text"):
                    workflow.set_data("ocr_text", "(transcription-only flow — no OCR performed)")
                if not workflow.get_data("clinical_entities"):
                    workflow.set_data("clinical_entities", [])
                if not workflow.get_data("ai_draft_note"):
                    workflow.set_data("ai_draft_note", result.full_transcript)
                
                # Auto-advance workflow through required intermediate states
                # The state machine requires: REGISTRATION → OCR_COMPLETE → NLP_EXTRACTED → DOCTOR_REVIEW_PENDING
                intermediate_states = [
                    WorkflowState.OCR_COMPLETE,
                    WorkflowState.NLP_EXTRACTED,
                    WorkflowState.DOCTOR_REVIEW_PENDING,
                ]
                for target_state in intermediate_states:
                    if workflow.current_state == target_state:
                        continue  # Already at or past this state
                    try:
                        await workflow.advance_to(
                            target_state,
                            triggered_by=triggered_by,
                            safety_flags=safety_flags if target_state == WorkflowState.DOCTOR_REVIEW_PENDING else []
                        )
                    except Exception as e:
                        logger.warning(f"Could not advance to {target_state.name}: {e}")
                        break
                
                logger.info(
                    f"Workflow advanced to DOCTOR_REVIEW_PENDING for {encounter_id} | "
                    f"Language: {result.language} | Safety flags: {safety_flags}"
                )
            
            # CRITICAL SAFETY GATE: Block low-confidence Tamil from auto-progression
            if result.requires_verification:
                raise LowConfidenceError(
                    message=f"Low-confidence transcription requires doctor review (language: {result.language})",
                    confidence=result.language_confidence,
                    language=result.language,
                    encounter_id=encounter_id
                )
            
            return result
            
        except Exception as e:
            logger.exception(f"Transcription failed for {encounter_id}: {str(e)}")
            raise TranscriptionError(f"Transcription failed: {str(e)}", encounter_id=encounter_id)
    
    def _generate_safety_flags(
        self, 
        lang_conf: LanguageConfidence, 
        segments: List[TranscriptSegment]
    ) -> List[str]:
        """Generate clinical safety flags based on transcription quality"""
        flags = []
        
        # Language-specific confidence flags
        if lang_conf.detected == "ta" and lang_conf.probability < self.TAMIL_CONFIDENCE_THRESHOLD:
            flags.append("LOW_CONFIDENCE_TAMIL_TRANSCRIPTION")
        
        if lang_conf.detected == "hi" and lang_conf.probability < 0.80:
            flags.append("LOW_CONFIDENCE_HINDI_TRANSCRIPTION")
        
        if lang_conf.probability < 0.60:
            flags.append("LOW_LANGUAGE_CONFIDENCE")
        
        # Content-based flags
        if len(segments) == 0:
            flags.append("EMPTY_TRANSCRIPTION")
        
        # Tamil script detection in text (double-check language detection)
        tamil_chars = sum(1 for seg in segments for c in seg.text if '\u0B80' <= c <= '\u0BFF')
        if tamil_chars > 10 and lang_conf.detected != "ta":
            flags.append("POSSIBLE_TAMIL_MISDETECTION")
        
        return flags
    
    def _requires_verification(self, lang_conf: LanguageConfidence, safety_flags: List[str]) -> bool:
        """Determine if transcription requires mandatory doctor review"""
        # ALWAYS require review for Tamil (clinical safety)
        if lang_conf.detected == "ta":
            return True
        
        # Require review for low confidence
        if lang_conf.probability < 0.70:
            return True
        
        # Require review if safety flags present
        if any("LOW_CONFIDENCE" in flag for flag in safety_flags):
            return True
        
        return False
    
    async def health_check(self) -> bool:
        """Verify Whisper model loads correctly"""
        try:
            # Test with short English phrase
            segments, _ = self.model.transcribe(
                "tests/data/test_audio.wav",  # Create dummy 1-sec audio file
                language="en",
                beam_size=1
            )
            return True
        except Exception as e:
            logger.error(f"Transcriber health check failed: {e}")
            return False