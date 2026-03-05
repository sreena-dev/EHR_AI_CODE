# Reload trigger: 2026-02-22T09:50:00
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from .middleware.hipaa_audit import HIPAASafeAuditMiddleware
from .routes.nurse_station import router as nurse_router
from .middleware.auth import auth_router
from .routes.doctor_consult import router as doctor_router
from .routes.admin import router as admin_router
from core.workflow import WorkflowError
import logging
from datetime import datetime, timezone

# Configure production logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/api.log"),
        logging.StreamHandler()  # Also log to console for Docker
    ]
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

    # CORS (restrict to clinic tablet IPs in production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://clinic-tablet.local"],  # LOCK DOWN IN PROD
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(nurse_router)
    app.include_router(auth_router)
    app.include_router(doctor_router)
    app.include_router(admin_router)

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
        workers=2,  # Reduced for development to avoid OOM with heavy models
        log_level="info",
        reload=False  # NEVER enable reload in production
    )# Touch for reload
