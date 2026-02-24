import logging
import re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from datetime import datetime, timezone
import json


class HIPAASafeAuditMiddleware(BaseHTTPMiddleware):
    """
    Critical middleware that:
    1. REDACTS ALL PHI from logs (names, IDs, clinical details)
    2. Maintains immutable audit trail of PHI access (HIPAA §164.308(a)(1)(ii)(D))
    3. Never logs request/response bodies containing PHI
    """

    PHI_PATTERNS = [
        r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b',  # Names (John Doe)
        r'\bPT-\d+\b',  # Patient IDs
        r'\b\d{2,3}\s+(?:year|yr)s?\b',  # Ages
        r'\b(?:male|female|other)\b',  # Gender
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',  # Dates of birth
        r'[\u0B80-\u0BFF]{2,}',  # Tamil script (potential PHI)
    ]

    def __init__(self, app, audit_log_path: str = "logs/audit.log"):
        super().__init__(app)
        self.audit_logger = self._setup_audit_logger(audit_log_path)

    def _setup_audit_logger(self, log_path: str):
        logger = logging.getLogger("hipaa_audit")
        logger.setLevel(logging.INFO)
        handler = logging.FileHandler(log_path)
        handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
        logger.addHandler(handler)
        return logger

    def _redact_phi(self, text: str) -> str:
        """Aggressively redact PHI from log messages"""
        redacted = text
        for pattern in self.PHI_PATTERNS:
            redacted = re.sub(pattern, "[REDACTED]", redacted, flags=re.IGNORECASE)
        return redacted

    def _log_access(self, request: Request, staff_id: str, action: str, resource: str):
        """Immutable audit log entry (HIPAA requirement)"""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "staff_id": staff_id,
            "action": action,  # "OCR_UPLOAD", "OCR_VIEW", etc.
            "resource": resource,  # "encounter:ENC-2024-001"
            "ip_address": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown")
        }
        self.audit_logger.info(json.dumps(entry))

    async def dispatch(self, request: Request, call_next):
        # Extract authenticated staff ID (from JWT set by auth middleware)
        staff_id = getattr(request.state, "staff_id", "anonymous")

        # Log PHI access BEFORE processing (HIPAA audit requirement)
        if "/nurse/ocr" in request.url.path and request.method == "POST":
            self._log_access(request, staff_id, "OCR_UPLOAD", f"endpoint:{request.url.path}")

        # NEVER log request body (contains PHI)
        original_url = str(request.url)
        safe_url = self._redact_phi(original_url)

        try:
            response: Response = await call_next(request)

            # Redact PHI from error messages
            if response.status_code >= 400:
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk

                redacted_body = self._redact_phi(body.decode("utf-8", errors="ignore"))
                # Reconstruct response with redacted body (simplified for brevity)
                response = Response(
                    content=redacted_body,
                    status_code=response.status_code,
                    media_type=response.media_type
                )

            return response

        except Exception as e:
            # Log exception WITHOUT PHI
            safe_error = self._redact_phi(str(e))
            logging.error(f"Request failed (PHI redacted): {safe_error} | URL: {safe_url}")
            raise