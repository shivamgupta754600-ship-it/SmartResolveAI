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
    UserUpdateProfileRequest,
)
from app.services.auth import login_user, refresh_access_token, register_user, update_profile


def handle_register(request: UserRegisterRequest) -> dict:
    try:
        return register_user(
            username=request.username,
            email=str(request.email),
            password=request.password,
            full_name=request.full_name,
            phone=request.phone,
            phone_proof=request.phone_proof,
        )
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except Exception as error:
        print("Registration error:", type(error).__name__)
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
        print("Login error:", type(error).__name__)
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


def handle_update_profile(user_id: int, request: UserUpdateProfileRequest) -> dict:
    try:
        return update_profile(
            user_id,
            full_name=request.full_name,
            phone=request.phone,
            address=request.address,
            city=request.city,
            state=request.state,
            pincode=request.pincode,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    except Exception as error:
        print("Profile update error:", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed.",
        )
