"""
SmartResolve AI - Shared Rate-Limiter Instance
Import `limiter` into main.py AND into any route that needs
per-endpoint limits (via the @limiter.limit decorator).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Key function: limit per client IP address
limiter = Limiter(key_func=get_remote_address, storage_uri=settings.RATE_LIMIT_STORAGE_URI)
