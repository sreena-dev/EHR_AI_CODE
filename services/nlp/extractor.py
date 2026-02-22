import os
import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import logging
import time
from pathlib import Path

# Set HuggingFace cache directory (prevents re-download on server reload)
_HF_CACHE_DIR = str(Path(__file__).resolve().parent.parent.parent / ".model_cache" / "huggingface")
os.environ.setdefault("HF_HOME", _HF_CACHE_DIR)
os.environ.setdefault("TRANSFORMERS_CACHE", _HF_CACHE_DIR)

from .models import (
    NLPEngineResult,
    ClinicalEntity,
    EntityConfidence,
    EntityType,
    TimelineExpression
)
from .config import NLPConfig, ModelConfig
from .preprocessor import ClinicalTextPreprocessor
from .postprocessor import EntityPostProcessor
from .exceptions import NLPExtractionError, LowConfidenceError
from core.workflow import AIRAWorkflow, WorkflowState

logger = logging.getLogger(__name__)


class ClinicalNLPExtractor:
    """
    Production NLP extraction service with:
    - BioBERT for English clinical text
    - Multilingual BERT for Tamil/Hindi
    - Entity disambiguation and validation
    - Workflow engine integration
    - Safety flags for low-confidence extractions
    """

    def __init__(
            self,
            model_type: Optional[str] = None,
            device: str = "cpu",
            enable_medcat: bool = False
    ):
        self.device = device
        self.enable_medcat = enable_medcat

        # Lazy loading - models loaded on first use
        self._models: Dict[str, pipeline] = {}
        self._tokenizers: Dict[str, AutoTokenizer] = {}

        logger.info(f"NLP Extractor initialized | Device: {device} | MedCAT: {enable_medcat}")

    async def extract_entities(
            self,
            text: str,
            encounter_id: str,
            language: str = "en",
            workflow: Optional[AIRAWorkflow] = None,
            triggered_by: str = "ai_service_nlp"
    ) -> NLPEngineResult:
        """
        End-to-end clinical entity extraction with workflow integration.

        Args:
            text: Raw clinical text (OCR output)
            encounter_id: Clinical encounter ID
            language: Language code ("en", "ta", "hi")
            workflow: Optional workflow engine instance
            triggered_by: Staff/system ID triggering extraction

        Returns:
            Structured NLP extraction result

        Raises:
            NLPExtractionError: For unrecoverable NLP failures
            LowConfidenceError: When confidence falls below safety thresholds
        """
        start_time = datetime.utcnow()

        try:
            # 1. Preprocess text
            preprocessor = ClinicalTextPreprocessor(language=language)
            cleaned_text, preprocessing_ops = preprocessor.preprocess(text)

            if len(cleaned_text) < 10:
                raise NLPExtractionError(
                    "Text too short after preprocessing",
                    encounter_id=encounter_id
                )

            # 2. Select appropriate model based on language
            model_config = NLPConfig.get_model_for_language(language)
            logger.info(f"Using model: {model_config.name} for language: {language}")

            # 3. Load model (lazy loading)
            nlp_pipeline = self._get_or_load_model(model_config)

            # 4. Run entity extraction
            raw_entities = await self._run_extraction(nlp_pipeline, cleaned_text, model_config)

            # 5. Post-process entities (disambiguation, negation detection, etc.)
            postprocessor = EntityPostProcessor(language=language)
            processed_entities = postprocessor.process_entities(
                raw_entities=raw_entities,
                original_text=cleaned_text
            )

            # 6. Extract timeline expressions
            timelines = self._extract_timelines(cleaned_text, processed_entities)

            # 7. Generate safety flags
            safety_flags = self._generate_safety_flags(
                entities=processed_entities,
                language=language,
                text_length=len(cleaned_text)
            )

            # 8. Build result
            processing_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            result = NLPEngineResult(
                encounter_id=encounter_id,
                source_text=cleaned_text[:500] + "..." if len(cleaned_text) > 500 else cleaned_text,
                language=language,
                entities=processed_entities,
                timelines=timelines,
                processing_time_ms=processing_time_ms,
                model_version=model_config.name,
                safety_flags=safety_flags,
                confidence_metrics={
                    "avg_entity_confidence": sum(e.confidence.score for e in processed_entities) / len(
                        processed_entities) if processed_entities else 0.0,
                    "entity_count": len(processed_entities),
                    "text_length": len(cleaned_text)
                }
            )

            # 9. Workflow integration (if provided)
            if workflow:
                # Store NLP result in workflow data
                workflow.set_data("clinical_entities", [e.dict() for e in processed_entities])
                workflow.set_data("nlp_timelines", [t.dict() for t in timelines])
                workflow.set_data("nlp_safety_flags", safety_flags)
                workflow.set_data("nlp_confidence_avg", result.avg_confidence)

                # Auto-advance workflow state with safety flags
                await workflow.advance_to(
                    WorkflowState.NLP_EXTRACTED,
                    triggered_by=triggered_by,
                    safety_flags=safety_flags
                )

                logger.info(
                    f"Workflow advanced to NLP_EXTRACTED for {encounter_id} | "
                    f"Entities: {len(processed_entities)} | "
                    f"Safety flags: {safety_flags}"
                )

            # 10. Safety gate: Block low-confidence extractions
            if result.avg_confidence < 0.5 or "LOW_CONFIDENCE_EXTRACTION" in safety_flags:
                raise LowConfidenceError(
                    f"NLP extraction confidence too low: {result.avg_confidence:.2f}",
                    confidence=result.avg_confidence,
                    language=language,
                    encounter_id=encounter_id
                )

            # Log PHI-safe summary
            logger.info(
                f"NLP extraction complete | {result.to_phi_safe_dict()}"
            )

            return result

        except Exception as e:
            logger.exception(f"NLP extraction failed for {encounter_id}: {str(e)}")
            raise NLPExtractionError(
                f"NLP extraction failed: {str(e)}",
                encounter_id=encounter_id
            ) from e

    def _get_or_load_model(self, config: ModelConfig) -> pipeline:
        """Lazy load model with caching"""
        model_key = f"{config.name}_{config.device}"

        if model_key not in self._models:
            logger.info(f"Loading model: {config.name} on {config.device}")

            try:
                # Load tokenizer (try local cache first, then download)
                try:
                    tokenizer = AutoTokenizer.from_pretrained(
                        config.tokenizer_path or config.model_path,
                        local_files_only=True
                    )
                except OSError:
                    logger.info(f"Downloading tokenizer for {config.name} (first time only)...")
                    tokenizer = AutoTokenizer.from_pretrained(
                        config.tokenizer_path or config.model_path
                    )
                self._tokenizers[model_key] = tokenizer

                # Load model (try local cache first, then download)
                try:
                    model = AutoModelForTokenClassification.from_pretrained(
                        config.model_path, local_files_only=True
                    )
                except OSError:
                    logger.info(f"Downloading model {config.name} (first time only)...")
                    model = AutoModelForTokenClassification.from_pretrained(config.model_path)

                # Move to device
                if config.device == "cuda" and torch.cuda.is_available():
                    model = model.cuda()

                # Create pipeline
                nlp_pipeline = pipeline(
                    "ner",
                    model=model,
                    tokenizer=tokenizer,
                    device=0 if config.device == "cuda" else -1,
                    aggregation_strategy="simple",
                    batch_size=config.batch_size
                )

                self._models[model_key] = nlp_pipeline
                logger.info(f"Model loaded successfully: {config.name}")

            except Exception as e:
                logger.error(f"Failed to load model {config.name}: {str(e)}")
                raise NLPExtractionError(
                    f"Model loading failed: {str(e)}",
                    error_code="MODEL_LOADING_FAILED"
                )

        return self._models[model_key]

    async def _run_extraction(
            self,
            nlp_pipeline: pipeline,
            text: str,
            config: ModelConfig
    ) -> List[Dict]:
        """
        Run NER pipeline and filter by confidence threshold.
        Returns list of raw entity dicts from transformers pipeline.
        """
        try:
            # Run inference
            entities = nlp_pipeline(text)

            # Filter by confidence threshold
            filtered_entities = [
                e for e in entities
                if e.get("score", 0) >= config.confidence_threshold
            ]

            logger.debug(
                f"NER extraction: {len(entities)} raw entities → "
                f"{len(filtered_entities)} filtered (threshold: {config.confidence_threshold})"
            )

            return filtered_entities

        except Exception as e:
            logger.error(f"NER pipeline failed: {str(e)}")
            raise NLPExtractionError(f"Entity extraction failed: {str(e)}")

    def _extract_timelines(
            self,
            text: str,
            entities: List[ClinicalEntity]
    ) -> List[TimelineExpression]:
        """Extract temporal expressions and link to entities"""
        timelines = []

        for pattern in NLPConfig.TEMPORAL_PATTERNS:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                timelines.append(
                    TimelineExpression(
                        text=match.group(0),
                        normalized=self._normalize_timeline(match.group(0)),
                        confidence=0.8,
                        entity_refs=[]  # Could link to nearby entities
                    )
                )

        return timelines[:10]  # Limit to top 10

    def _normalize_timeline(self, text: str) -> str:
        """Normalize timeline expression to ISO 8601 format"""
        # Simple normalization - could use dateparser library for complex cases
        text_lower = text.lower()

        if "year" in text_lower:
            match = re.search(r'(\d+)', text)
            if match:
                years = match.group(1)
                return f"P{years}Y"

        if "month" in text_lower:
            match = re.search(r'(\d+)', text)
            if match:
                months = match.group(1)
                return f"P{months}M"

        if "week" in text_lower:
            match = re.search(r'(\d+)', text)
            if match:
                weeks = match.group(1)
                return f"P{weeks}W"

        if "day" in text_lower:
            match = re.search(r'(\d+)', text)
            if match:
                days = match.group(1)
                return f"P{days}D"

        return text  # Return original if no match

    def _generate_safety_flags(
            self,
            entities: List[ClinicalEntity],
            language: str,
            text_length: int
    ) -> List[str]:
        """Generate clinical safety flags based on extraction quality"""
        flags = []

        # Low entity count flag
        if len(entities) < 3 and text_length > 50:
            flags.append("LOW_ENTITY_COUNT")

        # Low confidence flag
        avg_confidence = sum(e.confidence.score for e in entities) / len(entities) if entities else 0
        if avg_confidence < 0.6:
            flags.append("LOW_CONFIDENCE_EXTRACTION")

        # Language-specific flags
        if language == "ta" and avg_confidence < 0.65:
            flags.append("LOW_CONFIDENCE_TAMIL_NLP")

        if language == "hi" and avg_confidence < 0.65:
            flags.append("LOW_CONFIDENCE_HINDI_NLP")

        # Critical entity missing flags
        entity_types = set(e.entity_type for e in entities)
        if EntityType.CONDITION not in entity_types and EntityType.SYMPTOM not in entity_types:
            flags.append("MISSING_CONDITION_OR_SYMPTOM")

        if EntityType.MEDICATION not in entity_types and text_length > 100:
            flags.append("MISSING_MEDICATION")

        return flags

    async def health_check(self) -> Dict[str, bool]:
        """Verify NLP models are loaded and functional"""
        checks = {}

        # Test BioClinicalBERT
        try:
            test_text = "Patient has diabetes and hypertension."
            config = NLPConfig.BIOCLINICAL_BERT
            pipeline = self._get_or_load_model(config)
            result = pipeline(test_text)
            checks["bioclinical_bert"] = len(result) > 0
        except Exception as e:
            logger.error(f"BioClinicalBERT health check failed: {e}")
            checks["bioclinical_bert"] = False

        # Test Multilingual BERT
        try:
            test_text = "El paciente tiene diabetes."
            config = NLPConfig.MULTILINGUAL_BERT
            pipeline = self._get_or_load_model(config)
            result = pipeline(test_text)
            checks["multilingual_bert"] = len(result) > 0
        except Exception as e:
            logger.error(f"Multilingual BERT health check failed: {e}")
            checks["multilingual_bert"] = False

        return checks