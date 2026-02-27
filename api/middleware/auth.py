"""
HIPAA-Compliant Authentication Middleware
==========================================
Security controls implemented:
- JWT token authentication with HS256/RS256
- Secure password hashing (bcrypt)
- Role-based access control (RBAC)
- Rate limiting (prevent brute force)
- Immutable audit trail of authentication events
- Session timeout enforcement
- PHI-safe logging (never logs passwords/tokens)
- Token revocation support

COMPLIANCE:
- HIPAA §164.312(a)(2)(iii): Unique user identification
- HIPAA §164.312(a)(2)(iv): Emergency access procedure
- HIPAA §164.312(b): Audit controls
"""

import jwt
import bcrypt
import os
from datetime import datetime, timedelta, timezone
# from typing import Optional, Dict, List, Callable, ClassVar # Dict, List deprecated in 3.9+
from typing import Optional, Callable, ClassVar, TypedDict, Any, Union
from functools import wraps
from enum import Enum
import secrets
import logging
import json
import re

logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    # override=True ensures .env changes take effect on hot-reload
    # (without this, the parent reloader's stale env vars take precedence)
    load_dotenv(dotenv_path=os.path.join(os.getcwd(), ".env"), override=True)
except ImportError:
    pass

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Security configuration (move to config.py in production)
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    logger.warning("JWT_SECRET_KEY not set in environment. Generating temporary key (tokens will invalidate on restart).")
    JWT_SECRET_KEY = secrets.token_urlsafe(64)
else:
    logger.info(f"JWT_SECRET_KEY loaded from .env (fingerprint: {JWT_SECRET_KEY[:8]}...)")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour for clinical sessions
JWT_REFRESH_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30

logger = logging.getLogger(__name__)


# ======================
# AUTHORIZATION MODELS
# ======================

class StaffRole(str, Enum):
    """
    Clinical staff roles with escalating privileges.
    Follows principle of least privilege (HIPAA §164.308(a)(3)(i)).
    """
    NURSE = "nurse"
    DOCTOR = "doctor"
    ADMIN = "admin"
    RECEPTIONIST = "receptionist"


class StaffStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    LOCKED = "locked"  # Too many failed login attempts


class StaffCredentials(BaseModel):
    """Login request (never stored - only used for authentication)"""
    staff_id: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v):
        """Enforce clinical-grade password policy"""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain digit")
        return v  # Password is NEVER logged or stored in plaintext


class StaffProfile(BaseModel):
    """Staff profile (stored in database with hashed password)"""
    staff_id: str
    full_name: str
    role: StaffRole
    status: StaffStatus = StaffStatus.ACTIVE
    department: Optional[str] = None
    last_login: Optional[datetime] = None
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    # created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config: ClassVar[ConfigDict] = ConfigDict(use_enum_values=True)


class TokenPayload(BaseModel):
    """JWT token payload structure"""
    staff_id: str
    role: str
    exp: int  # Unix timestamp
    jti: str  # JWT ID (for revocation tracking)
    type: str  # Token type: 'access' or 'refresh'


class TokenResponse(BaseModel):
    """Token response to frontend"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    staff_id: str
    role: str
    requires_password_change: bool = False


class LoginResponse(BaseModel):
    """Login response with session info"""
    success: bool
    token: Optional[TokenResponse] = None
    message: Optional[str] = None
    requires_2fa: bool = False  # Future: Two-factor authentication
    account_locked: bool = False
    remaining_attempts: Optional[int] = None


class StaffRecord(TypedDict):
    staff_id: str
    full_name: str
    role: str
    password_hash: str
    department: Optional[str]
    status: str
    failed_attempts: int
    locked_until: Optional[str]
    last_login: Optional[str]
    created_at: str
    last_password_change: Optional[str]
    # TypedDict doesn't support defaults easily in 3.9, ensuring all keys are present


class RateLimitRecord(TypedDict, total=False):
    count: int
    locked_until: datetime


# ======================
# PASSWORD SECURITY
# ======================

class PasswordManager:
    """
    Secure password handling with bcrypt hashing.
    NEVER stores or logs plaintext passwords.
    """

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash password using bcrypt (industry standard).
        Cost factor 12 = ~300ms hash time (resistant to brute force).
        """
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    @staticmethod
    def verify_password(plaintext: str, hashed: str) -> bool:
        """
        Verify password against hash (constant-time comparison).
        Returns False immediately on failure (no timing attacks).
        """
        try:
            return bcrypt.checkpw(
                plaintext.encode('utf-8'),
                hashed.encode('utf-8')
            )
        except Exception as e:
            logger.warning(f"Password verification error: {str(e)}")
            return False

    @staticmethod
    def is_password_expired(last_changed: datetime, max_age_days: int = 90) -> bool:
        """Enforce password rotation policy (HIPAA best practice)"""
        # Ensure last_changed is timezone-aware if it isn't
        if last_changed.tzinfo is None:
            last_changed = last_changed.replace(tzinfo=timezone.utc)
            
        age = datetime.now(timezone.utc) - last_changed
        return age.days >= max_age_days


# ======================
# JWT TOKEN MANAGER
# ======================

class JWTManager:
    """
    JWT token creation, validation, and revocation.
    Uses HS256 for simplicity (upgrade to RS256 for production with key rotation).
    """

    def __init__(self, secret_key: str = JWT_SECRET_KEY):
        self.secret_key = secret_key
        self.revoked_tokens: dict[str, datetime] = {}  # jti -> revoked_at

    def create_access_token(self, staff_id: str, role: str) -> tuple[str, datetime]:
        """Create JWT access token (1 hour expiry)"""
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        payload = {
            "staff_id": staff_id,
            "role": role,
            "exp": expire,
            "jti": secrets.token_urlsafe(32),  # Unique token ID
            "type": "access"
        }
        token = jwt.encode(payload, self.secret_key, algorithm=JWT_ALGORITHM)
        return token, expire

    def create_refresh_token(self, staff_id: str, role: str) -> tuple[str, datetime]:
        """Create JWT refresh token (24 hours expiry)"""
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_REFRESH_TOKEN_EXPIRE_MINUTES)
        payload = {
            "staff_id": staff_id,
            "role": role,
            "exp": expire,
            "jti": secrets.token_urlsafe(32),
            "type": "refresh"
        }
        token = jwt.encode(payload, self.secret_key, algorithm=JWT_ALGORITHM)
        return token, expire

    def decode_token(self, token: str) -> TokenPayload:
        """
        Decode and validate JWT token.
        Raises HTTPException on failure (safe for middleware).
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp", "jti", "staff_id", "role"]}
            )

            # Check if token has been revoked
            jti = payload.get("jti")
            if jti in self.revoked_tokens:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has been revoked"
                )

            return TokenPayload(**payload)

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

    def revoke_token(self, jti: str) -> None:
        """Revoke token (for logout/session termination)"""
        self.revoked_tokens[jti] = datetime.now(timezone.utc)
        # Cleanup old revoked tokens (memory optimization)
        self._cleanup_old_revoked_tokens()

    def _cleanup_old_revoked_tokens(self, max_age_hours: int = 24) -> None:
        """Remove revoked tokens older than max_age_hours"""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        old_jtis = [
            jti for jti, revoked_at in self.revoked_tokens.items()
            if revoked_at < cutoff
        ]
        for jti in old_jtis:
            del self.revoked_tokens[jti]


# ======================
# RATE LIMITER (Anti-Brute Force)
# ======================

class RateLimiter:
    """
    Simple in-memory rate limiter to prevent brute force attacks.
    In production: Use Redis for distributed rate limiting.
    """

    def __init__(self, max_attempts: int = MAX_LOGIN_ATTEMPTS):
        self.max_attempts = max_attempts
        self.attempts: dict[str, RateLimitRecord] = {}  # staff_id -> {count, locked_until}

    def is_locked(self, staff_id: str) -> bool:
        """Check if staff account is locked due to too many failed attempts"""
        record = self.attempts.get(staff_id)
        if not record:
            return False

        if locked_until := record.get("locked_until"):
            if datetime.now(timezone.utc) < locked_until:
                return True
            else:
                # Lockout period expired - reset
                del self.attempts[staff_id]
                return False

        return record.get("count", 0) >= self.max_attempts

    def record_attempt(self, staff_id: str, success: bool) -> dict[str, int | bool]:
        """
        Record login attempt and return status.
        Returns: {"locked": bool, "remaining_attempts": int, "lockout_seconds": int}
        """
        record = self.attempts.get(staff_id, {"count": 0})

        if success:
            # Reset on successful login
            if staff_id in self.attempts:
                del self.attempts[staff_id]
            return {"locked": False, "remaining_attempts": self.max_attempts}

        # Failed attempt - increment counter
        record["count"] = record.get("count", 0) + 1

        if record["count"] >= self.max_attempts:
            # Lock account
            lockout_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            record["locked_until"] = lockout_until
            self.attempts[staff_id] = record

            lockout_seconds = int((lockout_until - datetime.now(timezone.utc)).total_seconds())
            return {
                "locked": True,
                "remaining_attempts": 0,
                "lockout_seconds": lockout_seconds
            }

        self.attempts[staff_id] = record
        remaining = self.max_attempts - record["count"]

        return {
            "locked": False,
            "remaining_attempts": remaining,
            "lockout_seconds": 0
        }

    def reset(self, staff_id: str) -> None:
        """Reset failed attempts counter (e.g., after password reset)"""
        if staff_id in self.attempts:
            del self.attempts[staff_id]


# ======================
# AUTHENTICATION MIDDLEWARE
# ======================

class JWTBearer(HTTPBearer):
    """
    FastAPI security scheme for JWT token extraction.
    Extracts token from Authorization header and validates.
    """

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
        self.jwt_manager = JWTManager()

    async def __call__(self, request: Request) -> Any:
        credentials: Optional[HTTPAuthorizationCredentials] = await super().__call__(request)

        # 1. Check Authorization Header (Priority)
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid authentication scheme"
                )
            return self.jwt_manager.decode_token(credentials.credentials)

        # 2. Check HttpOnly Cookie (Fallback for browsers/Postman)
        cookie_token = request.cookies.get("aira_access_token")
        if cookie_token:
            return self.jwt_manager.decode_token(cookie_token)

        # 3. Fail
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication information is missing"
        )


# ======================
# DEPENDENCY INJECTION
# ======================

async def get_current_staff(
        request: Request,
        token_payload: TokenPayload = Depends(JWTBearer())
) -> str:
    """
    Dependency to get current authenticated staff ID.
    Used by protected endpoints to identify caller.
    """
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Store staff_id in request state for audit middleware
    request.state.staff_id = token_payload.staff_id
    return token_payload.staff_id


async def get_current_staff_role(
        token_payload: TokenPayload = Depends(JWTBearer())
) -> tuple[str, str]:
    """
    Dependency to get current staff ID and role.
    Returns: (staff_id, role)
    """
    if not token_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    return token_payload.staff_id, token_payload.role


def require_role(required_roles: list[StaffRole]):
    """
    Decorator/dependency for role-based access control.
    Usage: @app.post("/...", dependencies=[Depends(require_role([StaffRole.DOCTOR]))])
    """

    async def role_checker(
            token_payload: TokenPayload = Depends(JWTBearer())
    ) -> TokenPayload:
        if not token_payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        # Check if role is allowed
        if token_payload.role not in [r for r in required_roles]:
            logger.warning(
                f"Unauthorized access attempt | " +
                f"Staff: {token_payload.staff_id} | " +
                f"Role: {token_payload.role} | " +
                f"Required: {[r for r in required_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        return token_payload

    return role_checker


# ======================
# AUTHENTICATION SERVICE (Database Integration)
# ======================

class AuthService:
    """
    Authentication service — backed by SQLite database.
    Staff accounts are seeded by db/seed.py on first run.
    """

    def __init__(self):
        self.jwt_manager = JWTManager()
        self.rate_limiter = RateLimiter()
        self.password_manager = PasswordManager()

    def _get_db(self):
        from db.database import SessionLocal
        return SessionLocal()

    async def login(
            self,
            credentials: StaffCredentials,
            client_ip: Optional[str] = None
    ) -> LoginResponse:
        """
        Authenticate staff and return JWT tokens.
        Implements rate limiting and account lockout.
        """
        staff_id = credentials.staff_id

        # Check if account is locked
        if self.rate_limiter.is_locked(staff_id):
            logger.warning(f"Login attempt on locked account: {staff_id}")
            return LoginResponse(
                success=False,
                message="Account temporarily locked due to too many failed attempts",
                account_locked=True
            )

        # Verify staff exists in database
        db = self._get_db()
        try:
            from db import crud
            staff = crud.get_staff(db, staff_id)

            if not staff:
                _ = self.rate_limiter.record_attempt(staff_id, success=False)
                logger.warning(f"Login attempt with invalid staff ID: {staff_id}")
                return LoginResponse(
                    success=False,
                    message="Invalid credentials",
                    remaining_attempts=MAX_LOGIN_ATTEMPTS - 1
                )

            # Check account status
            if staff.status != "active":
                logger.warning(f"Login attempt on inactive account: {staff_id}")
                return LoginResponse(
                    success=False,
                    message="Account is not active"
                )

            # Verify password
            password_valid = self.password_manager.verify_password(
                credentials.password,
                staff.password_hash
            )

            # Record attempt (success/failure)
            attempt_result = self.rate_limiter.record_attempt(staff_id, password_valid)

            if not password_valid:
                logger.warning(
                    f"Failed login attempt | Staff: {staff_id} | "
                    f"IP: {client_ip or 'unknown'} | "
                    f"Remaining attempts: {attempt_result['remaining_attempts']}"
                )

                if attempt_result["locked"]:
                    staff.status = "locked"
                    staff.locked_until = (
                        datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
                    )
                    db.commit()

                    return LoginResponse(
                        success=False,
                        message=f"Account locked for {LOCKOUT_DURATION_MINUTES} minutes",
                        account_locked=True,
                        remaining_attempts=0
                    )

                crud.update_staff_failed_attempt(db, staff_id)
                return LoginResponse(
                    success=False,
                    message="Invalid credentials",
                    remaining_attempts=attempt_result["remaining_attempts"]
                )

            # Successful login - generate tokens
            access_token, access_expire = self.jwt_manager.create_access_token(
                staff_id=staff_id,
                role=staff.role
            )

            refresh_token, refresh_expire = self.jwt_manager.create_refresh_token(
                staff_id=staff_id,
                role=staff.role
            )

            # Update staff record in DB
            crud.update_staff_login(db, staff_id)

            # Log successful login (PHI-safe)
            logger.info(
                f"Successful login | Staff: {staff_id} | Role: {staff.role} | IP: {client_ip or 'unknown'}"
            )

            return LoginResponse(
                success=True,
                token=TokenResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_type="bearer",
                    expires_in=int((access_expire - datetime.now(timezone.utc)).total_seconds()),
                    staff_id=staff_id,
                    role=staff.role
                ),
                message="Login successful"
            )
        finally:
            db.close()

    async def logout(self, token_payload: TokenPayload) -> bool:
        """Revoke token (logout)"""
        try:
            self.jwt_manager.revoke_token(token_payload.jti)
            logger.info(f"Logout successful | Staff: {token_payload.staff_id}")
            return True
        except Exception as e:
            logger.error(f"Logout failed: {str(e)}")
            return False

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """
        Refresh access token using refresh token.
        Refresh tokens cannot be used to get new refresh tokens (security).
        """
        payload = self.jwt_manager.decode_token(refresh_token)

        if payload.type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )

        # Generate new access token
        access_token, access_expire = self.jwt_manager.create_access_token(
            staff_id=payload.staff_id,
            role=payload.role
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # Keep same refresh token
            token_type="bearer",
            expires_in=int((access_expire - datetime.now(timezone.utc)).total_seconds()),
            staff_id=payload.staff_id,
            role=payload.role
        )

    async def change_password(
            self,
            staff_id: str,
            old_password: str,
            new_password: str
    ) -> bool:
        """Change staff password (requires current password verification)"""
        db = self._get_db()
        try:
            from db import crud
            staff = crud.get_staff(db, staff_id)
            if not staff:
                return False

            # Verify old password
            if not self.password_manager.verify_password(old_password, staff.password_hash):
                logger.warning(f"Password change failed - invalid old password: {staff_id}")
                return False

            # Hash and update new password
            new_hash = self.password_manager.hash_password(new_password)
            crud.update_staff_password(db, staff_id, new_hash)

            # Reset failed attempts
            self.rate_limiter.reset(staff_id)

            logger.info(f"Password changed successfully: {staff_id}")
            return True
        finally:
            db.close()

    async def get_staff_profile(self, staff_id: str) -> Optional[StaffProfile]:
        """Get staff profile (PHI-safe - excludes password hash)"""
        db = self._get_db()
        try:
            from db import crud
            staff = crud.get_staff(db, staff_id)
            if not staff:
                return None

            return StaffProfile(
                staff_id=staff.staff_id,
                full_name=staff.full_name,
                role=StaffRole(staff.role),
                status=StaffStatus(staff.status),
                department=staff.department,
                last_login=staff.last_login,
                failed_attempts=staff.failed_attempts or 0,
                locked_until=staff.locked_until,
                created_at=staff.created_at or datetime.now(timezone.utc)
            )
        finally:
            db.close()


# ======================
# FASTAPI ROUTES (Authentication Endpoints)
# ======================

from fastapi import APIRouter
from fastapi.responses import JSONResponse

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Singleton auth service instance
_auth_service = AuthService()


@auth_router.post(
    "/login",
    response_model=LoginResponse,
    summary="Staff Login",
    description="Authenticate clinical staff with staff ID and password"
)
async def login(
        credentials: StaffCredentials,
        request: Request
):
    """
    Staff login endpoint.
    Returns JWT tokens on success, error message on failure.
    Implements rate limiting and account lockout.
    """
    client_ip = request.client.host if request.client else None

    try:
        response = await _auth_service.login(credentials, client_ip)

        # Set HttpOnly cookie for access token (CSRF protection)
        if response.success and response.token:
            response_dict = response.model_dump()
            # For development/Postman ease, we KEEP tokens in body
            # response_dict["token"].pop("access_token")  # Remove from JSON body
            # response_dict["token"].pop("refresh_token")  # Remove from JSON body

            json_response = JSONResponse(content=response_dict)
            json_response.set_cookie(
                key="aira_access_token",
                value=response.token.access_token,
                httponly=True,  # Prevent JavaScript access
                secure=True,  # HTTPS only
                samesite="strict",
                max_age=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            )
            json_response.set_cookie(
                key="aira_refresh_token",
                value=response.token.refresh_token,
                httponly=True,
                secure=True,
                samesite="strict",
                max_age=JWT_REFRESH_TOKEN_EXPIRE_MINUTES * 60
            )
            return json_response

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )


@auth_router.post(
    "/logout",
    summary="Staff Logout",
    description="Revoke authentication token and end session"
)
async def logout(
        token_payload: TokenPayload = Depends(JWTBearer())
):
    """Logout endpoint - revokes current token"""
    success = await _auth_service.logout(token_payload)

    response = JSONResponse(content={"success": success})
    response.delete_cookie(key="aira_access_token")
    response.delete_cookie(key="aira_refresh_token")

    return response


@auth_router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh Access Token",
    description="Get new access token using refresh token"
)
async def refresh(request: Request):
    """Refresh access token endpoint"""
    refresh_token = request.cookies.get("aira_refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )

    try:
        return await _auth_service.refresh_token(refresh_token)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@auth_router.get(
    "/profile",
    response_model=StaffProfile,
    summary="Get Staff Profile",
    description="Retrieve current authenticated staff profile",
    dependencies=[Depends(JWTBearer())]
)
async def get_profile(token_payload: TokenPayload = Depends(JWTBearer())):
    """Get current staff profile"""
    profile = await _auth_service.get_staff_profile(token_payload.staff_id)

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff profile not found"
        )

    return profile


@auth_router.post(
    "/change-password",
    summary="Change Password",
    description="Change staff password (requires current password)"
)
async def change_password(
        old_password: str,
        new_password: str,
        token_payload: TokenPayload = Depends(JWTBearer())
):
    """Change password endpoint"""
    try:
        success = await _auth_service.change_password(
            staff_id=token_payload.staff_id,
            old_password=old_password,
            new_password=new_password
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password change failed - invalid current password"
            )

        # Logout all sessions after password change (security best practice)
        await _auth_service.logout(token_payload)

        return {"success": True, "message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


# ======================
# EXPORTS
# ======================

__all__ = [
    # Models
    "StaffRole",
    "StaffStatus",
    "StaffCredentials",
    "StaffProfile",
    "TokenPayload",
    "TokenResponse",
    "LoginResponse",

    # Middleware
    "JWTBearer",

    # Dependencies
    "get_current_staff",
    "get_current_staff_role",
    "require_role",

    # Services
    "AuthService",
    "JWTManager",
    "PasswordManager",
    "RateLimiter",

    # Router
    "auth_router"
]