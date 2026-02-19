from typing import Dict, List
from enum import Enum


class LanguageMode(Enum):
    ENGLISH = "eng"
    TAMIL = "tam"  # Critical: Tesseract requires 'tam' not 'ta'
    HINDI = "hin"
    ENGLISH_TAMIL = "eng+tam"  # Bilingual documents (common in South India)
    ENGLISH_HINDI = "eng+hin"


class OCRConfig:
    """
    Production Tesseract configs optimized for clinical documents.
    Tamil-specific tuning applied where needed.
    """

    # Language-specific configs
    # NOTE: Do NOT include -l flag in config_str — pytesseract passes it
    # separately via the lang= parameter. Including it here causes duplicates.
    LANGUAGE_CONFIGS: Dict[str, Dict] = {
        "eng": {
            "oem": 1,  # LSTM only
            "psm": 6,  # Assume single uniform block of text
            "config_str": r"--oem 1 --psm 6 -c preserve_interword_spaces=1"
        },
        "tam": {
            "oem": 1,
            "psm": 6,
            "config_str": r"--oem 1 --psm 6 -c preserve_interword_spaces=1"
                          # Tamil-specific: Enable character merging for conjuncts
                          + r" -c tessedit_char_blacklist=|[]{}()<>;:"
        },
        "eng+tam": {
            "oem": 1,
            "psm": 6,
            "config_str": r"--oem 1 --psm 6 -c preserve_interword_spaces=1"
        }
    }

    # Tamil-specific preprocessing recommendations
    TAMIL_PREPROCESSING = {
        "denoise": True,  # Critical for Tamil script clarity
        "binarize": True,  # Improves character separation
        "deskew": True,  # Tamil documents often skewed in clinics
        "scale_factor": 1.5  # Upscale to 150% for better character recognition
    }

    @classmethod
    def get_config(cls, language_mode: LanguageMode) -> Dict:
        """Get optimized Tesseract config for language"""
        key = language_mode.value
        # Look up full key first (e.g. "eng+tam"), then fall back to base language
        if key in cls.LANGUAGE_CONFIGS:
            return cls.LANGUAGE_CONFIGS[key].copy()
        
        base = cls.LANGUAGE_CONFIGS.get(key.split('+')[0], cls.LANGUAGE_CONFIGS["eng"]).copy()

        # For bilingual modes not explicitly defined, add the -l flag
        if '+' in key:
            if f"-l " not in base["config_str"]:
                base["config_str"] += f" -l {key}"
            else:
                base["config_str"] = base["config_str"].replace(
                    f"-l {key.split('+')[0]}",
                    f"-l {key}"
                )

        return base

    @classmethod
    def should_apply_tamil_preprocessing(cls, language_mode: LanguageMode) -> bool:
        """Auto-enable Tamil-optimized preprocessing"""
        return "tam" in language_mode.value


class PaddleOCRConfig:
    """
    Configuration for PaddleOCR engine.
    """
    # Sensitivity threshold for text detection
    DETECTION_THRESHOLD = 0.6
    
    # Minimum confidence to accept a word
    RECOGNITION_THRESHOLD = 0.6
    
    # Table structure recognition threshold
    TABLE_STRUCTURE_THRESHOLD = 0.8
    
    # Language mapping
    LANG_MAPPING = {
        LanguageMode.ENGLISH: 'en',
        LanguageMode.TAMIL: 'ta',  # Paddle uses 'ta' not 'tam'
        LanguageMode.HINDI: 'hi',
        LanguageMode.ENGLISH_TAMIL: 'ta',  # Use Tamil model (supports English too)
        LanguageMode.ENGLISH_HINDI: 'hi'
    }
    
    @classmethod
    def get_lang(cls, language_mode: LanguageMode) -> str:
        return cls.LANG_MAPPING.get(language_mode, 'en')
