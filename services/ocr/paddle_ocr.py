from typing import List, Dict, Any, Optional, Tuple, Union
import logging
import os
from pathlib import Path
import cv2
import numpy as np
from .models import LabTestField, OCRConfidence
from .exceptions import OCRError, OCRErrorCode
from .medical_text_normalizer import MedicalTextNormalizer

logger = logging.getLogger(__name__)

class PaddleOCRService:
    """
    Wrapper for PaddleOCR engine with PPStructure for table recognition.
    Handles lazy loading of models to save resources.
    """
    
    def __init__(self, lang: str = 'en', use_gpu: bool = False):
        self.lang = lang
        self.use_gpu = use_gpu
        self._ocr_engine = None
        self._table_engine = None
        self._normalizer = MedicalTextNormalizer()
        
    @property
    def ocr_engine(self):
        """Lazy load OCR engine"""
        if self._ocr_engine is None:
            try:
                try:
                    from paddleocr import PaddleOCR
                except ImportError:
                    # Fallback to direct import if top-level export fails
                    from paddleocr._pipelines.ocr import PaddleOCR
                
                # API changes in PaddleOCR 3.x:
                # - use_gpu -> device='gpu'/'cpu'
                # - use_angle_cls -> use_textline_orientation
                # - show_log removed (controlled globally)
                device = 'gpu' if self.use_gpu else 'cpu'
                
                self._ocr_engine = PaddleOCR(
                    use_textline_orientation=True, 
                    lang=self.lang, 
                    device=device,
                    enable_mkldnn=False # Disable MKL-DNN to prevent onednn_instruction crash
                )
                logger.info(f"PaddleOCR engine initialized (lang={self.lang}, device={device})")
            except ImportError:
                logger.error("PaddleOCR not installed. Run 'pip install paddlepaddle paddleocr'")
                raise OCRError("PaddleOCR dependency missing", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR: {e}")
                raise OCRError(f"PaddleOCR init failed: {e}", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
        return self._ocr_engine

    @property
    def table_engine(self):
        """Lazy load PPStructure engine for table recognition"""
        if self._table_engine is None:
            try:
                # PaddleOCR 3.x uses PPStructureV3
                try:
                    from paddleocr import PPStructureV3 as PPStructure
                except ImportError:
                    try:
                        # Fallback to direct import
                        from paddleocr._pipelines.pp_structurev3 import PPStructureV3 as PPStructure
                    except ImportError:
                        # Fallback for older versions
                        from paddleocr import PPStructure

                device = 'gpu' if self.use_gpu else 'cpu'
                
                # PPStructureV3 init
                self._table_engine = PPStructure(
                    device=device,
                    lang=self.lang,
                    use_table_recognition=True,
                    use_doc_orientation_classify=True,
                    enable_mkldnn=False # Disable MKL-DNN here too
                )
                logger.info("PPStructure engine initialized")
            except Exception as e:
                logger.error(f"Failed to initialize PPStructure: {e}")
                raise OCRError(f"PPStructure init failed: {e}", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
        return self._table_engine

    def extract_text(self, image_input: Union[str, Path, np.ndarray]) -> Tuple[str, OCRConfidence]:
        """
        Extract text from image using PaddleOCR.
        Returns cleaned text and confidence metrics.
        """
        img_path, img_array = self._prepare_image(image_input)
        
        # Run OCR
        # cls=True is removed as it's not supported in v3 predict(), 
        # use_textline_orientation=True in __init__ handles it.
        result = self.ocr_engine.ocr(img_array)
        
        # Debug logging for v3 structure
        logger.info(f"PaddleOCR raw result type: {type(result)}")
        if result:
            logger.info(f"First item type: {type(result[0])}")
            logger.info(f"First item preview: {str(result[0])[:200]}")
            
        if not result:
            logger.warning("PaddleOCR found no text")
            return "", OCRConfidence(mean=0.0, min=0.0)
            
        # Parse result based on structure
        # v3 result is likely a list of dicts or objects
        # usage: res['dt_polys'], res['rec_text'], res['rec_score']
        # whereas v2 was list of lines [[box, (text, score)], ...]
        
        lines = []
        confidences = []
        low_conf_words = []
        
        # Helper to parse v3 dict result
        if isinstance(result[0], dict):
             # Handle list of dicts (one per text box? or one per image?)
             # Usually paddleocr v3 pipeline returns list of results (one per image).
             # If we passed single image, result[0] is the result for that image.
             # Inside result[0], we look for text lines.
             # result[0] might be a dict with 'dt_polys', 'rec_text', 'rec_score' keys as LISTS?
             # Or result[0] is just one text line?
             # Let's assume result is [ {rec_text:..., rec_score:...}, ... ] ?
             # Actually PaddleX pipeline output for OCR is usually a global dict or list of dicts.
             pass
        
        # For now, let's try to adapt to whatever it is, 
        # but safely return empty if we can't parse, so we can see the log.
        try:
            # Try v2 format first (list of lists)
            if isinstance(result[0], list):
                 for line in result[0]:
                    text, score = line[1]
                    if not text.strip():
                        continue
                        
                    lines.append(text)
                    conf_percent = score * 100
                    confidences.append(conf_percent)
                    
                    if conf_percent < 60:
                        low_conf_words.append(text)
            # Try v3 format (list of dicts or object with attributes)
            elif isinstance(result[0], dict):
                # If it's a list of dicts, iterate
                for item in result:
                    if 'rec_text' in item and 'rec_score' in item:
                        text = item['rec_text']
                        score = item['rec_score']
                        # Handle if score is already float or needs parsing
                        if text:
                            lines.append(text)
                            confidences.append(float(score) * 100 if score else 0)
                            if score and float(score) < 0.6:
                                low_conf_words.append(text)
                    elif 'text' in item and 'confidence' in item: # Alternative key
                        text = item['text']
                        score = item['confidence']
                        lines.append(text)
                        confidences.append(float(score) * 100)
            # If it's a customized object, we might need __dict__ or attributes
            else:
                 logger.warning(f"Unknown PaddleOCR result format: {type(result[0])}")
                 
        except Exception as e:
            logger.error(f"Error parsing PaddleOCR result: {e}")
            
        full_text = "\n".join(lines)
        
        # Apply per-line medical normalization
        normalized_lines = [self._normalizer.normalize_line(line) for line in lines]
        full_text = "\n".join(normalized_lines)
        
        confidence = OCRConfidence(
            mean=float(np.mean(confidences)) if confidences else 0.0,
            min=float(np.min(confidences)) if confidences else 0.0,
            low_confidence_words=low_conf_words[:10]
        )
        
        return full_text, confidence

    def extract_lab_results(self, image_input: Union[str, Path, np.ndarray]) -> List[LabTestField]:
        """
        Extract structured lab results using PPStructure table recognition.
        """
        # from paddleocr import save_structure_res # Unused and causes import error
        
        img_path, img_array = self._prepare_image(image_input)
        
        # Run structure analysis
        results = self.table_engine(img_array)
        
        lab_fields = []
        
        for region in results:
            if region['type'] == 'table':
                # Region contains a table
                # 'res' key contains the html structure or cell list
                # For direct usage, we can look at the HTML or the cell boxes
                # PPStructure returns 'html' representation of the table
                html_table = region.get('res', {}).get('html', '')
                
                # We can also parse the raw text cells if available, but HTML is easier
                # to parse with libraries like BeautifulSoup or pandas
                if html_table:
                    table_fields = self._parse_table_html(html_table)
                    lab_fields.extend(table_fields)
                    
        # Fallback: If no structure found, return empty list (caller will use text fallback)
        if not lab_fields:
            logger.info("PPStructure found no tables, falling back to text")
            
        return lab_fields

    def _parse_table_html(self, html: str) -> List[LabTestField]:
        """
        Parse HTML table returned by PPStructure into LabTestFields.
        Uses simple heuristics to identify columns.
        """
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        rows = soup.find_all('tr')
        fields = []
        
        # Try to identify headers
        headers = []
        if rows:
            header_cells = rows[0].find_all(['th', 'td'])
            headers = [c.get_text(strip=True).lower() for c in header_cells]
            
        # Map columns to expected fields
        # Common headers: Test Name, Result, Unit, Reference Range
        col_map = {
            'name': -1, 'test': -1, 'investigation': -1,
            'result': -1, 'value': -1, 'observation': -1,
            'unit': -1, 
            'ref': -1, 'range': -1, 'interval': -1
        }
        
        for i, h in enumerate(headers):
            for key in col_map:
                if key in h and col_map[key] == -1:
                    col_map[key] = i
                    
        # Simplified mapping logic
        name_idx = next((v for k, v in col_map.items() if k in ['name', 'test', 'investigation'] and v != -1), 0) # Default to 0
        val_idx = next((v for k, v in col_map.items() if k in ['result', 'value', 'observation'] and v != -1), 1) # Default to 1
        unit_idx = next((v for k, v in col_map.items() if k in ['unit'] and v != -1), -1)
        ref_idx = next((v for k, v in col_map.items() if k in ['ref', 'range', 'interval'] and v != -1), -1)
        
        # Process data rows
        start_row = 1 if max(col_map.values()) > -1 else 0
        
        for row in rows[start_row:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2: 
                continue
                
            try:
                test_name = cells[name_idx].get_text(strip=True) if name_idx < len(cells) else ""
                val_text = cells[val_idx].get_text(strip=True) if val_idx < len(cells) else ""
                
                # Clean up value (sometimes includes unit)
                if not test_name or not val_text:
                    continue
                    
                unit = cells[unit_idx].get_text(strip=True) if unit_idx != -1 and unit_idx < len(cells) else None
                ref_range = cells[ref_idx].get_text(strip=True) if ref_idx != -1 and ref_idx < len(cells) else None
                
                # Basic interpretation
                interpretation = None
                if 'high' in val_text.lower() or '↑' in val_text:
                    interpretation = "High"
                    val_text = val_text.replace('↑', '').strip()
                elif 'low' in val_text.lower() or '↓' in val_text:
                    interpretation = "Low"
                    val_text = val_text.replace('↓', '').strip()
                    
                fields.append(LabTestField(
                    test_name=test_name,
                    result_value=val_text,
                    unit=unit,
                    reference_range=ref_range,
                    interpretation=interpretation,
                    confidence=0.9  # PPStructure is usually high confidence
                ))
            except Exception as e:
                logger.warning(f"Failed to parse table row: {e}")
                continue
                
        return fields

    def _prepare_image(self, image_input: Union[str, Path, np.ndarray]) -> Tuple[str, np.ndarray]:
        """Convert input to safe path and numpy array"""
        if isinstance(image_input, (str, Path)):
            path = str(image_input)
            img_array = cv2.imread(path)
            if img_array is None:
                raise FileNotFoundError(f"Could not read image: {path}")
            return path, img_array
        elif isinstance(image_input, np.ndarray):
            return "memory_image.jpg", image_input
        else:
            raise TypeError("Unsupported image input type")
