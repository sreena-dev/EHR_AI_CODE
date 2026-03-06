"""
Billing Service
===============
Mock implementation of a payment gateway integration (like Stripe or Razorpay)
to handle SaaS subscriptions for clinics. Real implementation would use 
the official provider SDKs.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import logging

logger = logging.getLogger(__name__)

class BillingService:
    """Mock Billing & Subscription Provider Manager"""

    @staticmethod
    def create_checkout_session(staff_id: str, plan_id: str, success_url: str, cancel_url: str) -> Dict[str, Any]:
        """
        Simulate creating a Stripe/Razorpay Checkout Session.
        In reality, this returns a secure URL where the user enters card details.
        Here we generate a mock URL that we'll handle directly in our frontend.
        """
        session_id = f"cs_test_{uuid.uuid4().hex}"
        
        # We will append the session ID to the success URL so frontend knows it worked
        mock_checkout_url = f"{success_url}?session_id={session_id}&plan_id={plan_id}"

        logger.info(f"Created mock checkout session {session_id} for user {staff_id} -> {plan_id}")

        return {
            "id": session_id,
            "url": mock_checkout_url,
            "status": "open",
            "metadata": {
                "staff_id": staff_id,
                "plan_id": plan_id
            }
        }

    @staticmethod
    def fulfill_checkout(staff_id: str, plan_id: str, db_session) -> Dict[str, Any]:
        """
        Simulate webhook fulfillment (checkout.session.completed).
        Upgrades the user's subscription in the database.
        """
        from db.models import ClinicSubscription, SubscriptionPlan, BillingInvoice
        
        # Verify plan exists
        plan = db_session.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
        if not plan:
            raise ValueError(f"Invalid plan ID: {plan_id}")

        current_time = datetime.now(timezone.utc)
        
        # Check for existing subscription
        sub = db_session.query(ClinicSubscription).filter(ClinicSubscription.staff_id == staff_id).first()
        
        if sub:
            # Upgrade/renew existing
            sub.plan_id = plan_id
            sub.status = "active"
            
            # Extend by interval. Default 365 days for 'year'
            days_to_add = 365 if plan.interval == "year" else 30
            # If currently active, add to current end date. Otherwise start from today.
            if sub.current_period_end and sub.current_period_end > current_time:
                sub.current_period_end = sub.current_period_end + timedelta(days=days_to_add)
            else:
                sub.current_period_end = current_time + timedelta(days=days_to_add)
                
            sub.cancel_at_period_end = False
            logger.info(f"Upgraded/renewed subscription for {staff_id} to {plan_id}")
            
        else:
            # Create new subscription
            days_to_add = 365 if plan.interval == "year" else 30
            mock_sub_id = f"sub_{uuid.uuid4().hex[:16]}"
            
            sub = ClinicSubscription(
                staff_id=staff_id,
                plan_id=plan_id,
                status="active",
                current_period_end=current_time + timedelta(days=days_to_add),
                stripe_subscription_id=mock_sub_id
            )
            db_session.add(sub)
            db_session.flush() # To get sub.id
            logger.info(f"Created new subscription for {staff_id} on {plan_id}")

        # Generate Mock Invoice
        invoice = BillingInvoice(
            id=f"in_{uuid.uuid4().hex[:16]}",
            subscription_id=sub.id,
            amount_paid=plan.price_inr,
            currency="inr",
            status="paid"
        )
        db_session.add(invoice)
        db_session.commit()

        return {"success": True, "subscription_id": sub.id, "plan_id": plan.id}
        
    @staticmethod
    def get_subscription_status(staff_id: str, db_session) -> Dict[str, Any]:
        """Get the current subscription state for a user."""
        from db.models import ClinicSubscription, SubscriptionPlan
        
        sub = db_session.query(ClinicSubscription).filter(ClinicSubscription.staff_id == staff_id).first()
        
        if not sub:
            return {"has_subscription": False, "plan": None, "status": "none"}
            
        plan = db_session.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
        
        # Check if expired
        is_expired = sub.current_period_end < datetime.now(timezone.utc)
        effective_status = sub.status
        if is_expired and effective_status == "active":
            effective_status = "past_due"
            sub.status = "past_due"
            db_session.commit()

        return {
            "has_subscription": True,
            "plan_id": sub.plan_id,
            "plan_name": plan.name if plan else "Unknown",
            "status": effective_status,
            "current_period_end": sub.current_period_end.isoformat(),
            "cancel_at_period_end": sub.cancel_at_period_end,
            "features": plan.features if plan else {}
        }
