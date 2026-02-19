"""Full workflow integration test: Registration → OCR → NLP → Doctor Review"""
import pytest
import sys
from pathlib import Path
import tempfile
from PIL import Image, ImageDraw, ImageFont
from unittest.mock import patch, MagicMock, AsyncMock

from core.workflow import AIRAWorkflow, WorkflowState
from services.ocr.processor import PrescriptionOCRProcessor
from services.ocr.config import LanguageMode
from services.nlp.extractor import ClinicalNLPExtractor
from services.nlp.models import (
    EntityType, 
    NLPEngineResult, 
    ClinicalEntity,
    EntityConfidence,
    TimelineExpression
)

class TestEndToEndWorkflow:
    
    @pytest.fixture
    def sample_prescription(self):
        """Generate realistic prescription image for testing"""
        img = Image.new('RGB', (600, 400), color='white')
        d = ImageDraw.Draw(img)
        
        # Simulate handwritten prescription layout
        prescription_text = """
PATIENT: Sarah Johnson
AGE: 38 YEARS
DATE: 02-FEB-2024

COMPLAINT: Acute bronchitis x 3 days
H/O fever, cough with yellow sputum

DIAGNOSIS:
1. Acute bronchitis

MEDICATIONS:
1. Azithromycin 500mg OD x 3 days
2. Paracetamol 500mg SOS for fever
3. Ambroxol syrup 10ml TDS

F/U in 5 days if no improvement
        """
        
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        except:
            font = ImageFont.load_default()
        
        d.text((20, 20), prescription_text, fill=(0, 0, 0), font=font)
        
        # Windows-safe temp file handling
        temp_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        temp_path = Path(temp_file.name)
        temp_file.close()  # Close before saving on Windows
        img.save(temp_path)
        yield temp_path
        try:
            temp_path.unlink(missing_ok=True)
        except PermissionError:
            # Windows file lock - skip cleanup (OS will handle)
            pass
    
    @pytest.mark.asyncio
    async def test_complete_workflow(self, sample_prescription):
        """
        Test full workflow:
        1. Create workflow
        2. OCR prescription
        3. NLP extraction
        4. Verify doctor review required before EMR save
        """
        # Step 1: Initialize workflow
        workflow = AIRAWorkflow(patient_id="PT-SARAH-001", encounter_id="ENC-2024-001")
        assert workflow.current_state == WorkflowState.REGISTRATION
        
        # Step 2: OCR processing with mocked Tesseract
        ocr_processor = PrescriptionOCRProcessor(language_mode=LanguageMode.ENGLISH)
        
        # Mock Tesseract output
        mock_data = {
            'text': [
                "PATIENT:", "Sarah", "Johnson", "AGE:", "38", "YEARS",
                "COMPLAINT:", "Acute", "bronchitis", "fever",
                "DIAGNOSIS:", "Acute", "bronchitis",
                "MEDICATIONS:", "Azithromycin", "500mg", "OD",
                "Paracetamol", "500mg", "Ambroxol", "10ml"
            ],
            'conf': [95] * 21,
            'top': [0] * 21,
            'left': [0] * 21,
            'width': [0] * 21,
            'height': [0] * 21
        }
        
        mock_pyt = MagicMock()
        mock_pyt.image_to_data.return_value = mock_data
        mock_pyt.Output.DICT = "dict"
        mock_pyt.get_languages.return_value = ['eng']
        
        with patch.dict("sys.modules", {"pytesseract": mock_pyt}):
            ocr_result = await ocr_processor.process_prescription(
                image_path=sample_prescription,
                encounter_id="ENC-2024-001",
                workflow=workflow,
                triggered_by="nurse_001"
            )
        
        # Verify OCR results
        assert workflow.current_state == WorkflowState.OCR_COMPLETE
        assert "fever" in ocr_result.raw_text.lower()
        assert "azithromycin" in ocr_result.raw_text.lower()
        
        # Step 3: NLP extraction with FULL mock result (all required fields)
        nlp_mock_result = NLPEngineResult(
            encounter_id="ENC-2024-001",
            source_text=ocr_result.raw_text,
            language="en",
            entities=[
                ClinicalEntity(
                    text="Acute bronchitis",
                    entity_type=EntityType.CONDITION,
                    start_char=0,
                    end_char=18,
                    confidence=EntityConfidence(
                        score=0.98,
                        normalized_score=0.98,
                        evidence_count=5
                    )
                ),
                ClinicalEntity(
                    text="fever",
                    entity_type=EntityType.SYMPTOM,
                    start_char=20,
                    end_char=25,
                    confidence=EntityConfidence(
                        score=0.95,
                        normalized_score=0.95,
                        evidence_count=3
                    )
                ),
                ClinicalEntity(
                    text="Azithromycin",
                    entity_type=EntityType.MEDICATION,
                    start_char=30,
                    end_char=43,
                    confidence=EntityConfidence(
                        score=0.99,
                        normalized_score=0.99,
                        evidence_count=4
                    )
                ),
                ClinicalEntity(
                    text="Paracetamol",
                    entity_type=EntityType.MEDICATION,
                    start_char=45,
                    end_char=56,
                    confidence=EntityConfidence(
                        score=0.97,
                        normalized_score=0.97,
                        evidence_count=4
                    )
                )
            ],
            timelines=[],
            processing_time_ms=120,
            model_version="test-bioclinical-bert",
            safety_flags=[],
            confidence_metrics={
                "avg_entity_confidence": 0.97,
                "entity_count": 4,
                "text_length": len(ocr_result.raw_text)
            }
        )
        
        # Proper async mocking
        with patch("services.nlp.extractor.ClinicalNLPExtractor") as MockExtractor:
            mock_instance = MockExtractor.return_value
            mock_instance.extract_entities = AsyncMock(return_value=nlp_mock_result)
            
            # Instantiate extractor (will use mock)
            nlp_extractor = ClinicalNLPExtractor(device="cpu")
            nlp_result = await nlp_extractor.extract_entities(
                text=ocr_result.raw_text,
                encounter_id="ENC-2024-001",
                language=ocr_result.language_detected,
                workflow=workflow,
                triggered_by="ai_service_nlp"
            )
        
        # Verify NLP results
        assert workflow.current_state == WorkflowState.NLP_EXTRACTED
        assert nlp_result.entity_count == 4
        
        conditions = nlp_result.get_entities_by_type(EntityType.CONDITION)
        medications = nlp_result.get_entities_by_type(EntityType.MEDICATION)
        
        assert len(conditions) >= 1
        assert len(medications) >= 2
        assert any("bronchitis" in e.text.lower() for e in conditions)
        assert any("azithromycin" in e.text.lower() for e in medications)
        
        # Step 4: Attempt EMR save WITHOUT doctor verification → should fail
        with pytest.raises(Exception) as exc:
            await workflow.advance_to(WorkflowState.EMR_SAVED, triggered_by="system")
        
        assert "verification" in str(exc.value).lower()
        
        # Step 5: Doctor verification unlocks EMR save
        workflow.mark_doctor_verified(staff_id="dr_anand", notes="Verified prescription")
        await workflow.advance_to(WorkflowState.EMR_SAVED, triggered_by="dr_anand")
        
        assert workflow.current_state == WorkflowState.EMR_SAVED
        
        # Step 6: Verify audit trail
        audit_trail = workflow.audit_trail
        assert len(audit_trail) >= 5  # Initial + 4 transitions
        assert audit_trail[-1].to_state == WorkflowState.EMR_SAVED
        assert audit_trail[-1].triggered_by == "dr_anand"