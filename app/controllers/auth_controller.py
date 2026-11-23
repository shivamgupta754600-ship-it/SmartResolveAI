"""
SmartResolve AI - Auth Controller (Layer 2)
Translates HTTP requests → service calls → HTTP responses.
"""

from __future__ import annotations

from fastapi import HTTPException, status

from app.schemas.auth import (
    RefreshTokenRequest,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.services.auth import login_user, refresh_access_token, register_user


def handle_register(request: UserRegisterRequest) -> dict:
    try:
        return register_user(
            username=request.username,
            email=str(request.email),
            password=request.password,
            full_name=request.full_name,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except Exception as error:
        print("Registration error:", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )


def handle_login(request: UserLoginRequest) -> dict:
    try:
        return login_user(
            username=request.username,
            password=request.password,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as error:
        print("Login error:", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again.",
        )


def handle_refresh(request: RefreshTokenRequest) -> dict:
    try:
        return refresh_access_token(request.refresh_token)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        )
