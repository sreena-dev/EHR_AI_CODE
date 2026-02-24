import cv2
import numpy as np
from pathlib import Path
from typing import Any
import logging


from .document_types import DocumentType

logger = logging.getLogger(__name__)

class ImagePreprocessor:
    """
    Clinical document preprocessing with document-type awareness.
    """
    
    def __init__(
        self, 
        document_type: DocumentType = DocumentType.PRESCRIPTION,
        enable_tamil_optimizations: bool = False
    ):
        self.document_type = document_type
        self.enable_tamil_optimizations = enable_tamil_optimizations
        logger.debug(f"Preprocessor initialized: type={document_type.value}, tamil={enable_tamil_optimizations}")
    
    def preprocess(self, image_path: str | Path) -> tuple[np.ndarray, dict[str, Any]]:
        """Document-type-aware preprocessing pipeline"""
        image_path = Path(image_path)
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Load image
        img = cv2.imread(str(image_path))
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        metadata = {
            "original_size": img.shape[:2],
            "document_type": self.document_type.value,
            "applied_operations": [],
            "tamil_optimized": self.enable_tamil_optimizations
        }
        
        # Common preprocessing steps
        img, metadata = self._common_preprocessing(img, metadata)
        
        # Document-type-specific processing
        if self.document_type == DocumentType.LAB_REPORT:
            img, metadata = self._lab_report_preprocessing(img, metadata)
        else:  # Prescription or unknown
            img, metadata = self._prescription_preprocessing(img, metadata)
        
        return img, metadata
    
    def _common_preprocessing(self, img: np.ndarray, metadata: dict[str, Any]) -> tuple[np.ndarray, dict[str, Any]]:
        """Steps common to all document types"""
        # 1. Convert to grayscale
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        metadata["applied_operations"].append("grayscale")
        
        # 2. Tamil-specific upscaling
        if self.enable_tamil_optimizations:
            scale = 1.5
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            metadata["applied_operations"].append(f"upscale_{scale}x")
        
        # 3. Denoising
        if self.enable_tamil_optimizations or np.std(img) < 30:
            # Use lower h (7 instead of 10) to preserve thin strokes while removing noise
            img = cv2.fastNlMeansDenoising(img, h=7)
            metadata["applied_operations"].append("denoise_balanced")
        
        # 4. CLAHE contrast enhancement — dramatically improves OCR on scanned docs
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        img = clahe.apply(img)
        metadata["applied_operations"].append("clahe_enhanced")
        
        return img, metadata
    
    def _prescription_preprocessing(self, img: np.ndarray, metadata: dict[str, Any]) -> tuple[np.ndarray, dict[str, Any]]:
        """Prescription-optimized pipeline (text clarity focus)"""
        # Multi-scale adaptive thresholding to handle uneven lighting and thin pencil marks
        # Step 1: Gentle blur to reduce high-frequency noise before thresholding
        blurred = cv2.GaussianBlur(img, (3, 3), 0)
        
        # Step 2: Adaptive thresholding with optimized parameters for handwriting
        # block_size=35 and C=12 provides better separation for faint clinical notes
        thresh = cv2.adaptiveThreshold(
            blurred, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 
            35, 12
        )
        
        # Step 3: Morphological cleanup to remove pepper noise without eroding thin lines
        kernel = np.ones((1, 1), np.uint8)
        img = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        metadata["applied_operations"].append("adaptive_multi_scale_binarize")
        
        # Deskew (common for mobile-captured prescriptions)
        img = self._deskew(img)
        metadata["applied_operations"].append("deskew")
        
        # Border cleanup
        img = self._remove_borders(img)
        metadata["applied_operations"].append("border_cleanup")
        
        return img, metadata
    
    def _lab_report_preprocessing(self, img: np.ndarray, metadata: dict[str, Any]) -> tuple[np.ndarray, dict[str, Any]]:
        """Lab report-optimized pipeline (table preservation focus)"""
        # 1. Sharpen to enhance table lines
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        img = cv2.filter2D(img, -1, kernel)
        metadata["applied_operations"].append("sharpen")
        
        # 2. Otsu's thresholding (better for printed tables than adaptive)
        _, img = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        metadata["applied_operations"].append("otsu_threshold")
        
        # 3. Table line enhancement (critical for lab reports)
        img = self._enhance_table_lines(img)
        metadata["applied_operations"].append("table_line_enhancement")
        
        # 4. Mild deskew (preserve table structure)
        img = self._deskew(img, max_angle=2.0)  # Gentle deskew
        metadata["applied_operations"].append("gentle_deskew")
        
        return img, metadata
    
    def _deskew(self, img: np.ndarray, max_angle: float = 5.0) -> np.ndarray:
        """Correct document skew"""
        try:
            coords = np.column_stack(np.where(img < 200))
            if len(coords) < 10:
                return img
            
            angle = cv2.minAreaRect(coords.astype(np.float32))[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            if abs(angle) < 1.0 or abs(angle) > max_angle:
                return img
            
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                img, M, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
        except Exception as e:
            logger.warning(f"Deskew failed: {e}")
            return img
    
    def _remove_borders(self, img: np.ndarray) -> np.ndarray:
        """Remove dark borders from scanned documents"""
        try:
            contours, _ = cv2.findContours(
                255 - img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if not contours:
                return img
            
            # Use bounding rect of ALL contours combined, not just the largest
            all_points = np.concatenate(contours)
            x, y, w, h = cv2.boundingRect(all_points)
            margin = 10
            x = max(0, x - margin)
            y = max(0, y - margin)
            w = min(img.shape[1] - x, w + 2 * margin)
            h = min(img.shape[0] - y, h + 2 * margin)
            
            # Safety check: don't crop if it removes more than 50% of the image
            original_area = img.shape[0] * img.shape[1]
            cropped_area = w * h
            if cropped_area < original_area * 0.5:
                logger.warning(
                    f"Border removal would crop too aggressively "
                    f"({cropped_area}/{original_area} = {cropped_area/original_area:.1%}), skipping"
                )
                return img
            
            return img[y:y+h, x:x+w]
        except Exception as e:
            logger.warning(f"Border removal failed: {e}")
            return img
    
    def _enhance_table_lines(self, img: np.ndarray) -> np.ndarray:
        """Enhance horizontal/vertical lines in tables"""
        try:
            # Horizontal kernel for row lines
            horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
            horizontal_lines = cv2.morphologyEx(img, cv2.MORPH_OPEN, horizontal_kernel)
            
            # Vertical kernel for column lines
            vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 25))
            vertical_lines = cv2.morphologyEx(img, cv2.MORPH_OPEN, vertical_kernel)
            
            # Combine lines with original
            table_mask = cv2.bitwise_or(horizontal_lines, vertical_lines)
            img = cv2.bitwise_or(img, table_mask)
            
            return img
        except Exception as e:
            logger.warning(f"Table line enhancement failed: {e}")
            return img