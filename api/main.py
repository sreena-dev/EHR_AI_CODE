# Reload trigger: 2026-02-22T09:50:00
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .middleware.hipaa_audit import HIPAASafeAuditMiddleware
from .routes.nurse_station import router as nurse_router
from .middleware.auth import auth_router
from .routes.doctor_consult import router as doctor_router
from .routes.admin import router as admin_router
from .routes.patient_auth import router as patient_auth_router
from core.workflow import WorkflowError
import logging
import os
from datetime import datetime, timezone

# ── CORS origins from env var ────────────────────────────────────────
# Local dev defaults; in production set ALLOWED_ORIGINS env var on Render
# e.g. "https://aira-healthcare.vercel.app,https://your-custom-domain.com"
_DEFAULT_ORIGINS = "http://localhost:3000,http://localhost:5173"
_raw_origins = os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# Configure logging — stdout on cloud (Render captures it), file locally if logs/ exists
_log_handlers: list[logging.Handler] = [logging.StreamHandler()]
try:
    os.makedirs("logs", exist_ok=True)
    _log_handlers.append(logging.FileHandler("logs/api.log"))
except OSError:
    pass  # Render / read-only FS — stdout logging only (Render captures all output)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=_log_handlers
)

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="AIRA Healthcare Workflow API",
        description="HIPAA-compliant clinical workflow engine (100% open-source)",
        version="1.0.0",
        docs_url="/docs",  # Disable in prod: set to None
        redoc_url=None  # Disable ReDoc in prod
    )

    # Global exception handler — prevents tracebacks in terminal
    @app.exception_handler(WorkflowError)
    async def workflow_error_handler(request: Request, exc: WorkflowError):
        logger.error(f"Workflow error: {str(exc)}")
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc)}
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error: {type(exc).__name__}: {str(exc)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    # Security headers
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response

    # HIPAA audit middleware (MUST be first)
    app.add_middleware(HIPAASafeAuditMiddleware)

    # CORS — origins from ALLOWED_ORIGINS env var (see .env.example)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from .routes.patient_auth import router as patient_auth_router
    from .routes.billing import router as billing_router

    # Register routers
    app.include_router(nurse_router)
    app.include_router(auth_router)
    app.include_router(doctor_router)
    app.include_router(admin_router)
    app.include_router(patient_auth_router)
    app.include_router(billing_router)

    # Initialize database (create tables + seed default data)
    from db.database import init_db
    init_db()
    logger.info("Database initialized successfully")

    @app.get("/health")
    async def health_check():
        """Lightweight health check for load balancers"""
        return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

    return app


# Entry point for uvicorn
app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        workers=1,  # Single worker for SQLite development (avoids multi-process crash loop)
        log_level="info",
        reload=False  # NEVER enable reload in production
    )# Touch for reload
