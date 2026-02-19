"""
Clinical note generation using Meditron-7B (offline, CPU-friendly via Ollama).
Generates structured SOAP notes from transcript + OCR/NLP data.
"""
import logging
import json
from typing import Dict, Optional, List
from datetime import datetime

from .models import ClinicalNote, NoteSection
from .templates import SOAP_TEMPLATE
from .safety_guard import SafetyGuard
from core.workflow import AIRAWorkflow

logger = logging.getLogger(__name__)

class ClinicalNoteGenerator:
    """
    Generates HIPAA-compliant clinical notes using local LLM.
    Uses Ollama for CPU-friendly Meditron-7B inference.
    """
    
    def __init__(self, model_name: str = "meditron:7b"):
        self.model_name = model_name
        self.safety_guard = SafetyGuard()
        self._client = None  # Lazy-loaded Ollama client
    
    def _get_ollama_client(self):
        """Lazy load Ollama client"""
        if self._client is None:
            try:
                from ollama import Client
                self._client = Client(host='http://localhost:11434')
                # Verify model exists
                models = self._client.list()
                if not any(m['name'] == self.model_name for m in models['models']):
                    logger.warning(f"Model '{self.model_name}' not found - downloading...")
                    self._client.pull(self.model_name)
            except Exception as e:
                raise RuntimeError(
                    f"Ollama not running or model unavailable: {e}. "
                    "Install Ollama: https://ollama.com/download"
                )
        return self._client
    
    async def generate_note(
        self,
        workflow: AIRAWorkflow,
        encounter_id: str,
        transcript: str,
        clinical_entities: Optional[List[Dict]] = None,
        ocr_text: Optional[str] = None
    ) -> ClinicalNote:
        """
        Generate structured clinical note from multimodal inputs.
        
        Safety workflow:
        1. Build context from transcript + OCR + NLP entities
        2. Generate draft note using Meditron
        3. Run Llama Guard 2 safety check
        4. Block hallucinated diagnoses/medications
        5. Return draft for doctor verification
        """
        start_time = datetime.utcnow()
        
        # Build clinical context
        context = self._build_context(
            transcript=transcript,
            clinical_entities=clinical_entities,
            ocr_text=ocr_text,
            workflow=workflow
        )
        
        # Generate draft note
        draft_note = await self._generate_draft(context)
        
        # Safety validation
        safety_result = self.safety_guard.validate_note(draft_note)
        
        if not safety_result.is_safe:
            logger.warning(
                f"Safety violation in generated note (encounter: {encounter_id}): "
                f"{safety_result.violations}"
            )
            # Sanitize unsafe content
            draft_note = self._sanitize_unsafe_content(draft_note, safety_result)
        
        # Structure into SOAP format
        structured_note = self._structure_soap_note(draft_note, context)
        
        # Store in workflow
        workflow.set_data("ai_draft_note", structured_note.model_dump_json())
        workflow.set_data("note_safety_flags", safety_result.violations)
        
        return structured_note
    
    def _build_context(
        self,
        transcript: str,
        clinical_entities: Optional[List[Dict]],
        ocr_text: Optional[str],
        workflow: AIRAWorkflow
    ) -> str:
        """Build rich clinical context for LLM"""
        context_parts = ["# CLINICAL CONTEXT\n"]
        
        # Patient demographics (from workflow)
        patient_id = workflow.get_data("patient_id", "UNKNOWN")
        context_parts.append(f"Patient ID: {patient_id}\n")
        
        # Transcript (primary source)
        context_parts.append("\n## TRANSCRIPT\n")
        context_parts.append(transcript[:2000] + "..." if len(transcript) > 2000 else transcript)
        
        # OCR text (prescription context)
        if ocr_text:
            context_parts.append("\n## PRESCRIPTION CONTEXT\n")
            context_parts.append(ocr_text[:1000] + "..." if len(ocr_text) > 1000 else ocr_text)
        
        # Clinical entities (NLP extraction)
        if clinical_entities:
            context_parts.append("\n## EXTRACTED CLINICAL ENTITIES\n")
            for entity in clinical_entities[:20]:  # Limit to top 20
                context_parts.append(f"- {entity.get('text', '')} ({entity.get('entity_type', '')})")
        
        return "\n".join(context_parts)
    
    async def _generate_draft(self, context: str) -> str:
        """Generate draft note using Meditron"""
        try:
            client = self._get_ollama_client()
            
            prompt = f"""
You are an expert clinical documentation assistant. Generate a professional clinical note using ONLY the facts provided in the context below.

CRITICAL SAFETY RULES:
- NEVER invent diagnoses not mentioned in context
- NEVER invent medications not mentioned in context
- NEVER guess patient age/gender if not provided
- If uncertain, write "Patient reports [symptom]" not "Patient has [diagnosis]"
- Use neutral, objective language

CONTEXT:
{context}

INSTRUCTIONS:
Generate a concise clinical note in paragraph form covering:
1. Chief complaint and history of present illness
2. Relevant past medical history (only if mentioned)
3. Medications mentioned (only if explicitly stated)
4. Assessment and plan (only based on explicit statements)

NOTE:
"""
            
            response = client.generate(
                model=self.model_name,
                prompt=prompt,
                options={
                    "temperature": 0.3,  # Low temperature for factual output
                    "top_p": 0.9,
                    "num_ctx": 2048
                }
            )
            
            return response['response'].strip()
            
        except Exception as e:
            logger.error(f"Note generation failed: {e}")
            # Fallback to template-based note
            return self._fallback_template_note(context)
    
    def _structure_soap_note(self, draft: str, context: str) -> ClinicalNote:
        """Structure draft into SOAP format"""
        # Simple heuristic segmentation (production: use LLM to structure)
        lines = draft.split('\n')
        subjective = []
        objective = []
        assessment = []
        plan = []
        
        current_section = "subjective"
        for line in lines:
            line_lower = line.lower()
            if "objective" in line_lower or "vitals" in line_lower or "exam" in line_lower:
                current_section = "objective"
            elif "assessment" in line_lower or "diagnosis" in line_lower:
                current_section = "assessment"
            elif "plan" in line_lower or "recommendation" in line_lower:
                current_section = "plan"
            
            if current_section == "subjective":
                subjective.append(line)
            elif current_section == "objective":
                objective.append(line)
            elif current_section == "assessment":
                assessment.append(line)
            elif current_section == "plan":
                plan.append(line)
        
        return ClinicalNote(
            subjective="\n".join(subjective),
            objective="\n".join(objective),
            assessment="\n".join(assessment),
            plan="\n".join(plan),
            safety_flags=[],
            requires_verification=True  # ALWAYS require doctor verification
        )
    
    def _sanitize_unsafe_content(self, note: str, safety_result) -> str:
        """Remove hallucinated content"""
        # Simple sanitization: remove lines containing unsafe terms
        unsafe_terms = ["diagnosed with", "confirmed", "definitive diagnosis"]
        lines = note.split('\n')
        safe_lines = [
            line for line in lines 
            if not any(term in line.lower() for term in unsafe_terms)
        ]
        return "\n".join(safe_lines) + "\n\n[NOTE: Some content removed for safety verification]"
    
    def _fallback_template_note(self, context: str) -> str:
        """Template-based fallback when LLM unavailable"""
        return f"""
SUBJECTIVE:
Patient presented for consultation. Transcript: {context[:500]}

OBJECTIVE:
Vitals not recorded. No physical exam performed during this encounter.

ASSESSMENT:
Clinical assessment pending doctor review.

PLAN:
1. Await doctor verification of transcript
2. Review prescription history
3. Follow up as clinically indicated

---
NOTE: This is a template draft. Requires doctor verification before EMR entry.
"""