"""
SmartResolve AI - JWT & Password Utilities
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt
import jwt

from app.core.config import settings

# ------------------------------------------------------------------
# Password hashing  (bcrypt directly — passlib 1.7.4 is broken on Python 3.12+)
# ------------------------------------------------------------------

def hash_password(password: str) -> str:
    if len(password.encode()) > 72:
        raise ValueError("Password must fit within 72 UTF-8 bytes.")
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode()
    return len(encoded) <= 72 and _bcrypt.checkpw(encoded, hashed.encode())


# ------------------------------------------------------------------
# JWT helpers
# ------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({"exp": expire, "token_type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "token_type": "refresh"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Return the decoded payload or None if invalid / expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], options={"require": ["exp", "sub", "token_type"]})
    except jwt.InvalidTokenError:
        return None
