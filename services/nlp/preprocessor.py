import re
from typing import Tuple, List
import logging

logger = logging.getLogger(__name__)


class ClinicalTextPreprocessor:
    """
    Clinical text normalization for improved NLP extraction.
    Handles OCR artifacts, multilingual text, and clinical abbreviations.
    """

    def __init__(self, language: str = "en"):
        self.language = language
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile regex patterns for text cleaning"""
        # OCR artifact cleanup
        self.ocr_artifacts = [
            (r'\s+', ' '),  # Multiple spaces → single space
            (r'\n+', ' '),  # Newlines → space
            (r'[|]{2,}', ''),  # Remove pipe artifacts
            (r'(\w)\.(\w)', r'\1\2'),  # Remove periods in abbreviations (e.g., "t.a.b" → "tab")
        ]

        # Clinical abbreviation expansions (English)
        self.abbreviations_en = {
            r'\bbp\b': 'blood pressure',
            r'\bhr\b': 'heart rate',
            r'\brr\b': 'respiratory rate',
            r'\bt\b': 'temperature',
            r'\btab\b': 'tablet',
            r'\bcaps\b': 'capsule',
            r'\bsyr\b': 'syrup',
            r'\binj\b': 'injection',
            r'\bdx\b': 'diagnosis',
            r'\bpt\b': 'patient',
            r'\bod\b': 'once daily',
            r'\bbd\b': 'twice daily',
            r'\btds\b': 'three times daily',
            r'\bqds\b': 'four times daily',
        }

        # Tamil clinical abbreviations
        self.abbreviations_ta = {
            r'\bரத்தழுத்தம்\b': 'இரத்த அழுத்தம்',  # Blood pressure variants
            r'\bகாய்ச்சி\b': 'காய்ச்சல்',  # Fever variants
        }

    def preprocess(self, text: str) -> Tuple[str, List[str]]:
        """
        Full preprocessing pipeline.
        Returns: (cleaned_text, applied_operations)
        """
        operations = []

        # 1. Basic OCR artifact cleanup
        cleaned = text
        for pattern, replacement in self.ocr_artifacts:
            cleaned = re.sub(pattern, replacement, cleaned)
        operations.append("ocr_cleanup")

        # 2. Language-specific abbreviation expansion
        if self.language == "en":
            cleaned = self._expand_abbreviations(cleaned, self.abbreviations_en)
            operations.append("abbrev_expansion_en")
        elif self.language == "ta":
            cleaned = self._expand_abbreviations(cleaned, self.abbreviations_ta)
            operations.append("abbrev_expansion_ta")

        # 3. Trim and validate
        cleaned = cleaned.strip()
        if len(cleaned) < 10:  # Minimum length for clinical text
            logger.warning(f"Preprocessed text too short: '{cleaned[:50]}'")
            operations.append("WARNING_SHORT_TEXT")

        return cleaned, operations

    def _expand_abbreviations(self, text: str, abbrev_dict: dict) -> str:
        """Expand clinical abbreviations"""
        for pattern, expansion in abbrev_dict.items():
            text = re.sub(pattern, expansion, text, flags=re.IGNORECASE)
        return text

    def segment_sentences(self, text: str) -> List[str]:
        """Split text into sentences (language-aware)"""
        if self.language == "ta":
            # Tamil sentence segmentation (different punctuation)
            sentences = re.split(r'[\.!?।॥]+', text)
        else:
            # English/other languages
            sentences = re.split(r'[\.!?]+', text)

        return [s.strip() for s in sentences if s.strip()]

    def extract_context_window(self, text: str, start: int, end: int, window_size: int = 50) -> str:
        """
        Extract context window around an entity for negation/temporality analysis.
        """
        text_length = len(text)
        window_start = max(0, start - window_size)
        window_end = min(text_length, end + window_size)

        return text[window_start:window_end]