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
                    enable_mkldnn=False, # Disable MKL-DNN to prevent onednn_instruction crash
                    # Tuning detection for better coverage of small clinical text
                    det_db_thresh=0.3,
                    det_db_box_thresh=0.5,
                    det_db_unclip_ratio=1.6
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
        result = self.ocr_engine.ocr(img_array)
        
        if not result or not result[0]:
            logger.warning("PaddleOCR found no text")
            return "", OCRConfidence(mean=0.0, min=0.0)
            
        lines = []
        confidences = []
        low_conf_words = []
        
        try:
            # v2/v3 Standard format: list of lines [[[box], [text, score]], ...]
            for line in result[0]:
                if not line or len(line) < 2:
                    continue
                
                # Extra safety for different Paddle versions
                if isinstance(line[1], (list, tuple)):
                    text, score = line[1]
                elif isinstance(line[1], dict):
                    text = line[1].get('text', '')
                    score = line[1].get('confidence', 0.0)
                else:
                    continue

                if not text or not text.strip():
                    continue
                    
                lines.append(text)
                conf_percent = float(score) * 100
                confidences.append(conf_percent)
                
                if conf_percent < 60:
                    low_conf_words.append(text)
                 
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
