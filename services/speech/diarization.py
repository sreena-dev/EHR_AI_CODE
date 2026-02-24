"""
Speaker diarization for doctor-patient separation.
Uses pyannote.audio (free, offline, MIT licensed).
"""
import logging
from pathlib import Path
from typing import List
from .models import TranscriptSegment, SpeakerSegment

logger = logging.getLogger(__name__)

class SpeakerDiarizer:
    """
    Separates doctor vs patient speech using speaker embedding.
    Critical for clinical safety (avoid mixing patient symptoms with doctor notes).
    """
    
    def __init__(self):
        # Lazy loading to avoid heavy imports at startup
        self._pipeline = None
    
    async def diarize(
        self, 
        audio_path: Path, 
        transcript_segments: List[TranscriptSegment]
    ) -> List[SpeakerSegment]:
        """
        Assign speaker labels to transcript segments.
        Returns: List of SpeakerSegment with speaker_id ("DOCTOR" or "PATIENT")
        """
        try:
            # Lazy load pyannote (heavy dependency)
            if self._pipeline is None:
                from pyannote.audio import Pipeline
                # Requires free Hugging Face token (store in .env)
                import os
                hf_token = os.getenv("HF_TOKEN")
                if not hf_token:
                    logger.warning("HF_TOKEN not set - skipping diarization")
                    return self._fallback_diarization(transcript_segments)
                
                self._pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    token=hf_token
                )
            
            # Run diarization
            diarization = self._pipeline(str(audio_path))
            
            # Map diarization to transcript segments
            speaker_segments = []
            for seg in transcript_segments:
                # Find dominant speaker in segment time window
                segment_speakers = []
                for turn, _, speaker in diarization.itertracks(yield_label=True):
                    if turn.start <= seg.start <= turn.end or turn.start <= seg.end <= turn.end:
                        segment_speakers.append(speaker)
                
                dominant_speaker = max(set(segment_speakers), key=segment_speakers.count) if segment_speakers else "SPEAKER_00"
                speaker_segments.append(
                    SpeakerSegment(
                        start=seg.start,
                        end=seg.end,
                        speaker_id=dominant_speaker,
                        text=seg.text
                    )
                )
            
            # Classify speakers as DOCTOR/PATIENT using speaking patterns
            return self._classify_speakers(speaker_segments)
            
        except Exception as e:
            logger.warning(f"Diarization failed (using fallback): {e}")
            return self._fallback_diarization(transcript_segments)
    
    def _classify_speakers(self, segments: List[SpeakerSegment]) -> List[SpeakerSegment]:
        """Heuristic classification of speakers based on clinical patterns"""
        # Count speaker occurrences
        speaker_counts = {}
        for seg in segments:
            speaker_counts[seg.speaker_id] = speaker_counts.get(seg.speaker_id, 0) + 1
        
        # Most frequent speaker = DOCTOR (typically talks more)
        if speaker_counts:
            doctor_speaker = max(speaker_counts, key=speaker_counts.get)
            for seg in segments:
                seg.speaker_role = "DOCTOR" if seg.speaker_id == doctor_speaker else "PATIENT"
        else:
            # Fallback: Alternate speakers
            for i, seg in enumerate(segments):
                seg.speaker_role = "DOCTOR" if i % 2 == 0 else "PATIENT"
        
        return segments
    
    def _fallback_diarization(self, segments: List[TranscriptSegment]) -> List[SpeakerSegment]:
        """Simple alternating speaker fallback"""
        return [
            SpeakerSegment(
                start=seg.start,
                end=seg.end,
                speaker_id=f"SPEAKER_{i:02d}",
                speaker_role="DOCTOR" if i % 2 == 0 else "PATIENT",
                text=seg.text
            )
            for i, seg in enumerate(segments)
        ]