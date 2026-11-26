"""
SmartResolve AI - Centralised Configuration
All settings are read from environment variables (or .env).
Import `settings` wherever you need a config value.
"""

from __future__ import annotations

import json
from typing import List, Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------
    APP_NAME: str = "SmartResolve AI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    CASE_PUBLIC_DEPLOYMENT: bool = False
    PHONE_VERIFICATION_REQUIRED: bool = False

    # ------------------------------------------------------------------
    # MySQL
    # ------------------------------------------------------------------
    MYSQL_HOST: str = "localhost"
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "smartresolve_db"

    # ------------------------------------------------------------------
    # JWT
    # Generate a key with:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    # ------------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ------------------------------------------------------------------
    # CORS  (comma-separated string in .env, e.g. "http://localhost:5500,http://localhost:3000")
    # ------------------------------------------------------------------
    CORS_ORIGINS_STR: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:5500,"
        "http://127.0.0.1:5500,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8000,"
        "http://127.0.0.1:8000"
    )

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS_STR.split(",") if o.strip()]

    # ------------------------------------------------------------------
    # Rate Limiting
    # ------------------------------------------------------------------
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT: str = "20/minute"

    # ------------------------------------------------------------------
    # ML Model
    # ------------------------------------------------------------------
    CONFIDENCE_THRESHOLD: float = 0.60
    MIN_TEXT_LENGTH: int = 5
    MAX_TEXT_LENGTH: int = 1000

    @model_validator(mode="after")
    def validate_deployment_key(self):
        if len(self.SECRET_KEY.strip()) < 32 or self.SECRET_KEY.upper().startswith("CHANGE-THIS"):
            raise ValueError("Set SECRET_KEY to a randomly generated key of at least 32 characters.")
        return self

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "allow",
    }


settings = Settings()
