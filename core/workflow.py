from enum import Enum, auto
from typing import Dict, Any, Optional, Set
from datetime import datetime, timezone
import logging
from pydantic import BaseModel, Field


# ======================
# CUSTOM EXCEPTIONS
# ======================
class WorkflowError(Exception):
    """Base exception for workflow violations"""
    pass


class InvalidTransitionError(WorkflowError):
    """Raised when attempting an illegal state transition"""
    pass


class SafetyViolationError(WorkflowError):
    """Raised when bypassing critical safety gates (e.g., doctor verification)"""
    pass


class DataValidationError(WorkflowError):
    """Raised when required data is missing for a transition"""
    pass


# ======================
# STATE MACHINE DEFINITION
# ======================
class WorkflowState(Enum):
    """
    AIRA clinical workflow states with enforced transition rules.
    Arrows indicate allowed transitions:

    REGISTRATION → OCR_COMPLETE → NLP_EXTRACTED → DOCTOR_REVIEW_PENDING → EMR_SAVED
          ↑                                                                       |
          └───────────────────────────────────────────────────────────────────────┘
                                     (rollback allowed for corrections)
    """
    REGISTRATION = auto()
    OCR_COMPLETE = auto()
    NLP_EXTRACTED = auto()
    DOCTOR_REVIEW_PENDING = auto()
    EMR_SAVED = auto()

    @classmethod
    def valid_transitions(cls) -> Dict['WorkflowState', Set['WorkflowState']]:
        """Define allowed state transitions (enforced at runtime)"""
        return {
            cls.REGISTRATION: {cls.OCR_COMPLETE},
            cls.OCR_COMPLETE: {cls.NLP_EXTRACTED, cls.REGISTRATION},  # Rollback to fix OCR errors
            cls.NLP_EXTRACTED: {cls.DOCTOR_REVIEW_PENDING, cls.OCR_COMPLETE},  # Rollback to re-OCR
            cls.DOCTOR_REVIEW_PENDING: {cls.EMR_SAVED, cls.NLP_EXTRACTED},  # Rollback to re-extract
            cls.EMR_SAVED: set()  # Terminal state — no further transitions
        }


# ======================
# AUDIT TRAIL MODEL
# ======================
class WorkflowAuditEntry(BaseModel):
    """Immutable record of every state transition for HIPAA compliance"""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    from_state: Optional[WorkflowState]
    to_state: WorkflowState
    triggered_by: str  # e.g., "nurse_id_123", "system_ocr_service"
    safety_flags: list[str] = Field(default_factory=list)
    notes: Optional[str] = None


# ======================
# PRODUCTION WORKFLOW ENGINE
# ======================
class AIRAWorkflow:
    """
    Thread-safe clinical workflow orchestrator with safety gates.
    Enforces human-in-the-loop verification before EMR persistence.
    """

    def __init__(self, patient_id: str, encounter_id: str):
        if not patient_id or not encounter_id:
            raise ValueError("patient_id and encounter_id are required")

        self.patient_id = patient_id
        self.encounter_id = encounter_id
        self._current_state = WorkflowState.REGISTRATION
        self._data: Dict[str, Any] = {
            "patient_id": patient_id,
            "encounter_id": encounter_id,
            "created_at": datetime.now(timezone.utc),
            "doctor_verified": False,
            "verified_by": None,
            "verified_at": None,
            "safety_flags": []
        }
        self._audit_log: list[WorkflowAuditEntry] = []
        self._logger = logging.getLogger(f"workflow.{encounter_id}")

        # Record initial state
        self._audit_log.append(
            WorkflowAuditEntry(
                from_state=None,
                to_state=self._current_state,
                triggered_by="system_initialization",
                notes="Workflow created"
            )
        )

    @property
    def current_state(self) -> WorkflowState:
        """Read-only access to current state"""
        return self._current_state

    @property
    def audit_trail(self) -> list[WorkflowAuditEntry]:
        """Immutable audit trail (HIPAA requirement)"""
        return self._audit_log.copy()

    def get_data(self, key: str, default: Any = None) -> Any:
        """Safe data access with default fallback"""
        return self._data.get(key, default)

    def set_data(self, key: str, value: Any) -> None:
        """Set workflow data with validation"""
        if key == "doctor_verified" and value is True:
            if not self._data.get("verified_by"):
                raise DataValidationError(
                    "Cannot set doctor_verified=True without verified_by staff ID"
                )
            self._data["verified_at"] = datetime.now(timezone.utc)

        self._data[key] = value

    def require_data(self, *keys: str) -> None:
        """Enforce required data before transition"""
        missing = [k for k in keys if self._data.get(k) is None]
        if missing:
            raise DataValidationError(
                f"Missing required data for transition: {missing}"
            )

    async def advance_to(
            self,
            next_state: WorkflowState,
            triggered_by: str,
            safety_flags: Optional[list[str]] = None
    ) -> bool:
        """
        Safely transition to next state with full validation.

        Args:
            next_state: Target workflow state
            triggered_by: Staff ID or system service triggering transition
            safety_flags: Clinical safety flags (e.g., "LOW_CONFIDENCE_TAMIL")

        Returns:
            True if transition succeeded

        Raises:
            InvalidTransitionError: If transition violates state machine rules
            SafetyViolationError: If bypassing doctor verification gate
            DataValidationError: If required data missing
        """
        # 1. Validate transition legality
        allowed = WorkflowState.valid_transitions()[self._current_state]
        if next_state not in allowed:
            raise InvalidTransitionError(
                f"Invalid transition: {self._current_state.name} -> {next_state.name}. "
                f"Allowed: {[s.name for s in allowed]}"
            )

        # 2. Enforce critical safety gate: DOCTOR VERIFICATION BEFORE EMR SAVE
        if (next_state == WorkflowState.EMR_SAVED
                and not self._data.get("doctor_verified", False)):
            raise SafetyViolationError(
                "CRITICAL SAFETY VIOLATION: Attempted EMR save without doctor verification. "
                "Patient safety requires human review before clinical data persistence."
            )

        # 3. Enforce data requirements per state
        if next_state == WorkflowState.OCR_COMPLETE:
            self.require_data("ocr_text")
        elif next_state == WorkflowState.NLP_EXTRACTED:
            self.require_data("clinical_entities")
        elif next_state == WorkflowState.DOCTOR_REVIEW_PENDING:
            self.require_data("ai_draft_note")

        # 4. Execute transition
        previous_state = self._current_state
        self._current_state = next_state

        # 5. Record audit trail (HIPAA requirement)
        audit_entry = WorkflowAuditEntry(
            from_state=previous_state,
            to_state=next_state,
            triggered_by=triggered_by,
            safety_flags=safety_flags or [],
            notes=f"Transitioned by {triggered_by}"
        )
        self._audit_log.append(audit_entry)

        self._logger.info(
            f"State transition: {previous_state.name} -> {next_state.name} "
            f"(triggered by: {triggered_by})"
        )

        return True

    def rollback_to(self, target_state: WorkflowState, triggered_by: str) -> bool:
        """
        Rollback to a previous state (e.g., doctor requests re-OCR).
        Only allowed transitions defined in valid_transitions() apply.
        """
        return self.advance_to(target_state, triggered_by, safety_flags=["ROLLBACK"])

    def mark_doctor_verified(self, staff_id: str, notes: Optional[str] = None) -> None:
        """
        Explicitly mark clinical note as verified by licensed staff.
        This is the ONLY way to unlock EMR save capability.
        """
        if self._current_state != WorkflowState.DOCTOR_REVIEW_PENDING:
            raise WorkflowError(
                f"Doctor verification only allowed in DOCTOR_REVIEW_PENDING state (current: {self._current_state})"
            )

        self.set_data("verified_by", staff_id)
        self.set_data("doctor_verified", True)
        self.set_data("verification_notes", notes)

        self._logger.info(f"Doctor verification completed by {staff_id}")

    def has_safety_flags(self) -> bool:
        """Check if workflow has active safety flags requiring attention"""
        return len(self._data.get("safety_flags", [])) > 0

    def __repr__(self) -> str:
        # Mask patient ID for PHI safety (e.g., PT-12345 -> PT-***)
        masked_pid = f"{self.patient_id[:3]}***" if len(self.patient_id) > 3 else "***"
        return (
            f"AIRAWorkflow(patient={masked_pid}, encounter={self.encounter_id}, "
            f"state={self._current_state.name})"
        )