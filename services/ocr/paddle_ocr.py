from typing import Any
import logging
from pathlib import Path
import cv2
import numpy as np
from .models import LabTestField, OCRConfidence
from .exceptions import OCRError, OCRErrorCode
from .medical_text_normalizer import MedicalTextNormalizer

logger = logging.getLogger(__name__)

# Module-level cache for PaddleOCR engines (expensive ~12s init, must persist across instances)
_PADDLE_ENGINE_CACHE: dict[str, Any] = {}
_PADDLE_TABLE_ENGINE_CACHE: dict[str, Any] = {}

class PaddleOCRService:
    """
    Wrapper for PaddleOCR engine with PPStructure for table recognition.
    Handles lazy loading of models to save resources.
    """
    
    def __init__(self, lang: str = 'en', use_gpu: bool = False):
        self.lang = lang
        self.use_gpu = use_gpu
        self._ocr_engine: Any = None
        self._table_engine: Any = None
        self._normalizer = MedicalTextNormalizer()
        
    @property
    def ocr_engine(self) -> Any:
        """Lazy load OCR engine with module-level caching"""
        if self._ocr_engine is None:
            # Check module-level cache first (persists across processor instances)
            if self.lang in _PADDLE_ENGINE_CACHE:
                self._ocr_engine = _PADDLE_ENGINE_CACHE[self.lang]
                logger.debug(f"PaddleOCR engine reused from cache (lang={self.lang})")
                return self._ocr_engine
            
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
                # Cache engine at module level
                _PADDLE_ENGINE_CACHE[self.lang] = self._ocr_engine
                logger.info(f"PaddleOCR engine initialized and cached (lang={self.lang}, device={device})")
            except ImportError:
                logger.error("PaddleOCR not installed. Run 'pip install paddlepaddle paddleocr'")
                raise OCRError("PaddleOCR dependency missing", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR: {e}")
                raise OCRError(f"PaddleOCR init failed: {e}", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
        return self._ocr_engine

    @property
    def table_engine(self) -> Any:
        """Lazy load PPStructure engine with module-level caching"""
        if self._table_engine is None:
            # Check module-level cache first
            cache_key = f"{self.lang}_table"
            if cache_key in _PADDLE_TABLE_ENGINE_CACHE:
                self._table_engine = _PADDLE_TABLE_ENGINE_CACHE[cache_key]
                logger.debug(f"PPStructure engine reused from cache (lang={self.lang})")
                return self._table_engine
            
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
                _PADDLE_TABLE_ENGINE_CACHE[cache_key] = self._table_engine
                logger.info("PPStructure engine initialized and cached")
            except Exception as e:
                logger.error(f"Failed to initialize PPStructure: {e}")
                raise OCRError(f"PPStructure init failed: {e}", error_code=OCRErrorCode.OCR_ENGINE_FAILURE)
        return self._table_engine

    def extract_text(self, image_input: str | Path | np.ndarray) -> tuple[str, OCRConfidence]:
        """
        Extract text from image using PaddleOCR.
        Handles both PaddleOCR 3.x (predict() -> OCRResult) and legacy (ocr() -> list) formats.
        Returns cleaned text and confidence metrics.
        """
        img_path, img_array = self._prepare_image(image_input)
        
        lines: list[str] = []
        confidences: list[float] = []
        low_conf_words: list[str] = []
        
        try:
            # PaddleOCR 3.x uses .predict() returning a generator of OCRResult objects
            if hasattr(self.ocr_engine, 'predict'):
                logger.info("Using PaddleOCR 3.x predict() API")
                # Force flush to ensure log appears even if predict() crashes
                for handler in logger.handlers + logging.getLogger().handlers:
                    handler.flush()
                logger.info(f"Calling predict() with input: {img_path} (type: {type(img_path).__name__})")
                for handler in logger.handlers + logging.getLogger().handlers:
                    handler.flush()
                for ocr_result in self.ocr_engine.predict(img_path):
                    texts: list[str] = []
                    scores_list: list[float] = []
                    
                    # PaddleOCR 3.x: text data is in .json['res'] dict
                    if hasattr(ocr_result, 'json') and isinstance(ocr_result.json, dict):
                        res_data = ocr_result.json.get('res', {})
                        texts = res_data.get('rec_texts', []) or []
                        raw_scores = res_data.get('rec_scores', []) or []
                        scores_list = [float(s) for s in raw_scores]
                        logger.info(f"PaddleOCR json path: {len(texts)} texts, {len(scores_list)} scores")
                    # Fallback: try top-level attributes (some versions)
                    elif hasattr(ocr_result, 'rec_texts') and hasattr(ocr_result, 'rec_scores'):
                        texts = list(ocr_result.rec_texts or [])
                        scores_list = [float(s) for s in (ocr_result.rec_scores or [])]
                        logger.info(f"PaddleOCR attr path: {len(texts)} texts, {len(scores_list)} scores")
                    else:
                        logger.warning(f"Unexpected OCRResult type: {type(ocr_result)}, attrs: {[a for a in dir(ocr_result) if not a.startswith('_')]}")
                    
                    for text, score in zip(texts, scores_list):
                        if not text or not str(text).strip():
                            continue
                        text_str = str(text).strip()
                        lines.append(text_str)
                        conf_percent = score * 100
                        confidences.append(conf_percent)
                        if conf_percent < 60:
                            low_conf_words.append(text_str)
                    break  # Only process first result (one image)
            else:
                # Legacy PaddleOCR 2.x: .ocr() returns list of lists [[[box], [text, score]], ...]
                logger.info("Using PaddleOCR legacy ocr() API")
                result = self.ocr_engine.ocr(img_array)
                
                if result and result[0]:
                    for line in result[0]:
                        if not line or len(line) < 2:
                            continue
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
            logger.error(f"Error during PaddleOCR extraction: {e}", exc_info=True)

        if not lines:
            logger.warning("PaddleOCR found no text")
            return "", OCRConfidence(mean=0.0, min=0.0)
        
        logger.info(f"PaddleOCR extracted {len(lines)} text lines")
        
        # Apply per-line medical normalization
        normalized_lines = [self._normalizer.normalize_line(line) for line in lines]
        full_text = "\n".join(normalized_lines)
        
        confidence = OCRConfidence(
            mean=float(np.mean(confidences)) if confidences else 0.0,
            min=float(np.min(confidences)) if confidences else 0.0,
            low_confidence_words=low_conf_words[:10]
        )
        
        return full_text, confidence

    def extract_lab_results(self, image_input: str | Path | np.ndarray) -> list[LabTestField]:
        """
        Extract structured lab results using PPStructure table recognition.
        """
        img_path, img_array = self._prepare_image(image_input)
        
        # Run structure analysis
        results = self.table_engine(img_array)
        
        lab_fields: list[LabTestField] = []
        
        for region in results:
            if region['type'] == 'table':
                # Region contains a table
                html_table = region.get('res', {}).get('html', '')
                
                if html_table:
                    table_fields = self._parse_table_html(html_table)
                    lab_fields.extend(table_fields)
                    
        # Fallback: If no structure found, return empty list (caller will use text fallback)
        if not lab_fields:
            logger.info("PPStructure found no tables, falling back to text")
            
        return lab_fields

    def _parse_table_html(self, html: str) -> list[LabTestField]:
        """
        Parse HTML table returned by PPStructure into LabTestFields.
        Uses simple heuristics to identify columns.
        """
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        
        rows = soup.find_all('tr')
        fields: list[LabTestField] = []
        
        # Try to identify headers
        headers: list[str] = []
        if rows:
            header_cells = rows[0].find_all(['th', 'td'])
            headers = [c.get_text(strip=True).lower() for c in header_cells]
            
        # Map columns to expected fields
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
                interpretation: Any = None
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

    def _prepare_image(self, image_input: str | Path | np.ndarray) -> tuple[str, np.ndarray]:
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
