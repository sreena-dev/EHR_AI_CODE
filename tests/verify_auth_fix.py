import sys
import os
import asyncio
from datetime import datetime, timedelta

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.middleware.auth import AuthService, TokenPayload, JWTManager, StaffRole

async def verify_auth_fix():
    print("Verifying Auth Middleware Fixes...")
    
    auth_service = AuthService()
    jwt_manager = JWTManager()
    
    # 1. Verify TokenPayload has 'type' field
    print("\n[1] Verifying TokenPayload model...")
    try:
        payload = TokenPayload(
            staff_id="test_user",
            role="nurse",
            exp=int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
            jti="test_jti",
            type="access"
        )
        print("  - SUCCESS: TokenPayload accepts 'type' field.")
        if payload.type == "access":
            print("  - SUCCESS: 'type' field value is correct.")
        else:
            print(f"  - FAILURE: 'type' field value mismatch: {payload.type}")
    except Exception as e:
        print(f"  - FAILURE: TokenPayload error: {e}")
        return

    # 2. Verify refresh_token method (Fix for AttributeError)
    print("\n[2] Verifying AuthService.refresh_token (AttributeError fix)...")
    
    # Create a valid refresh token
    refresh_token, _ = jwt_manager.create_refresh_token("nurse_001", StaffRole.NURSE.value)
    
    try:
        # Note: We are testing the service method, not the endpoint, so no cookie needed here
        response = await auth_service.refresh_token(refresh_token)
        print("  - SUCCESS: refresh_token executed without runtime error.")
        if response.access_token:
            print("  - SUCCESS: access_token generated.")
        else:
             print("  - FAILURE: No access_token in response.")
    except Exception as e:
        print(f"  - FAILURE: refresh_token raised exception: {e}")
        # explicit check for the specific error
        if "'TokenPayload' object has no attribute 'get'" in str(e):
             print("  - CRITICAL FAILURE: The specific AttributeError still exists!")
        return

    print("\nVerification Complete.")

if __name__ == "__main__":
    asyncio.run(verify_auth_fix())
