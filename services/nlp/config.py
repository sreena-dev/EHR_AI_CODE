from typing import Dict, List, Optional
from enum import Enum
from dataclasses import dataclass
# import entity types
from services.nlp.models import EntityType

class ModelType(Enum):
    """Supported clinical NLP models"""
    BIOCLINICAL_BERT = "bioclinical_bert"
    MEDCAT = "medcat"
    SPACY_SCI = "spacy_sci"
    MULTILINGUAL_BERT = "multilingual_bert"


@dataclass
class ModelConfig:
    """Configuration for a specific NLP model"""
    name: str
    model_path: str
    tokenizer_path: Optional[str] = None
    device: str = "cpu"  # "cpu" or "cuda"
    batch_size: int = 8
    max_length: int = 512
    confidence_threshold: float = 0.7
    supported_languages: List[str] = None

    def __post_init__(self):
        if self.supported_languages is None:
            self.supported_languages = ["en"]


class NLPConfig:
    """
    Production NLP pipeline configuration.
    Optimized for clinical text with multilingual support.
    """

    # BioClinicalBERT - Primary model for English clinical text
    BIOCLINICAL_BERT = ModelConfig(
        name="Bio_ClinicalBERT",
        model_path="emilyalsentzer/Bio_ClinicalBERT",
        tokenizer_path="emilyalsentzer/Bio_ClinicalBERT",
        device="cpu",
        confidence_threshold=0.65,
        supported_languages=["en"]
    )

    # Multilingual BERT - Fallback for Tamil/Hindi
    MULTILINGUAL_BERT = ModelConfig(
        name="Multilingual BERT",
        model_path="bert-base-multilingual-cased",
        tokenizer_path="bert-base-multilingual-cased",
        device="cpu",
        confidence_threshold=0.60,  # Lower threshold for non-English
        supported_languages=["en", "ta", "hi", "es", "fr", "de"]
    )

    # MedCAT - For UMLS/SNOMED linking (optional, requires license)
    MEDCAT_CONFIG = {
        "model_pack_path": "./models/medcat_models",  # Download from MedCAT Hub
        "enable_umls_linking": False,  # Set True if UMLS license available
        "enable_snomed_linking": False  # Set True if SNOMED CT license available
    }

    # Entity type mappings (BioBERT labels → our EntityType enum)
    ENTITY_MAPPINGS = {
        # BioClinicalBERT NER labels
        "PROBLEM": EntityType.CONDITION,
        "SYMPTOM": EntityType.SYMPTOM,
        "TREATMENT": EntityType.MEDICATION,
        "TEST": EntityType.TEST,
        "ANATOMY": EntityType.ANATOMY,

        # Custom mappings for multilingual model
        "DISEASE": EntityType.CONDITION,
        "DRUG": EntityType.MEDICATION,
        "PROCEDURE": EntityType.PROCEDURE,
        "FREQUENCY": EntityType.DOSAGE,

        # Fallback generic types
        "ENTITY": EntityType.CONDITION,
        "MISC": EntityType.CONDITION
    }

    # Negation trigger words (for context analysis)
    NEGATION_TRIGGERS = {
        "en": ["no", "not", "never", "without", "denies", "negative", "absent"],
        "ta": ["இல்லை", "அல்ல", "இல்லாமல்", "இல்லாத"],  # Tamil negations
        "hi": ["नहीं", "बिना", "रहित"]  # Hindi negations
    }

    # Temporal expressions (for timeline extraction)
    TEMPORAL_PATTERNS = [
        r'(\d+)\s*(year|yr|yrs|years)',  # "10 years"
        r'(\d+)\s*(month|months|mo)',  # "6 months"
        r'(\d+)\s*(week|weeks|wk)',  # "2 weeks"
        r'(\d+)\s*(day|days|d)',  # "3 days"
        r'(acute|chronic|recent|history)',  # Qualitative timelines
        r'(since|for|from)',  # Temporal prepositions
    ]

    @classmethod
    def get_model_for_language(cls, language: str) -> ModelConfig:
        """Select appropriate model based on detected language"""
        if language == "en":
            return cls.BIOCLINICAL_BERT
        elif language in ["ta", "hi"]:
            return cls.MULTILINGUAL_BERT
        else:
            return cls.MULTILINGUAL_BERT  # Default fallback

    @classmethod
    def is_negated(cls, context_window: str, language: str = "en") -> bool:
        """Detect negation in context window"""
        triggers = cls.NEGATION_TRIGGERS.get(language, cls.NEGATION_TRIGGERS["en"])
        context_lower = context_window.lower()
        return any(trigger in context_lower for trigger in triggers)