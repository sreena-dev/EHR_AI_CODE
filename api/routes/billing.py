from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel

from db.database import get_db
from api.middleware.auth import get_current_staff
from api.services.billing_service import BillingService
from db import crud

router = APIRouter(prefix="/api/billing", tags=["billing"])

class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: str
    cancel_url: str

class WebhookRequest(BaseModel):
    staff_id: str
    plan_id: str
    session_id: str

@router.post("/checkout")
def create_checkout_session(
    request: CheckoutRequest,
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db)
):
    """
    Create a mock checkout session and return a URL to redirect the user to.
    """
    roles = crud.get_staff_roles(db, staff_id)
    if "doctor" not in roles and "admin" not in roles:
        raise HTTPException(status_code=403, detail="Only Doctors and Admins can manage subscriptions.")
        
    session_data = BillingService.create_checkout_session(
        staff_id=staff_id,
        plan_id=request.plan_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )
    return session_data

@router.post("/webhook")
def mock_webhook_fulfillment(
    request: WebhookRequest,
    db: Session = Depends(get_db)
):
    """
    Mock endpoint to fulfill the checkout session. 
    In a real app, this would be a secure webhook triggered by Stripe/Razorpay.
    """
    try:
        result = BillingService.fulfill_checkout(request.staff_id, request.plan_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status")
def get_status(
    staff_id: str = Depends(get_current_staff),
    db: Session = Depends(get_db)
):
    """
    Get the current subscription status and plan details for the logged-in user.
    """
    return BillingService.get_subscription_status(staff_id, db)
