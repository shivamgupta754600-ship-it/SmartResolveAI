import base64
import hashlib
import hmac
import json
import os
import time
from datetime import timedelta

from fastapi import Depends, HTTPException

from app.core.dependencies import get_current_user, oauth2_scheme
from app.core.security import create_access_token, decode_token, verify_password
from app.repositories.cases import staff_scope, transaction
from app.repositories.user import get_user_by_username


def configured_secret(username):
    return json.loads(os.environ.get("CASE_STAFF_TOTP_SECRETS", "{}")).get(username)


def totp(secret, step):
    key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    if len(key) < 20:
        raise ValueError("Staff TOTP secrets must be at least 160 bits.")
    digest = hmac.digest(key, step.to_bytes(8, "big"), hashlib.sha1)
    offset = digest[-1] & 15
    return str((int.from_bytes(digest[offset:offset + 4], "big") & 0x7fffffff) % 1_000_000).zfill(6)


def staff_login(body):
    user = get_user_by_username(body.username.strip().lower())
    invalid = HTTPException(401, "invalid_staff_credentials")
    if not user or not user["is_active"] or len(body.password.encode()) > 72:
        raise invalid
    if not verify_password(body.password, user["hashed_password"]):
        raise invalid
    secret = configured_secret(user["username"])
    if not secret or not staff_scope(user["id"]):
        raise invalid
    current = int(time.time()) // 30
    step = next((candidate for candidate in (current, current - 1, current + 1)
                 if hmac.compare_digest(totp(secret, candidate), body.code)), None)
    if step is None:
        raise invalid
    with transaction() as cursor:
        cursor.execute("INSERT IGNORE INTO staff_mfa_steps (user_id) VALUES (%s)", (user["id"],))
        cursor.execute(
            "UPDATE staff_mfa_steps SET last_step=%s WHERE user_id=%s AND last_step<%s",
            (step, user["id"], step),
        )
        if not cursor.rowcount:
            raise invalid
    claims = {"sub": user["username"], "case_staff": True}
    return {"access_token": create_access_token(claims, timedelta(minutes=30))}


def current_case_staff(token: str = Depends(oauth2_scheme)):
    claims = decode_token(token) or {}
    if claims.get("case_staff") is not True or not configured_secret(claims.get("sub")):
        raise HTTPException(401, "staff_sign_in_required")
    return get_current_user(token)["id"]
