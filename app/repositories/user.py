"""
SmartResolve AI - User Repository (Layer 4)
Raw MySQL CRUD for the `users` table.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from app.core.config import settings
from app.services import phone_verification
from app.repositories.cases import transaction
from app.database import get_database_connection


def create_user(
    username: str,
    email: str,
    hashed_password: str,
    full_name: str,
    phone: str,
    phone_proof: str | None,
) -> int:
    with transaction() as cursor:
        if settings.PHONE_VERIFICATION_REQUIRED:
            if not phone_proof:
                raise HTTPException(422, "Verify your mobile number before registering.")
            phone_verification.consume(cursor, phone, phone_proof)
        cursor.execute(
            """INSERT INTO users (username,email,hashed_password,full_name,phone)
               VALUES (%s,%s,%s,%s,%s)""",
            (username,email,hashed_password,full_name,phone),
        )
        user_id = cursor.lastrowid
        if settings.PHONE_VERIFICATION_REQUIRED:
            phone_verification.record(cursor,user_id,phone)
        return user_id


def get_user_by_username(username: str) -> Optional[dict]:
    """Return the active user row as a dict, or None."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM users WHERE username = %s AND is_active = TRUE LIMIT 1",
            (username,),
        )
        return cursor.fetchone()
    except Exception:
        return None
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_user_by_email(email: str) -> Optional[dict]:
    """Return any user row matching *email*, or None."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM users WHERE email = %s LIMIT 1",
            (email,),
        )
        return cursor.fetchone()
    except Exception:
        return None
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Return safe (no password) user fields by id, or None."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, username, email, full_name, phone, address, city, state, pincode,
                   is_active, is_admin, created_at
            FROM   users
            WHERE  id = %s
            LIMIT  1
            """,
            (user_id,),
        )
        return cursor.fetchone()
    except Exception:
        return None
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def update_user_profile(
    user_id: int,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    pincode: Optional[str] = None,
) -> bool:
    """Update editable profile fields. Only non-None values are written."""
    fields, values = [], []
    if full_name is not None:
        fields.append("full_name = %s"); values.append(full_name)
    if phone is not None:
        fields.append("phone = %s"); values.append(phone)
    if address is not None:
        fields.append("address = %s"); values.append(address)
    if city is not None:
        fields.append("city = %s"); values.append(city)
    if state is not None:
        fields.append("state = %s"); values.append(state)
    if pincode is not None:
        fields.append("pincode = %s"); values.append(pincode)

    if not fields:
        return False

    values.append(user_id)
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor()
        cursor.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = %s",
            tuple(values),
        )
        connection.commit()
        return cursor.rowcount > 0
    except Exception:
        if connection and connection.is_connected():
            connection.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
