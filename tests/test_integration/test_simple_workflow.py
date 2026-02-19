"""Minimal workflow test - NO real NLP model loading"""
import pytest
from core.workflow import AIRAWorkflow, WorkflowState
# from services.ocr.config import LanguageMode
# from services.nlp.models import EntityType, NLPEngineResult, ClinicalEntity, EntityConfidence
from unittest.mock import patch

@pytest.mark.asyncio
async def test_workflow_safety_gates():
    """Test workflow state transitions + doctor verification gate"""
    workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
    assert workflow.current_state == WorkflowState.REGISTRATION
    
    # Mock OCR result
    workflow.set_data("ocr_text", "Test prescription")
    assert await workflow.advance_to(WorkflowState.OCR_COMPLETE, triggered_by="test")
    assert workflow.current_state == WorkflowState.OCR_COMPLETE
    
    # Mock NLP result (AVOID real model loading)
    with patch("services.nlp.extractor.ClinicalNLPExtractor"):
        workflow.set_data("clinical_entities", [
            {"text": "diabetes", "entity_type": "CONDITION", "confidence": 0.95}
        ])
        assert await workflow.advance_to(WorkflowState.NLP_EXTRACTED, triggered_by="test")
    assert workflow.current_state == WorkflowState.NLP_EXTRACTED
    
    # Transition to DOCTOR_REVIEW_PENDING (required to reach EMR_SAVED)
    workflow.set_data("ai_draft_note", "Draft note from NLP")
    assert await workflow.advance_to(WorkflowState.DOCTOR_REVIEW_PENDING, triggered_by="system")
    assert workflow.current_state == WorkflowState.DOCTOR_REVIEW_PENDING
    
    # Block EMR save without doctor verification
    with pytest.raises(Exception) as exc:
        assert await workflow.advance_to(WorkflowState.EMR_SAVED, triggered_by="test")
    assert "verification" in str(exc.value).lower()
    
    # Doctor verification unlocks EMR save
    workflow.mark_doctor_verified(staff_id="dr_test", notes="Verified")
    assert await workflow.advance_to(WorkflowState.EMR_SAVED, triggered_by="dr_test")
    assert workflow.current_state == WorkflowState.EMR_SAVED