"""
SmartResolve AI - Auth Pydantic Schemas (request / response models)
"""

from __future__ import annotations

import re
from pydantic import BaseModel, Field, EmailStr, field_validator


class UserRegisterRequest(BaseModel):

    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="3–50 chars; letters, numbers, underscores only.",
    )
    email: EmailStr = Field(..., description="Valid e-mail address.")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="At least 8 chars with 1 uppercase and 1 digit.",
    )
    full_name: str = Field(default="", max_length=100)

    @field_validator("username")
    @classmethod
    def _clean_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError(
                "Username may only contain letters, numbers, and underscores."
            )
        return v.lower()

    @field_validator("password")
    @classmethod
    def _strong_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number.")
        return v


class UserLoginRequest(BaseModel):
    """
    JSON login body.  For Swagger's Authorize button we also expose
    the OAuth2 form-data endpoint at POST /auth/login.
    """
    username: str = Field(...)
    password: str = Field(...)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserPublicResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    is_admin: bool
