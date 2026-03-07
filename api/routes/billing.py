"""
Billing API Routes
==================
Handles subscription management, checkout flow, and payment verification.
Supports both mock mode (default) and real Razorpay payments.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from db.database import get_db
from api.middleware.auth import get_current_staff
from api.services.billing_service import BillingService, RAZORPAY_ENABLED
from db import crud

router = APIRouter(prefix="/api/billing", tags=["billing"])


# ─── Request Models ─────────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: str
    cancel_url: str


class WebhookRequest(BaseModel):
    """Mock webhook / fulfillment request (used in mock mode)."""
    staff_id: str
    plan_id: str
    session_id: str


class RazorpayVerifyRequest(BaseModel):
    """Razorpay payment verification (used in live mode)."""
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


# ─── Endpoints ──────────────────────────────────────────────

@router.post("/checkout")
def create_checkout_session(
    request: CheckoutRequest,
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """
    Create a checkout session / payment order.
    Returns Razorpay order details (live) or mock session (dev).
    """
    roles = crud.get_staff_roles(db, staff_id)
    if "doctor" not in roles and "admin" not in roles:
        raise HTTPException(
            status_code=403,
            detail="Only Doctors and Admins can manage subscriptions.",
        )

    session_data = BillingService.create_checkout_session(
        staff_id=staff_id,
        plan_id=request.plan_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        db_session=db,
    )
    return session_data


@router.post("/verify")
def verify_payment(
    request: RazorpayVerifyRequest,
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """
    Verify Razorpay payment signature and activate subscription.
    Only used when RAZORPAY_ENABLED is True.
    """
    if not RAZORPAY_ENABLED:
        raise HTTPException(status_code=400, detail="Razorpay is not configured.")

    # Verify signature
    is_valid = BillingService.verify_razorpay_payment(
        razorpay_order_id=request.razorpay_order_id,
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_signature=request.razorpay_signature,
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    # Activate subscription
    try:
        result = BillingService.fulfill_checkout(staff_id, request.plan_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
def mock_webhook_fulfillment(
    request: WebhookRequest,
    db: Session = Depends(get_db),
):
    """
    Mock endpoint to fulfill the checkout session (development only).
    In production, use /verify with Razorpay payment verification.
    """
    try:
        result = BillingService.fulfill_checkout(request.staff_id, request.plan_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status")
def get_status(
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    """Get the current subscription status and plan details."""
    return BillingService.get_subscription_status(staff_id, db)


@router.get("/config")
def get_billing_config():
    """Return billing configuration for the frontend (non-sensitive)."""
    return {
        "razorpay_enabled": RAZORPAY_ENABLED,
        "razorpay_key_id": BillingService.create_checkout_session.__doc__ and (
            # Only send key_id (public key), never key_secret
            __import__("os").getenv("RAZORPAY_KEY_ID", "")
        ),
    }
