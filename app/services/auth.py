"""
SmartResolve AI - Authentication Service (Layer 3)
Business logic for register, login, and token refresh.
"""

from __future__ import annotations

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.repositories.user import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    update_user_profile,
)


def register_user(
    username: str,
    email: str,
    password: str,
    full_name: str = "",
    phone: str = None,
) -> dict:
    """
    Create a new citizen account.
    Raises ValueError for duplicate username / email.
    """
    if get_user_by_username(username):
        raise ValueError("Username is already taken.")

    if get_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    hashed = hash_password(password)
    user_id = create_user(username, email, hashed, full_name, phone)

    return {"id": user_id, "username": username, "email": email}


def update_profile(user_id: int, **kwargs) -> dict:
    """Update profile fields; return the refreshed user dict."""
    update_user_profile(user_id, **kwargs)
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found.")
    return user


def login_user(username: str, password: str) -> dict:
    """
    Authenticate and return access + refresh tokens.
    Raises ValueError for invalid credentials.
    """
    user = get_user_by_username(username)

    # Use a generic message to avoid user-enumeration
    if not user or not verify_password(password, user["hashed_password"]):
        raise ValueError("Invalid username or password.")

    if not user.get("is_active", False):
        raise ValueError("Your account is deactivated. Contact support.")

    access_token = create_access_token({"sub": username})
    refresh_token = create_refresh_token({"sub": username})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def refresh_access_token(refresh_token: str) -> dict:
    """
    Issue a new access token from a valid refresh token.
    Raises ValueError for invalid / expired refresh tokens.
    """
    payload = decode_token(refresh_token)

    if payload is None or payload.get("token_type") != "refresh":
        raise ValueError("Invalid or expired refresh token.")

    username = payload.get("sub")
    if not username:
        raise ValueError("Malformed token payload.")

    user = get_user_by_username(username)
    if not user:
        raise ValueError("User not found.")

    access_token = create_access_token({"sub": username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
