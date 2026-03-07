"""
Billing Service
===============
Supports BOTH mock mode (default) and real Razorpay integration.
Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env to enable live payments.
When env vars are absent, falls back to a simulated mock gateway.

MEDICAL SAFETY NOTE:
- Payment data is NEVER stored in the EHR database.
- Only subscription status and invoice metadata are recorded.
- All payment card details are handled exclusively by Razorpay (PCI-DSS compliant).
"""

import os
import uuid
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any
import logging

logger = logging.getLogger(__name__)

# ─── Razorpay Configuration ────────────────────────────────────
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)

_razorpay_client = None

def _get_razorpay_client():
    """Lazy-load Razorpay SDK client."""
    global _razorpay_client
    if _razorpay_client is None and RAZORPAY_ENABLED:
        try:
            import razorpay
            _razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            logger.info(f"Razorpay client initialized (key: {RAZORPAY_KEY_ID[:12]}...)")
        except ImportError:
            logger.warning("razorpay package not installed. Run: pip install razorpay")
    return _razorpay_client


class BillingService:
    """Payment & Subscription Provider Manager"""

    # ─── Order / Checkout Session ─────────────────────────────
    @staticmethod
    def create_checkout_session(
        staff_id: str,
        plan_id: str,
        success_url: str,
        cancel_url: str,
        db_session=None,
    ) -> dict[str, Any]:
        """
        Create a payment order.
        - If Razorpay is configured: creates a real Razorpay Order via their API.
        - Otherwise: returns a mock session for development.
        """
        from db.models import SubscriptionPlan

        plan = None
        if db_session:
            plan = db_session.query(SubscriptionPlan).filter(
                SubscriptionPlan.id == plan_id
            ).first()

        amount_paise = (plan.price_inr * 100) if plan else 1200000  # default 12000 INR

        client = _get_razorpay_client()
        if client and RAZORPAY_ENABLED:
            # ── Real Razorpay Order ──
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"rcpt_{uuid.uuid4().hex[:12]}",
                "notes": {
                    "staff_id": staff_id,
                    "plan_id": plan_id,
                },
            }
            order = client.order.create(data=order_data)
            logger.info(f"Created Razorpay order {order['id']} for {staff_id} -> {plan_id}")
            return {
                "id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "key_id": RAZORPAY_KEY_ID,
                "mode": "razorpay",
                "plan_name": plan.name if plan else plan_id,
                "status": "created",
                "metadata": {
                    "staff_id": staff_id,
                    "plan_id": plan_id,
                },
            }
        else:
            # ── Mock Mode ──
            session_id = f"cs_test_{uuid.uuid4().hex}"
            logger.info(f"Created mock checkout session {session_id} for user {staff_id} -> {plan_id}")
            return {
                "id": session_id,
                "amount": amount_paise,
                "currency": "INR",
                "mode": "mock",
                "plan_name": plan.name if plan else plan_id,
                "status": "open",
                "metadata": {
                    "staff_id": staff_id,
                    "plan_id": plan_id,
                },
            }

    # ─── Payment Verification (Razorpay Signature) ───────────
    @staticmethod
    def verify_razorpay_payment(
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> bool:
        """Verify the Razorpay payment signature using HMAC SHA256."""
        if not RAZORPAY_KEY_SECRET:
            return False
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected = hmac.new(
            RAZORPAY_KEY_SECRET.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    # ─── Subscription Fulfillment ────────────────────────────
    @staticmethod
    def fulfill_checkout(staff_id: str, plan_id: str, db_session) -> dict[str, Any]:
        """
        Activate/upgrade the user's subscription in the database.
        Called after successful payment (mock or Razorpay verified).
        """
        from db.models import ClinicSubscription, SubscriptionPlan, BillingInvoice

        plan = db_session.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == plan_id
        ).first()
        if not plan:
            raise ValueError(f"Invalid plan ID: {plan_id}")

        current_time = datetime.now(timezone.utc)

        sub = db_session.query(ClinicSubscription).filter(
            ClinicSubscription.staff_id == staff_id
        ).first()

        if sub:
            # Upgrade/renew existing
            sub.plan_id = plan_id
            sub.status = "active"
            days_to_add = 365 if plan.interval == "year" else 30

            sub_end = sub.current_period_end
            if sub_end and sub_end.tzinfo is None:
                sub_end = sub_end.replace(tzinfo=timezone.utc)
            if sub_end and sub_end > current_time:
                sub.current_period_end = sub_end + timedelta(days=days_to_add)
            else:
                sub.current_period_end = current_time + timedelta(days=days_to_add)

            sub.cancel_at_period_end = False
            logger.info(f"Upgraded/renewed subscription for {staff_id} to {plan_id}")
        else:
            # Create new subscription
            days_to_add = 365 if plan.interval == "year" else 30
            sub = ClinicSubscription(
                staff_id=staff_id,
                plan_id=plan_id,
                status="active",
                current_period_end=current_time + timedelta(days=days_to_add),
                stripe_subscription_id=f"sub_{uuid.uuid4().hex[:16]}",
            )
            db_session.add(sub)
            db_session.flush()
            logger.info(f"Created new subscription for {staff_id} on {plan_id}")

        # Generate Invoice
        invoice = BillingInvoice(
            id=f"in_{uuid.uuid4().hex[:16]}",
            subscription_id=sub.id,
            amount_paid=plan.price_inr,
            currency="inr",
            status="paid",
        )
        db_session.add(invoice)
        db_session.commit()

        return {"success": True, "subscription_id": sub.id, "plan_id": plan.id}

    # ─── Subscription Status ─────────────────────────────────
    @staticmethod
    def get_subscription_status(staff_id: str, db_session) -> dict[str, Any]:
        """Get the current subscription state for a user."""
        from db.models import ClinicSubscription, SubscriptionPlan

        sub = db_session.query(ClinicSubscription).filter(
            ClinicSubscription.staff_id == staff_id
        ).first()

        if not sub:
            return {"has_subscription": False, "plan": None, "status": "none"}

        plan = db_session.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == sub.plan_id
        ).first()

        current_time = datetime.now(timezone.utc)
        sub_end = sub.current_period_end
        if sub_end and sub_end.tzinfo is None:
            sub_end = sub_end.replace(tzinfo=timezone.utc)

        is_expired = sub_end < current_time if sub_end else False

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
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "features": plan.features if plan else {},
        }
