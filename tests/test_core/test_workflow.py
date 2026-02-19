"""Test AIRA workflow state machine with safety gates"""
import pytest
from datetime import datetime
from core.workflow import (
    AIRAWorkflow, 
    WorkflowState, 
    SafetyViolationError, 
    InvalidTransitionError
)

@pytest.mark.asyncio
class TestWorkflowStateTransitions:
    
    def test_initial_state(self):
        """Workflow starts in REGISTRATION state"""
        wf = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        assert wf.current_state == WorkflowState.REGISTRATION
    
    async def test_valid_transitions(self):
        """Test allowed state transitions"""
        wf = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        # REGISTRATION → OCR_COMPLETE
        wf.set_data("ocr_text", "Test prescription")
        await wf.advance_to(WorkflowState.OCR_COMPLETE, triggered_by="test")
        assert wf.current_state == WorkflowState.OCR_COMPLETE
        
        # OCR_COMPLETE → NLP_EXTRACTED
        wf.set_data("clinical_entities", [])
        await wf.advance_to(WorkflowState.NLP_EXTRACTED, triggered_by="test")
        assert wf.current_state == WorkflowState.NLP_EXTRACTED
        
        # NLP_EXTRACTED → DOCTOR_REVIEW_PENDING
        wf.set_data("ai_draft_note", "Draft note")
        await wf.advance_to(WorkflowState.DOCTOR_REVIEW_PENDING, triggered_by="test")
        assert wf.current_state == WorkflowState.DOCTOR_REVIEW_PENDING
    
    async def test_safety_gate_blocks_emr_save(self):
        """EMR_SAVED requires doctor verification"""
        wf = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        # Set minimal data to reach DOCTOR_REVIEW_PENDING
        wf.set_data("ocr_text", "Test")
        await wf.advance_to(WorkflowState.OCR_COMPLETE, triggered_by="test")
        wf.set_data("clinical_entities", [])
        await wf.advance_to(WorkflowState.NLP_EXTRACTED, triggered_by="test")
        wf.set_data("ai_draft_note", "Draft")
        await wf.advance_to(WorkflowState.DOCTOR_REVIEW_PENDING, triggered_by="test")
        
        # Attempt EMR save WITHOUT verification → should fail
        with pytest.raises(SafetyViolationError) as exc:
            await wf.advance_to(WorkflowState.EMR_SAVED, triggered_by="test")
        
        assert "doctor verification" in str(exc.value).lower()
    
    async def test_doctor_verification_unlocks_emr_save(self):
        """Doctor verification enables EMR save"""
        wf = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        # Reach DOCTOR_REVIEW_PENDING
        wf.set_data("ocr_text", "Test")
        await wf.advance_to(WorkflowState.OCR_COMPLETE, triggered_by="test")
        wf.set_data("clinical_entities", [])
        await wf.advance_to(WorkflowState.NLP_EXTRACTED, triggered_by="test")
        wf.set_data("ai_draft_note", "Draft")
        await wf.advance_to(WorkflowState.DOCTOR_REVIEW_PENDING, triggered_by="test")
        
        # Mark as verified
        wf.mark_doctor_verified(staff_id="dr_test", notes="Verified")
        
        # Now EMR save should succeed
        await wf.advance_to(WorkflowState.EMR_SAVED, triggered_by="dr_test")
        assert wf.current_state == WorkflowState.EMR_SAVED
    
    def test_audit_trail_immutable(self):
        """Audit trail cannot be modified externally"""
        wf = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        original_trail = wf.audit_trail
        
        # Attempt to modify
        original_trail.append("malicious_entry")
        
        # Should not affect actual audit trail
        assert len(wf.audit_trail) == 1  # Only initial state entry
        assert wf.audit_trail[0].to_state == WorkflowState.REGISTRATION

class TestWorkflowDataSafety:
    
    def test_phi_not_leaked_in_repr(self):
        """__repr__ should not expose PHI"""
        wf = AIRAWorkflow(patient_id="PT-JohnDoe", encounter_id="ENC-001")
        repr_str = repr(wf)
        
        # Should NOT contain full patient ID
        assert "JohnDoe" not in repr_str
        assert "PT-" in repr_str  # Partial ID OK for debugging
