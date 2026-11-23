"""
SmartResolve AI - Auth Routes (Layer 1)
Exposes: POST /auth/register, POST /auth/login, POST /auth/refresh, GET /auth/me
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm

from app.controllers.auth_controller import (
    handle_login,
    handle_refresh,
    handle_register,
)
from app.core.dependencies import get_current_user
from app.middleware.rate_limiter import limiter
from app.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserPublicResponse,
    UserRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ------------------------------------------------------------------
# POST /auth/register
# ------------------------------------------------------------------
@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, body: UserRegisterRequest):
    """
    Create a new citizen account.
    Rate-limited to 5 registrations per minute per IP.
    """
    return handle_register(body)


# ------------------------------------------------------------------
# POST /auth/login  (JSON body — used by our frontend)
# ------------------------------------------------------------------
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: UserLoginRequest):
    """
    Exchange credentials for JWT access + refresh tokens.
    Rate-limited to 10 attempts per minute per IP.
    """
    return handle_login(body)


# ------------------------------------------------------------------
# POST /auth/token  (OAuth2 form-data — powers Swagger Authorize button)
# ------------------------------------------------------------------
@router.post("/token", response_model=TokenResponse, include_in_schema=False)
def token_form(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 password flow for Swagger UI."""
    return handle_login(UserLoginRequest(
        username=form_data.username,
        password=form_data.password,
    ))


# ------------------------------------------------------------------
# POST /auth/refresh
# ------------------------------------------------------------------
@router.post("/refresh")
def refresh(body: RefreshTokenRequest):
    """Issue a new access token from a valid refresh token."""
    return handle_refresh(body)


# ------------------------------------------------------------------
# GET /auth/me
# ------------------------------------------------------------------
@router.get("/me", response_model=UserPublicResponse)
def me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's public profile."""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name") or "",
        "is_admin": bool(current_user.get("is_admin", False)),
    }
