# services/ocr/__init__.py
"""OCR service for prescription digitization"""

from .processor import PrescriptionOCRProcessor
from .models import OCRExtractionResult, PrescriptionField
from .exceptions import (
    OCRError,
    LowConfidenceError,
    ImageProcessingError,
    LanguagePackMissingError
)
try:
    from .paddle_ocr import PaddleOCRService
except ImportError:
    PaddleOCRService = None
import os

# if os.name == 'nt':
#     import pytesseract
#     pytesseract.pytesseract.tesseract_cmd = r'D:\Tesseract-OCR\tesseract.exe'

__all__ = [
    "PrescriptionOCRProcessor",
    "PaddleOCRService",
    "OCRExtractionResult",
    "PrescriptionField",
    "OCRError",
    "LowConfidenceError",
    "ImageProcessingError",
    "LanguagePackMissingError"
]