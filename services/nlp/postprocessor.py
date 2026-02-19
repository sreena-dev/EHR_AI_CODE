from typing import List, Dict, Optional, Tuple
import re
import logging

from .models import ClinicalEntity, EntityConfidence, EntityType
from .config import NLPConfig

logger = logging.getLogger(__name__)


class EntityPostProcessor:
    """
    Post-processing for extracted entities:
    - Negation detection
    - Temporality analysis
    - Entity disambiguation
    - Confidence calibration
    """

    def __init__(self, language: str = "en"):
        self.language = language

    def process_entities(
            self,
            raw_entities: List[Dict],
            original_text: str
    ) -> List[ClinicalEntity]:
        """
        Post-process raw entities from NER pipeline.
        Returns list of validated ClinicalEntity objects.
        """
        processed = []

        for raw_entity in raw_entities:
            try:
                # Map entity type
                entity_type = self._map_entity_type(raw_entity.get("entity_group", raw_entity.get("entity")))

                # Detect negation
                context_window = self._extract_context(original_text, raw_entity["start"], raw_entity["end"])
                negated = NLPConfig.is_negated(context_window, self.language)

                # Detect temporality
                temporality = self._detect_temporality(context_window)

                # Build ClinicalEntity
                entity = ClinicalEntity(
                    text=raw_entity["word"],
                    entity_type=entity_type,
                    start_char=raw_entity["start"],
                    end_char=raw_entity["end"],
                    confidence=EntityConfidence(
                        score=raw_entity.get("score", 0.0),
                        normalized_score=self._calibrate_confidence(raw_entity.get("score", 0.0)),
                        evidence_count=len(context_window.split()),
                        ambiguity_flags=self._detect_ambiguity(raw_entity["word"])
                    ),
                    context=context_window[:100],  # Limit context length
                    negated=negated,
                    temporality=temporality
                )

                processed.append(entity)

            except Exception as e:
                logger.warning(f"Failed to process entity: {raw_entity}. Error: {e}")
                continue

        # Deduplicate entities (remove overlapping duplicates)
        deduplicated = self._deduplicate_entities(processed)

        return deduplicated

    def _map_entity_type(self, raw_type: str) -> EntityType:
        """Map raw NER label to EntityType enum"""
        # Normalize raw type
        normalized = raw_type.upper().replace("-", "_")

        # Try direct mapping
        if normalized in NLPConfig.ENTITY_MAPPINGS:
            return NLPConfig.ENTITY_MAPPINGS[normalized]

        # Fallback: Try partial match
        for key, value in NLPConfig.ENTITY_MAPPINGS.items():
            if key in normalized:
                return value

        # Default to CONDITION
        logger.warning(f"Unknown entity type: {raw_type}, defaulting to CONDITION")
        return EntityType.CONDITION

    def _extract_context(self, text: str, start: int, end: int, window_size: int = 30) -> str:
        """Extract context window around entity"""
        text_length = len(text)
        window_start = max(0, start - window_size)
        window_end = min(text_length, end + window_size)
        return text[window_start:window_end]

    def _detect_temporality(self, context: str) -> str:
        """Detect temporal context (past/present/future)"""
        context_lower = context.lower()

        # Past indicators
        past_indicators = ["history of", "past", "previous", "before", "since"]
        if any(indicator in context_lower for indicator in past_indicators):
            return "PAST"

        # Future indicators
        future_indicators = ["plan", "will", "scheduled", "future"]
        if any(indicator in context_lower for indicator in future_indicators):
            return "FUTURE"

        return "PRESENT"

    def _calibrate_confidence(self, raw_score: float) -> float:
        """
        Calibrate raw model confidence to more realistic scale.
        BioBERT tends to be overconfident.
        """
        # Simple calibration: compress high scores, expand low scores
        if raw_score > 0.9:
            return 0.85 + (raw_score - 0.9) * 0.15
        elif raw_score > 0.7:
            return 0.7 + (raw_score - 0.7) * 0.3
        else:
            return raw_score * 0.8

    def _detect_ambiguity(self, text: str) -> List[str]:
        """Detect potential ambiguity in entity text"""
        flags = []

        # Check for acronyms (all caps, 2-5 letters)
        if re.match(r'^[A-Z]{2,5}$', text):
            flags.append("AMBIGUOUS_ACRONYM")

        # Check for very short entities (< 3 chars)
        if len(text) < 3:
            flags.append("SHORT_ENTITY")

        # Check for numbers (could be dosage, age, etc.)
        if re.search(r'\d', text):
            flags.append("NUMERIC_ENTITY")

        return flags

    def _deduplicate_entities(self, entities: List[ClinicalEntity]) -> List[ClinicalEntity]:
        """
        Remove duplicate or overlapping entities.
        Keeps highest confidence entity when overlap detected.
        """
        if not entities:
            return []

        # Sort by start position, then by confidence (descending)
        sorted_entities = sorted(entities, key=lambda e: (e.start_char, -e.confidence.score))

        deduplicated = []
        for entity in sorted_entities:
            # Check for overlap with last added entity
            if deduplicated:
                last = deduplicated[-1]
                overlap_start = max(entity.start_char, last.start_char)
                overlap_end = min(entity.end_char, last.end_char)
                overlap_length = max(0, overlap_end - overlap_start)

                # If significant overlap (> 50% of shorter entity), keep higher confidence
                if overlap_length > 0:
                    entity_length = entity.end_char - entity.start_char
                    last_length = last.end_char - last.start_char
                    shorter_length = min(entity_length, last_length)

                    if overlap_length / shorter_length > 0.5:
                        if entity.confidence.score > last.confidence.score:
                            deduplicated[-1] = entity  # Replace with higher confidence
                        continue  # Skip this entity (overlap resolved)

            deduplicated.append(entity)

        return deduplicated