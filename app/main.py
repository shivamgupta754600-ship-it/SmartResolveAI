"""
SmartResolve AI - FastAPI Application Entry Point
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.middleware.request_limits import RequestLimits
from app.middleware.rate_limiter import limiter
from app.routes.case_routes import router as case_router
from app.routes.auth_routes import router as auth_router
from app.routes.grievance_routes import router as grievance_router


# ======================================================================
# CREATE APPLICATION
# ======================================================================

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-powered grievance classification and department routing system. "
        "Residents can submit and track cases with private receipts. Staff use scoped MFA sessions."
    ),
    version=settings.APP_VERSION,
    # Point Swagger's Authorize button at the OAuth2 form-data endpoint
    swagger_ui_oauth2_redirect_url="/auth/token",
)


# ======================================================================
# RATE LIMITING  (global default + per-route decorators)
# ======================================================================

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def redact_case_validation(request: Request, error: RequestValidationError):
    if request.url.path.startswith("/auth/"):
        return JSONResponse({"detail": "Invalid account request."}, status_code=422,
                            headers={"Cache-Control": "no-store"})
    if request.url.path == "/cases" or request.url.path.startswith("/cases/"):
        return JSONResponse({"detail": "invalid_input"}, status_code=422,
                            headers={"Cache-Control": "no-store"})
    if request.url.path.startswith("/grievances/"):
        return JSONResponse({"detail": "Invalid grievance request."}, status_code=422)
    return await request_validation_exception_handler(request, error)


@app.middleware("http")
async def privacy_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.split("/")[1] in {"auth", "cases", "grievances"}:
        response.headers["Cache-Control"] = "no-store"
    return response


# ======================================================================
# CORS MIDDLEWARE
# Allow only the origins configured in .env / config.
# Never allow * in production.
# ======================================================================

app.add_middleware(RequestLimits)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=600,
)


# ======================================================================
# ROUTERS
# ======================================================================

app.include_router(auth_router)
app.include_router(grievance_router)
app.include_router(case_router)


# ======================================================================
# SERVE FRONTEND  (optional — works when frontend/ directory exists)
# Navigate to http://localhost:8000/app/ to open the web UI.
# ======================================================================

try:
    app.mount(
        "/app",
        StaticFiles(directory="frontend", html=True),
        name="frontend",
    )
except RuntimeError:
    pass  # frontend/ not present — skip static serving


# ======================================================================
# SYSTEM ENDPOINTS
# ======================================================================

@app.get("/", tags=["System"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "frontend": "/app",
    }


@app.get("/health", tags=["System"])
def health():
    """Lightweight liveness probe for load balancers / monitors."""
    return {"status": "healthy", "version": settings.APP_VERSION}
