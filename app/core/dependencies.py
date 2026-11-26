"""
SmartResolve AI - FastAPI Dependency Injectors
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token
from app.repositories import sessions
from app.repositories.user import get_user_by_username

# tokenUrl just tells Swagger where the login form is; the actual
# token extraction from the Authorization header is automatic.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Validate the Bearer token and return the active user dict.
    Raises 401 for missing / invalid tokens, 403 for inactive accounts.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    if payload.get("token_type") != "access":
        raise credentials_exception

    username: str = payload.get("sub")
    if not username:
        raise credentials_exception

    user = get_user_by_username(username)
    if user is None or not sessions.active(user["id"], payload.get("sid")):
        raise credentials_exception

    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated.",
        )

    return user


def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Extend get_current_user — also requires the admin flag.
    Raises 403 for non-admin users.
    """
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user
