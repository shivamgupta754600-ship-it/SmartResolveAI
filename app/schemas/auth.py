"""
SmartResolve AI - Auth Pydantic Schemas (request / response models)
"""

from __future__ import annotations

import re
from typing import Annotated, Optional

from pydantic import BaseModel, Field, EmailStr, field_validator


def indian_mobile(value: str) -> str:
    value = re.sub(r"[ ()-]", "", value)
    if not re.fullmatch(r"(?:[+]91|91)?[6-9][0-9]{9}", value):
        raise ValueError("Enter a valid Indian mobile number.")
    return value[-10:]


class OTPRequest(BaseModel):
    phone: str = Field(max_length=24)
    captcha: str = Field(min_length=1, max_length=2048, repr=False)
    _phone = field_validator("phone")(indian_mobile)


class OTPCheck(BaseModel):
    challenge: str = Field(pattern=r"^[a-f0-9]{32}$")
    code: str = Field(pattern=r"^[0-9]{6}$", repr=False)


Proof = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class VerifiedNumber(BaseModel):
    phone: str = Field(max_length=24)
    phone_proof: Proof = Field(repr=False)
    _phone = field_validator("phone")(indian_mobile)


def validate_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Use at least eight characters.")
    if len(v.encode()) > 72:
        raise ValueError("Password must fit within 72 UTF-8 bytes.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not re.search(r"[0-9]", v):
        raise ValueError("Password must contain at least one number.")
    return v


class UserRegisterRequest(VerifiedNumber):
    phone_proof: Proof | None = Field(default=None, repr=False)

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
        return validate_password(v)

class UserLoginRequest(BaseModel):
    username: str = Field(min_length=1,max_length=50)
    password: str = Field(min_length=1,max_length=128)


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
