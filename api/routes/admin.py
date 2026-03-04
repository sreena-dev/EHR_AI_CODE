"""
Admin API Routes — AIRA Clinical Workflow
==========================================
Admin-only endpoints for dashboard stats, staff management,
encounter oversight, and audit trail viewing.

All endpoints require admin role authentication.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db import crud
from api.middleware.auth import (
    get_current_staff, require_role, StaffRole, PasswordManager
)

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# Role guard — all admin endpoints require admin role
admin_guard = require_role([StaffRole.ADMIN])


# ═══════════════════════════════════════════
# REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════

class CreateStaffRequest(BaseModel):
    staff_id: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=200)
    role: str = Field(..., pattern=r"^(nurse|doctor|admin|receptionist)$")
    password: str = Field(..., min_length=8, max_length=128)
    department: Optional[str] = None


class UpdateStaffRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None


# ═══════════════════════════════════════════
# DASHBOARD STATS
# ═══════════════════════════════════════════

@router.get(
    "/dashboard-stats",
    summary="Admin Dashboard Stats",
    dependencies=[Depends(admin_guard)]
)
async def get_dashboard_stats(
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """
    Aggregate KPI stats for the admin dashboard.
    Returns encounter counts, staff counts, patient count, and alerts.
    """
    logger.info(f"Admin dashboard stats requested by: {staff_id}")
    stats = crud.get_admin_dashboard_stats(db)
    return stats


# ═══════════════════════════════════════════
# STAFF MANAGEMENT
# ═══════════════════════════════════════════

@router.get(
    "/staff",
    summary="List All Staff",
    dependencies=[Depends(admin_guard)]
)
async def list_staff(
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """List all staff members with their status and last login."""
    logger.info(f"Staff list requested by admin: {staff_id}")
    staff_list = crud.list_all_staff(db)
    return {
        "staff": [
            {
                "staff_id": s.staff_id,
                "full_name": s.full_name,
                "role": s.role,
                "department": s.department or "—",
                "status": s.status,
                "last_login": s.last_login.isoformat() if s.last_login else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "failed_attempts": s.failed_attempts or 0,
            }
            for s in staff_list
        ],
        "total": len(staff_list),
    }


@router.post(
    "/staff",
    summary="Create Staff Member",
    dependencies=[Depends(admin_guard)],
    status_code=status.HTTP_201_CREATED,
)
async def create_staff(
    data: CreateStaffRequest,
    admin_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """Create a new staff member with hashed password."""
    # Check for duplicate
    existing = crud.get_staff(db, data.staff_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Staff ID '{data.staff_id}' already exists"
        )

    pm = PasswordManager()
    password_hash = pm.hash_password(data.password)

    new_staff = crud.create_staff(
        db,
        staff_id=data.staff_id,
        full_name=data.full_name,
        role=data.role,
        password_hash=password_hash,
        department=data.department,
        status="active",
    )

    logger.info(f"Staff created by admin {admin_id}: {data.staff_id} (role={data.role})")

    return {
        "message": f"Staff member '{data.staff_id}' created successfully",
        "staff": {
            "staff_id": new_staff.staff_id,
            "full_name": new_staff.full_name,
            "role": new_staff.role,
            "department": new_staff.department,
            "status": new_staff.status,
        }
    }


@router.put(
    "/staff/{target_staff_id}",
    summary="Update Staff Member",
    dependencies=[Depends(admin_guard)],
)
async def update_staff(
    target_staff_id: str,
    data: UpdateStaffRequest,
    admin_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """Update staff profile fields (role, department, status)."""
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updated = crud.update_staff_profile(db, target_staff_id, **updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff '{target_staff_id}' not found"
        )

    logger.info(f"Staff updated by admin {admin_id}: {target_staff_id} -> {updates}")

    return {
        "message": f"Staff '{target_staff_id}' updated successfully",
        "staff": {
            "staff_id": updated.staff_id,
            "full_name": updated.full_name,
            "role": updated.role,
            "department": updated.department,
            "status": updated.status,
        }
    }


# ═══════════════════════════════════════════
# ENCOUNTER OVERSIGHT
# ═══════════════════════════════════════════

@router.get(
    "/encounters",
    summary="List All Encounters",
    dependencies=[Depends(admin_guard)],
)
async def list_encounters(
    status_filter: Optional[str] = Query(None, alias="status"),
    doctor: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """List all encounters with optional filters for admin oversight."""
    # Parse date strings
    d_from = None
    d_to = None
    if date_from:
        try:
            d_from = date.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(400, "Invalid date_from format (use YYYY-MM-DD)")
    if date_to:
        try:
            d_to = date.fromisoformat(date_to)
        except ValueError:
            raise HTTPException(400, "Invalid date_to format (use YYYY-MM-DD)")

    encounters = crud.list_all_encounters_filtered(
        db,
        status_filter=status_filter,
        doctor_filter=doctor,
        date_from=d_from,
        date_to=d_to,
        limit=limit,
    )

    return {
        "encounters": [
            {
                "id": e.id,
                "patient_id": e.patient_id,
                "patient_name": e.patient_rel.name if e.patient_rel else "Unknown",
                "doctor_id": e.doctor_id,
                "doctor_name": e.doctor_rel.full_name if e.doctor_rel else "—",
                "nurse_id": e.nurse_id,
                "type": e.type,
                "status": e.status,
                "chief_complaint": e.chief_complaint or "—",
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in encounters
        ],
        "total": len(encounters),
    }


# ═══════════════════════════════════════════
# AUDIT TRAIL
# ═══════════════════════════════════════════

@router.get(
    "/audit-log",
    summary="View Audit Trail",
    dependencies=[Depends(admin_guard)],
)
async def get_audit_log(
    limit: int = Query(50, ge=1, le=500),
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """Get recent audit trail entries for HIPAA compliance review."""
    logger.info(f"Audit log requested by admin: {staff_id}")

    entries = crud.get_recent_audit_entries(db, limit=limit)

    return {
        "audit_log": [
            {
                "id": entry.id,
                "encounter_id": entry.encounter_id,
                "from_state": entry.from_state or "—",
                "to_state": entry.to_state,
                "triggered_by": entry.triggered_by,
                "notes": entry.notes or "",
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                "safety_flags": entry.safety_flags or [],
            }
            for entry in entries
        ],
        "total": len(entries),
    }
