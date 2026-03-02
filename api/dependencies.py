from typing import Callable, Dict
from fastapi import Depends, HTTPException, status
from core.workflow import AIRAWorkflow, WorkflowState
from services.ocr.processor import PrescriptionOCRProcessor
from services.ocr.config import LanguageMode
from api.middleware.auth import get_current_staff, get_current_staff_role

# Singleton instances (initialized at app startup)
_OCR_PROCESSORS: Dict[str, PrescriptionOCRProcessor] = {}
_WORKFLOW_REGISTRY: Dict[str, AIRAWorkflow] = {}

def get_ocr_processor(language_mode: str = "eng+tam") -> PrescriptionOCRProcessor:
    """Cached OCR processor instances per language mode"""
    key = language_mode
    if key not in _OCR_PROCESSORS:
        mode = LanguageMode(language_mode)
        _OCR_PROCESSORS[key] = PrescriptionOCRProcessor(language_mode=mode)
    return _OCR_PROCESSORS[key]

def get_or_create_workflow(
    encounter_id: str,
    patient_id: str
) -> AIRAWorkflow:
    """Workflow registry with encounter-level isolation"""
    key = f"{encounter_id}"
    if key not in _WORKFLOW_REGISTRY:
        _WORKFLOW_REGISTRY[key] = AIRAWorkflow(
            patient_id=patient_id,
            encounter_id=encounter_id
        )
    return _WORKFLOW_REGISTRY[key]

def verify_staff_role(required_roles: list[str]) -> Callable:
    """Role-based access control for clinical endpoints — queries the database."""
    async def role_checker(
        staff_id: str = Depends(get_current_staff)
    ) -> str:
        from db.database import SessionLocal
        from db import crud

        db = SessionLocal()
        try:
            roles = crud.get_staff_roles(db, staff_id)
            if not any(role in required_roles for role in roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions for this operation"
                )
            return staff_id
        finally:
            db.close()
    return role_checker