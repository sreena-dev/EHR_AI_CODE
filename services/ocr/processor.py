"""
Production OCR service with multi-document type support.
Handles prescriptions, lab reports, and mixed documents.
"""
import pytesseract
from pathlib import Path
from typing import Union, Optional, List, Dict, Any, cast, Literal
import asyncio
from datetime import datetime, timezone
import logging
import re
import os
import cv2
import numpy as np

from .models import (
    OCRExtractionResult, 
    PrescriptionField, 
    LabTestField,
    DocumentMetadata,
    OCRConfidence
)
from .preprocessor import ImagePreprocessor
from .config import LanguageMode, OCRConfig, PaddleOCRConfig
from .exceptions import (
    OCRError, 
    OCRErrorCode, 
    LowConfidenceError, 
    LanguagePackMissingError
)
from .document_types import DocumentTypeDetector, DocumentType
from .lab_report_parser import LabReportParser
from .medical_text_normalizer import MedicalTextNormalizer
from core.workflow import AIRAWorkflow, WorkflowState

try:
    from .paddle_ocr import PaddleOCRService
except ImportError:
    PaddleOCRService = None

logger = logging.getLogger(__name__)

class PrescriptionOCRProcessor:
    """
    Production OCR service with:
    - Document type detection (prescription vs lab report)
    - Type-specific preprocessing and extraction
    - Tamil/English bilingual support
    - Workflow integration with safety gates
    """
    
    # Class attributes for static analysis
    lab_parser: LabReportParser
    detector: DocumentTypeDetector
    normalizer: MedicalTextNormalizer
    paddle_service: Any | None # PaddleOCRService | None
    
    def __init__(
        self,
        language_mode: LanguageMode = LanguageMode.ENGLISH_TAMIL,
        document_type: DocumentType = DocumentType.PRESCRIPTION,
        tesseract_cmd: Optional[str] = None
    ):
        self.language_mode = language_mode
        self.document_type = document_type
        self.config = OCRConfig.get_config(language_mode)
        
        # Configure Tesseract path (Windows/Linux)
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        
        logger.debug(f"OCR Processor initialized: lang={language_mode.value}, type={document_type.value}")
        
        # Initialize parsers
        self.lab_parser = LabReportParser()
        self.detector = DocumentTypeDetector()
        self.normalizer = MedicalTextNormalizer()
        
        # Initialize PaddleOCR
        self.paddle_service = None
        if PaddleOCRService:
            try:
                self.paddle_service = PaddleOCRService(
                    lang=PaddleOCRConfig.get_lang(language_mode),
                    use_gpu=False # Default to CPU for now
                )
            except Exception as e:
                logger.warning(f"Failed to init PaddleOCR, falling back to Tesseract: {e}")

    async def process_document(
        self,
        image_path: str | Path,
        encounter_id: str,
        workflow: AIRAWorkflow | None = None,
        triggered_by: str = "nurse_station",
        auto_detect_type: bool = True
    ) -> OCRExtractionResult:
        """
        End-to-end OCR processing with document type awareness.
        Uses PaddleOCR as primary engine, falls back to Tesseract.
        """
        start_time = datetime.now(timezone.utc)
        image_path = Path(image_path)
        
        try:
            # 1. Preprocess image with document-type-aware pipeline
            preprocessor = ImagePreprocessor(
                document_type=self.document_type if not auto_detect_type else DocumentType.UNKNOWN,
                enable_tamil_optimizations=OCRConfig.should_apply_tamil_preprocessing(self.language_mode)
            )
            preprocessed_img, prep_metadata = preprocessor.preprocess(image_path)
            logger.info(f"Preprocessed: {prep_metadata['original_size']} -> {preprocessed_img.shape[:2]}, ops={prep_metadata['applied_operations']}")
            
            raw_text: str = ""
            confidence: OCRConfidence = OCRConfidence(mean=0.0, min=0.0, low_confidence_words=[])
            structured_fields: list[Any] = []
            ocr_source: str = "tesseract"
            
            # 2. Try PaddleOCR First (run in thread to avoid blocking event loop)
            if self.paddle_service:
                try:
                    logger.info("Attempting PaddleOCR extraction...")
                    raw_text, confidence = await asyncio.to_thread(
                        self.paddle_service.extract_text, str(image_path)
                    )
                    ocr_source = "paddle"
                    logger.info(f"PaddleOCR completed: {len(raw_text)} chars, conf={confidence.mean:.1f}%")
                except Exception as e:
                    logger.error(f"PaddleOCR failed: {e}", exc_info=True)
                    ocr_source = "tesseract_fallback"
            
            # 3. Fallback to Tesseract if Paddle failed or not available
            if not raw_text or ocr_source == "tesseract_fallback":
                logger.info("Using Tesseract OCR (Primary pass: English)...")
                
                # FIRST PASS: Strictly English
                base_config = self.config["config_str"].replace("-l eng+tam", "-l eng").replace("-l tam", "-l eng")
                ocr_data = cast(dict[str, Any], pytesseract.image_to_data(
                    preprocessed_img,
                    lang="eng",
                    config=base_config,
                    output_type=pytesseract.Output.DICT
                ))
                raw_text, confidence = self._build_text_and_confidence(ocr_data)
                
                # SECOND PASS: If English confidence is terrible, try bilingual mode
                if confidence.mean < 40.0 and "tam" in self.language_mode.value:
                    logger.info("Low English confidence. Retrying Tesseract in Bilingual mode...")
                    ocr_data_fallback = cast(Dict[str, Any], pytesseract.image_to_data(
                        preprocessed_img,
                        lang=self.language_mode.value,
                        config=self.config["config_str"],
                        output_type=pytesseract.Output.DICT
                    ))
                    raw_text_fallback, confidence_fallback = self._build_text_and_confidence(ocr_data_fallback)
                    
                    # Keep the bilingual result only if it's actually an improvement
                    if confidence_fallback.mean > confidence.mean:
                        raw_text = raw_text_fallback
                        confidence = confidence_fallback

                ocr_source = "tesseract"

            # 4. Normalize text BEFORE type detection for better classification
            normalized_text, normalization_meta = self.normalizer.normalize(raw_text)
            logger.info(f"Normalization: {normalization_meta['corrections_made']} corrections applied")

            # 5. Document type detection (on normalized text for accuracy)
            detected_type, type_confidence = self.detector.detect_from_text(normalized_text)
            final_type = detected_type if auto_detect_type else self.document_type
            logger.info(f"Document type: {final_type.value} (confidence={type_confidence:.2f})")

            # 6. Type-specific field extraction
            document_metadata = None
            if final_type == DocumentType.LAB_REPORT:
                if not structured_fields: # Only parse text if PPStructure didn't return fields
                    structured_fields = self._extract_lab_report_fields(normalized_text)
                document_metadata = self._build_lab_metadata(normalized_text)
            else:  # Prescription or unknown
                structured_fields = self._extract_prescription_fields(normalized_text)
                document_metadata = self._build_prescription_metadata(normalized_text)
            
            # 6.5 For lab reports, also try PPStructure table extraction
            if final_type == DocumentType.LAB_REPORT and self.paddle_service and not structured_fields:
                try:
                    logger.info("Attempting PPStructure table extraction...")
                    pp_fields = self.paddle_service.extract_lab_results(str(image_path))
                    if pp_fields:
                        structured_fields = pp_fields
                        logger.info(f"PPStructure extracted {len(pp_fields)} lab results")
                except Exception as e:
                    logger.warning(f"PPStructure table extraction failed: {e}")
            
            # 6. Generate safety flags (document-type-aware)
            safety_flags = self._generate_safety_flags(
                confidence=confidence,
                raw_text=raw_text,
                document_type=final_type,
                structured_fields=structured_fields
            )
            
            if ocr_source == "paddle":
                safety_flags.append("OCR_ENGINE_PADDLE")
            
            if normalization_meta["corrections_made"] > 0:
                safety_flags.append("OCR_TEXT_NORMALIZED")
            
            # 8. Construct result
            result = OCRExtractionResult(
                encounter_id=encounter_id,
                original_filename=image_path.name,
                language_detected=self._detect_language(raw_text),
                raw_text=raw_text,
                normalized_text=normalized_text if normalization_meta["corrections_made"] > 0 else None,
                structured_fields=structured_fields,
                confidence=confidence,
                processing_time_ms=int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000),
                safety_flags=safety_flags,
                document_type=final_type.value,
                document_metadata=document_metadata,
                type_detection_confidence=locals().get('type_confidence', 0.0)
            )
            
            # 8. Workflow integration
            if workflow:
                workflow.set_data("ocr_text", raw_text)
                workflow.set_data("ocr_structured_fields", [f.model_dump() for f in structured_fields])
                workflow.set_data("ocr_document_type", final_type.value)
                workflow.set_data("ocr_source", ocr_source)
                workflow.set_data("ocr_confidence", confidence.model_dump())
                workflow.set_data("ocr_safety_flags", safety_flags)
                
                # If re-processing same encounter, reset workflow first
                if workflow.current_state == WorkflowState.OCR_COMPLETE:
                    await workflow.advance_to(
                        WorkflowState.REGISTRATION,
                        triggered_by=triggered_by
                    )
                
                # Advance to OCR_COMPLETE
                await workflow.advance_to(
                    WorkflowState.OCR_COMPLETE,
                    triggered_by=triggered_by,
                    safety_flags=safety_flags
                )
                
                logger.info(f"Workflow -> OCR_COMPLETE | encounter={encounter_id}")
            
            # 9. Safety gate: Flag low-confidence critical documents
            if self._requires_immediate_review(result):
                err = LowConfidenceError(
                    f"Document requires immediate review (type: {final_type.value}, confidence: {confidence.mean:.1f}%)",
                    confidence=confidence.mean,
                    language=self._detect_language(raw_text),
                    encounter_id=encounter_id
                )
                err.result = result  # Attach full result for route handler
                raise err
            
            return result
            
        except LowConfidenceError:
            # Let LowConfidenceError propagate to the route handler
            raise
        except Exception as e:
            logger.error(f"OCR failed: {str(e)}")
            raise OCRError(
                f"OCR processing failed: {str(e)}", 
                error_code=OCRErrorCode.OCR_ENGINE_FAILURE
            ) from e

    async def process_prescription(
        self,
        image_path: Union[str, Path],
        encounter_id: str,
        workflow: Optional[AIRAWorkflow] = None,
        triggered_by: str = "nurse_station"
    ) -> OCRExtractionResult:
        """Alias for process_document to maintain backward compatibility"""
        return await self.process_document(
            image_path=image_path,
            encounter_id=encounter_id,
            workflow=workflow,
            triggered_by=triggered_by,
            auto_detect_type=False  # Force prescription mode
        )
    
    def _build_text_and_confidence(self, ocr_data: dict) -> tuple[str, OCRConfidence]:
        """Construct clean text and confidence metrics from Tesseract output"""
        words = []
        confidences = []
        low_conf_words = []
        
        for i, word in enumerate(ocr_data['text']):
            conf = int(ocr_data['conf'][i])
            # Use conf >= 0 instead of conf > 0:
            # Tesseract returns -1 for non-text entries (page/block/line separators)
            # conf=0 can be valid text that Tesseract is uncertain about
            if conf >= 0 and word.strip():
                words.append(word)
                confidences.append(max(conf, 1))  # Floor at 1 for stats
                if conf < 60:
                    low_conf_words.append(word)
        
        raw_text = ' '.join(words)
        raw_text = re.sub(r'\s+', ' ', raw_text).strip()
        
        logger.info(f"OCR extracted {len(words)} words ({len(raw_text)} chars), avg confidence={sum(confidences)/len(confidences) if confidences else 0:.0f}%")
        
        if not confidences:
            raise OCRError("No text detected in image", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
        
        return raw_text, OCRConfidence(
            mean=float(sum(confidences) / len(confidences)),
            min=float(min(confidences)),
            low_confidence_words=low_conf_words[:10]
        )
    
    def _extract_prescription_fields(self, text: str) -> List[PrescriptionField]:
        """
        Sophisticated keyword-first prescription field extraction.
        Scans for medications from the dictionary and extracts context (dosage/freq).
        """
        fields = []
        lines = text.split('\n')
        
        # Get common medications from normalizer (lowercase)
        from .medical_text_normalizer import get_normalizer
        normalizer = get_normalizer()
        med_dict = {k.lower(): v for k, v in normalizer.MEDICAL_TERMS.items() 
                    if v not in ["Tablet", "Capsule", "Syrup", "Injection", "Ointment", "Drops", "Dosage", "Frequency", "Duration", "Diagnosis", "Prescription"]}

        # Common clinical patterns
        dosage_pattern = r'(\d+\.?\d*\s*(?:mg|mcg|ml|g|tab|cap|pill|syr|tsp|unit|IU)\b)'
        freq_pattern = r'\b(OD|BD|TDS|TID|QID|STAT|SOS|HS|AC|PC|AT NIGHT|DAILY|TWICE DAILY|THRICE DAILY)\b'
        duration_pattern = r'\b(\d+\s*(?:day|week|month|year)s?)\b'

        for line in lines:
            line_lower = line.lower()
            found_med = None
            
            # Step 1: Scan for known medication names
            # Sort by length descending to catch multi-word meds first
            sorted_meds = sorted(med_dict.keys(), key=len, reverse=True)
            for med_key in sorted_meds:
                if f" {med_key} " in f" {line_lower} " or line_lower.startswith(f"{med_key} "):
                    found_med = med_dict[med_key]
                    break
            
            if found_med:
                # Step 2: Extract dosage and frequency from the SAME line
                dosage_match = re.search(dosage_pattern, line, re.IGNORECASE)
                freq_match = re.search(freq_pattern, line, re.IGNORECASE)
                
                # If no standard frequency found, check for numeric patterns like 1-0-1
                freq = freq_match.group(0) if freq_match else ""
                if not freq:
                    numeric_freq_match = re.search(r'\b([01]-[01]-[01])\b', line)
                    if numeric_freq_match:
                        # Map to standard if possible
                        nfreq = numeric_freq_match.group(1)
                        if nfreq == "1-0-1": freq = "BD"
                        elif nfreq == "1-1-1": freq = "TDS"
                        elif nfreq == "1-0-0": freq = "OD (Morn)"
                        elif nfreq == "0-0-1": freq = "OD (Night)"
                        else: freq = nfreq

                fields.append(PrescriptionField(
                    field_type="MEDICATION",
                    text=found_med,
                    confidence=95.0,
                    dosage=dosage_match.group(1) if dosage_match else None,
                    frequency=freq if freq else None
                ))
            
            # Step 3: Scan for Diagnosis/Symptoms (Secondary focus)
            diag_match = re.search(r'(?:diagnosis|dx|provisional diagnosis|c/o|complaint)[:\s]+([A-Za-z0-9\s,]+)', line, re.IGNORECASE)
            if diag_match:
                content = diag_match.group(1).strip()
                if content:
                    fields.append(PrescriptionField(
                        field_type="DIAGNOSIS" if "diag" in line_lower or "dx" in line_lower else "SYMPTOM",
                        text=content,
                        confidence=85.0
                    ))

        return fields
    
    def _extract_lab_report_fields(self, text: str) -> List[LabTestField]:
        """Extract structured lab test results"""
        results = self.lab_parser.parse_lab_report(text)
        fields = []
        
        for result in results:
            fields.append(LabTestField(
                test_name=result.test_name,
                result_value=result.result_value,
                unit=result.unit,
                reference_range=result.reference_range,
                interpretation=cast(Optional[Literal["High", "Low", "Normal", "Abnormal"]], result.interpretation),
                confidence=result.confidence
            ))
        
        return fields
    
    def _build_prescription_metadata(self, text: str) -> DocumentMetadata:
        """Extract prescription-specific metadata"""
        metadata = {}
        
        # Extract dates
        date_match = re.search(r'(?:date|dt)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text, re.IGNORECASE)
        if date_match:
            metadata["date"] = date_match.group(1)
        
        # Extract patient name (simple heuristic)
        name_match = re.search(r'(?:patient|name)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)', text, re.IGNORECASE)
        if name_match:
            metadata["patient_name"] = name_match.group(1)
        
        return DocumentMetadata(metadata=metadata)
    
    def _build_lab_metadata(self, text: str) -> DocumentMetadata:
        """Extract lab report-specific metadata"""
        metadata = {}
        
        # Extract report date
        date_match = re.search(r'(?:report\s+date|date\s+of\s+report)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text, re.IGNORECASE)
        if date_match:
            metadata["report_date"] = date_match.group(1)
        
        # Extract patient details
        patient_match = re.search(r'(?:patient\s+name|name)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)', text, re.IGNORECASE)
        if patient_match:
            metadata["patient_name"] = patient_match.group(1)
        
        # Extract lab name
        lab_match = re.search(r'(?:laboratory|lab\s+name)[:\s]+([A-Za-z\s]+)', text, re.IGNORECASE)
        if lab_match:
            metadata["laboratory"] = lab_match.group(1).strip()
        
        # Get summary from parser
        results = self.lab_parser.parse_lab_report(text)
        summary = self.lab_parser.generate_summary(results)
        metadata.update(summary)
        
        return DocumentMetadata(metadata=metadata)
    
    def _detect_language(self, text: str) -> Literal["en", "ta", "hi", "mixed"]:
        """Robust language detection with noise thresholds"""
        tamil_chars = len(re.findall(r'[\u0B80-\u0BFF]', text))
        english_chars = len(re.findall(r'[A-Za-z]', text))
        total_chars = max(len(text.strip()), 1) # Prevent division by zero
        
        # Require minimum number of characters AND at least 10% density to avoid OCR noise
        if tamil_chars > 5 and (tamil_chars / total_chars) > 0.10:
            if tamil_chars > english_chars * 1.5:
                return "ta"
            return "mixed"
            
        return "en" # Default to English if Tamil threshold isn't met
    
    def _generate_safety_flags(
        self,
        confidence: OCRConfidence,
        raw_text: str,
        document_type: DocumentType,
        structured_fields: list[Any]
    ) -> List[str]:
        """Generate clinical safety flags based on document type and quality"""
        flags = []
        
        # Global low confidence flag
        if confidence.mean < 60.0:
            flags.append("LOW_OCR_CONFIDENCE")
        
        # Document-type-specific flags
        if document_type == DocumentType.PRESCRIPTION:
            # Check for critical missing fields
            field_types = [f.field_type for f in structured_fields]
            if "MEDICATION" not in field_types and len(raw_text) > 50:
                flags.append("MISSING_MEDICATION_FIELD")
            if "DIAGNOSIS" not in field_types and "SYMPTOM" not in field_types:
                flags.append("MISSING_DIAGNOSIS_FIELD")
        
        elif document_type == DocumentType.LAB_REPORT:
            # Lab report specific checks
            if len(structured_fields) == 0 and len(raw_text) > 100:
                flags.append("NO_LAB_TESTS_DETECTED")
            if confidence.mean < 70.0:  # Higher bar for lab reports (critical values)
                flags.append("LOW_CONFIDENCE_LAB_REPORT")
        
        # Tamil-specific flags
        if self._detect_language(raw_text) == "ta" and confidence.mean < 70.0:
            flags.append("LOW_CONFIDENCE_TAMIL_OCR")
        
        return flags
    
    def _requires_immediate_review(self, result: OCRExtractionResult) -> bool:
        """Determine if document requires immediate human review"""
        # FIX: Only review Tamil documents if confidence is also low, not automatically
        if result.language_detected in ["ta", "mixed"] and result.confidence.mean < 65.0:
            return True
        
        # Review low-confidence critical documents
        if result.confidence.mean < 50.0:
            return True
        
        # Review lab reports with abnormal results
        if result.document_type == "lab_report" and result.document_metadata:
            metadata = result.document_metadata.metadata
            if metadata.get("abnormal_results", 0) > 0:
                return True
        
        return False
    
    async def health_check(self) -> bool:
        """Verify Tesseract installation and language packs"""
        try:
            test_img = np.ones((100, 300), dtype=np.uint8) * 255
            cv2.putText(test_img, "TEST", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, 0, 2)
            pytesseract.image_to_string(test_img, lang="eng")
            return True
        except Exception as e:
            logger.error(f"OCR health check failed: {e}")
            return False