"""Test OCR processor with Tamil/English support"""
import pytest
import pytesseract
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import cv2
import numpy as np

from services.ocr.processor import PrescriptionOCRProcessor
from services.ocr.config import LanguageMode
from services.ocr.exceptions import LowConfidenceError, LanguagePackMissingError
from core.workflow import AIRAWorkflow, WorkflowState

@pytest.fixture
def mock_pytesseract(mocker):
    """Mock pytesseract to avoid runtime dependency"""
    mock = mocker.patch("services.ocr.processor.pytesseract")
    mock.pytesseract.tesseract_cmd = "tesseract"
    
    # Mock image_to_data response
    mock.image_to_data.return_value = {
        'text': ['Patient:', 'John', 'Doe', 'Age:', '30', 'Diagnosis:', 'Fever'],
        'conf': [90, 85, 88, 92, 95, 89, 65],  # ints
        'top': [0, 0, 0, 0, 0, 0, 0],
        'left': [0, 0, 0, 0, 0, 0, 0],
        'width': [0, 0, 0, 0, 0, 0, 0],
        'height': [0, 0, 0, 0, 0, 0, 0]
    }
    mock.get_languages.return_value = ['eng', 'tam']
    mock.Output.DICT = "dict"
    return mock

class TestOCRTamilSupport:
    
    @pytest.fixture
    def english_image(self):
        """Generate synthetic English prescription image"""
        img = Image.new('RGB', (400, 200), color='white')
        d = ImageDraw.Draw(img)
        
        try:
            # Try to use a real font
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        except:
            font = ImageFont.load_default()
        
        text = "Patient: John Doe\nAge: 45\nDiagnosis: Diabetes\nMedication: Metformin 500mg BD"
        d.text((10, 10), text, fill=(0, 0, 0), font=font)
        
        # Fix for Windows: Close file before yielding path
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.close()  # Must close to release lock on Windows
            img.save(f.name)
            yield Path(f.name)
        
        # Cleanup
        try:
            Path(f.name).unlink()
        except:
            pass
    

    
    @pytest.fixture
    def tamil_image(self):
        """
        WARNING: Synthetic Tamil image requires Tamil font.
        Skip test if font unavailable (real testing needs actual Tamil prescriptions)
        """
        try:
            img = Image.new('RGB', (400, 250), color='white')
            d = ImageDraw.Draw(img)
            
            # Try Tamil font (common locations)
            font_paths = [
                "/usr/share/fonts/truetype/taml/Lohit-Tamil.ttf",
                "/usr/share/fonts/truetype/tamil/Lohit-Tamil.ttf",
                "/System/Library/Fonts/Tamil.ttc"  # macOS
            ]
            
            font = None
            for path in font_paths:
                try:
                    font = ImageFont.truetype(path, 18)
                    break
                except:
                    continue
            
            if not font:
                pytest.skip("Tamil font not available for synthetic image generation")
            
            # Tamil clinical text (fever, diabetes, medication)
            text = "நோயாளி: ராஜேஷ்\nவயது: 52\nநோய்: சர்க்கரை நோய்\nமருந்து: மெட்பார்மின் 500mg"
            d.text((10, 10), text, fill=(0, 0, 0), font=font)
            
            # Fix for Windows: Close file before yielding path
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
                f.close()
                img.save(f.name)
                yield Path(f.name)
            
            try:
                Path(f.name).unlink()
            except:
                pass
                
        except Exception as e:
            pytest.skip(f"Tamil image generation failed: {e}")
    
    @pytest.mark.asyncio
    async def test_english_ocr_extraction(self, english_image, mock_pytesseract):
        """Test English OCR with high confidence"""
        processor = PrescriptionOCRProcessor(language_mode=LanguageMode.ENGLISH)
        workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        result = await processor.process_prescription(
            image_path=english_image,
            encounter_id="ENC-001",
            workflow=workflow,
            triggered_by="test"
        )
        
        assert result.language_detected == "en"
        assert result.confidence.mean > 70.0  # High confidence expected
        assert "LOW_CONFIDENCE" not in result.safety_flags
        assert workflow.current_state == WorkflowState.OCR_COMPLETE
    
    @pytest.mark.asyncio
    async def test_tamil_ocr_with_safety_flags(self, tamil_image, mock_pytesseract):
        """
        CRITICAL TEST: Tamil OCR should ALWAYS flag low confidence
        until fine-tuned on clinical Tamil data
        """
        processor = PrescriptionOCRProcessor(language_mode=LanguageMode.TAMIL)
        workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        result = await processor.process_prescription(
            image_path=tamil_image,
            encounter_id="ENC-001",
            workflow=workflow,
            triggered_by="test"
        )
        
        # Tamil OCR on base Tesseract WILL have lower confidence
        # This is EXPECTED and SAFETY-CRITICAL
        assert result.language_detected in ["ta", "mixed"]
        
        # Safety flag MUST be present for Tamil (clinical safety requirement)
        assert any("LOW_CONFIDENCE_TAMIL" in flag for flag in result.safety_flags), \
            "Tamil OCR MUST flag low confidence for doctor review"
        
        # Workflow should still advance to OCR_COMPLETE (with safety flags)
        assert workflow.current_state == WorkflowState.OCR_COMPLETE
        assert "LOW_CONFIDENCE_TAMIL_OCR" in workflow.get_data("ocr_safety_flags", [])
    
    @pytest.mark.asyncio
    async def test_workflow_integration(self, english_image, mock_pytesseract):
        """Test OCR processor auto-advances workflow state"""
        processor = PrescriptionOCRProcessor(language_mode=LanguageMode.ENGLISH)
        workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        # Before OCR: REGISTRATION state
        assert workflow.current_state == WorkflowState.REGISTRATION
        
        # Run OCR with workflow integration
        await processor.process_prescription(
            image_path=english_image,
            encounter_id="ENC-001",
            workflow=workflow,
            triggered_by="nurse_test"
        )
        
        # After OCR: OCR_COMPLETE state
        assert workflow.current_state == WorkflowState.OCR_COMPLETE
        
        # Workflow data populated
        assert workflow.get_data("ocr_text") is not None
        assert workflow.get_data("ocr_structured_fields") is not None
