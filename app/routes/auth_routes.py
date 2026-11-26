"""
SmartResolve AI - Auth Routes (Layer 1)
Exposes: POST /auth/register, POST /auth/login, POST /auth/refresh, GET /auth/me
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.services import phone_verification
from app.schemas.auth import OTPCheck, OTPRequest, VerifiedNumber
from app.controllers.auth_controller import (
    handle_login,
    handle_refresh,
    handle_register,
    handle_update_profile,
)
from app.core.security import decode_token
from app.repositories import sessions
from app.core.dependencies import get_current_user, oauth2_scheme
from app.middleware.rate_limiter import limiter
from app.schemas.auth import (
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserPublicResponse,
    UserRegisterRequest,
    UserUpdateProfileRequest,
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
@limiter.limit("10/minute")
def token_form(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
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
    has_address = bool(current_user.get("city") or current_user.get("address"))
    has_phone = bool(current_user.get("phone"))
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "full_name": current_user.get("full_name") or "",
        "is_admin": bool(current_user.get("is_admin", False)),
        "phone": current_user.get("phone"),
        "address": current_user.get("address"),
        "city": current_user.get("city"),
        "state": current_user.get("state"),
        "pincode": current_user.get("pincode"),
        "profile_complete": has_address and has_phone,
    }


# ------------------------------------------------------------------
# PUT /auth/profile
# ------------------------------------------------------------------
@router.put("/profile", response_model=UserPublicResponse)
def update_profile(
    body: UserUpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile fields."""
    if body.phone is not None and body.phone != current_user.get("phone"):
        raise HTTPException(409, "Verify a new mobile number in the resident portal.")
    body = body.model_copy(update={"phone": None})
    updated = handle_update_profile(current_user["id"], body)
    has_address = bool(updated.get("city") or updated.get("address"))
    has_phone = bool(updated.get("phone"))
    return {
        "id": updated["id"],
        "username": updated["username"],
        "email": updated["email"],
        "full_name": updated.get("full_name") or "",
        "is_admin": bool(updated.get("is_admin", False)),
        "phone": updated.get("phone"),
        "address": updated.get("address"),
        "city": updated.get("city"),
        "state": updated.get("state"),
        "pincode": updated.get("pincode"),
        "profile_complete": has_address and has_phone,
    }

@router.get("/registration-settings")
def registration_settings(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"verification_required": settings.PHONE_VERIFICATION_REQUIRED}


def require_verification_enabled():
    if not settings.PHONE_VERIFICATION_REQUIRED:
        raise HTTPException(404, "Mobile verification is currently disabled.")


@router.post("/otp/request", dependencies=[Depends(require_verification_enabled)])
@limiter.limit("5/minute")
def request_registration_code(request: Request, body: OTPRequest):
    return phone_verification.issue(body)


@router.post("/phone/request", dependencies=[Depends(require_verification_enabled)])
@limiter.limit("5/minute")
def request_phone_change(request: Request, body: OTPRequest, user: dict = Depends(get_current_user)):
    return phone_verification.issue(body, user["id"])


@router.post("/otp/verify", dependencies=[Depends(require_verification_enabled)])
@limiter.limit("15/minute")
def verify_code(request: Request, response: Response, body: OTPCheck):
    response.headers["Cache-Control"] = "no-store"
    return phone_verification.verify(body)


@router.post("/phone/confirm", dependencies=[Depends(require_verification_enabled)])
def confirm_phone(body: VerifiedNumber, user: dict = Depends(get_current_user)):
    return phone_verification.change_phone(body, user["id"])

@router.post("/logout", status_code=204)
def logout(token: str = Depends(oauth2_scheme)):
    claims = decode_token(token)
    if claims and claims.get("sid"):
        sessions.revoke(claims["sid"])
    return Response(status_code=204)
