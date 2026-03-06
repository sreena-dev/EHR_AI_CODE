from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from db.database import get_db
from api.middleware.auth import get_current_staff
from api.services.billing_service import BillingService
from db import crud

class RequireSubscription:
    """
    FastAPI Dependency to restrict endpoints based on subscription tiers.
    Usage:
        @router.get("/advanced-analytics")
        def get_analytics(staff_id = Depends(RequireSubscription(min_tier="plan_elite"))):
            ...
    """
    def __init__(self, min_tier="plan_pro"):
        self.min_tier = min_tier

    def __call__(self, staff_id: str = Depends(get_current_staff), db: Session = Depends(get_db)):
        # Optionally allow Admin to bypass
        roles = crud.get_staff_roles(db, staff_id)
        if "admin" in roles:
            return staff_id

        # Fetch subscription status
        sub_data = BillingService.get_subscription_status(staff_id, db)
        
        if not sub_data["has_subscription"] or sub_data["status"] != "active":
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Active subscription required to access this feature."
            )

        active_plan_id = sub_data["plan_id"]

        # Basic hierarchy: elite > pro
        tiers = {"plan_pro": 1, "plan_elite": 2}
        
        user_level = tiers.get(active_plan_id, 0)
        required_level = tiers.get(self.min_tier, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"This feature requires the {self.min_tier.replace('plan_', '').capitalize()} plan. You are currently on the {active_plan_id.replace('plan_', '').capitalize()} plan."
            )

        return staff_id
