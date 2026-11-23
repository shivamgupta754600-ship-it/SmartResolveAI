"""
SmartResolve AI - Auth Pydantic Schemas (request / response models)
"""

from __future__ import annotations

import re
from typing import Optional

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
    phone: Optional[str] = Field(default=None, max_length=15, description="10-digit mobile number.")

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

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits = re.sub(r"[\s\-\+()]", "", v)
        if not re.match(r"^\d{10,15}$", digits):
            raise ValueError("Phone must contain 10–15 digits.")
        return digits


class UserLoginRequest(BaseModel):
    username: str = Field(...)
    password: str = Field(...)


class UserUpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=15)
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=10)

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits = re.sub(r"[\s\-\+()]", "", v)
        if not re.match(r"^\d{10,15}$", digits):
            raise ValueError("Phone must contain 10–15 digits.")
        return digits

    @field_validator("pincode")
    @classmethod
    def _validate_pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Pincode must be 6 digits.")
        return v


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
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    profile_complete: bool = False
