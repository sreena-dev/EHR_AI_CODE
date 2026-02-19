"""Test clinical NLP extraction with BioBERT"""
import pytest
from services.nlp.extractor import ClinicalNLPExtractor
from services.nlp.models import EntityType
from core.workflow import AIRAWorkflow, WorkflowState

class TestNLPExtraction:
    
    @pytest.fixture
    def english_clinical_text(self):
        return """
        45 year old male with history of diabetes mellitus type 2 for 10 years,
        hypertension, and hyperlipidemia. Current medications: metformin 1000mg BD,
        atorvastatin 20mg OD. Presents with acute onset chest pain radiating to left arm.
        No fever, no cough. Blood pressure 145/90 mmHg.
        """
    
    @pytest.fixture
    def tamil_clinical_text(self):
        # Transliterated Tamil clinical text (real Tamil requires UTF-8 handling)
        return """
        52 வயது ஆண் நோயாளி. 10 ஆண்டுகளாக சர்க்கரை நோய், இரத்த அழுத்தம் உயர்வு.
        மருந்துகள்: மெட்பார்மின் 500mg இருமுறை தினமும்.
        இப்போது மார்பு வலி மற்றும் மூச்சுத் திணறல் உள்ளது.
        """
    
    @pytest.mark.asyncio
    async def test_english_entity_extraction(self, english_clinical_text):
        """Test BioBERT extraction on English clinical text"""
        extractor = ClinicalNLPExtractor(device="cpu")
        workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        result = await extractor.extract_entities(
            text=english_clinical_text,
            encounter_id="ENC-001",
            language="en",
            workflow=workflow,
            triggered_by="test"
        )
        
        # Should extract multiple entity types
        assert result.entity_count > 5
        
        # Should detect key clinical entities
        entity_types = {e.entity_type for e in result.entities}
        assert EntityType.CONDITION in entity_types
        assert EntityType.MEDICATION in entity_types
        assert EntityType.SYMPTOM in entity_types
        
        # High confidence expected for English
        assert result.avg_confidence > 0.6
        
        # Workflow advanced
        assert workflow.current_state == WorkflowState.NLP_EXTRACTED
    
    @pytest.mark.asyncio
    async def test_negation_detection(self, english_clinical_text):
        """Test negation detection (e.g., 'no fever')"""
        extractor = ClinicalNLPExtractor(device="cpu")
        result = await extractor.extract_entities(
            text=english_clinical_text,
            encounter_id="ENC-001",
            language="en",
            workflow=None
        )
        
        # "no fever" and "no cough" should be detected as negated
        negated_entities = [e for e in result.entities if e.negated]
        assert len(negated_entities) >= 1, "Should detect negated symptoms"
    
    @pytest.mark.asyncio
    async def test_tamil_extraction_with_safety_flags(self, tamil_clinical_text):
        """Test Tamil extraction with appropriate safety flags"""
        extractor = ClinicalNLPExtractor(device="cpu")
        workflow = AIRAWorkflow(patient_id="PT-001", encounter_id="ENC-001")
        
        result = await extractor.extract_entities(
            text=tamil_clinical_text,
            encounter_id="ENC-001",
            language="ta",
            workflow=workflow,
            triggered_by="test"
        )
        
        # Tamil extraction may have lower confidence
        # Safety flags should reflect this
        if result.avg_confidence < 0.65:
            assert any("LOW_CONFIDENCE_TAMIL" in flag for flag in result.safety_flags)
