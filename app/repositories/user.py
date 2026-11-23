"""
SmartResolve AI - User Repository (Layer 4)
Raw MySQL CRUD for the `users` table.
"""

from __future__ import annotations

from typing import Optional

from app.database import get_database_connection


def create_user(
    username: str,
    email: str,
    hashed_password: str,
    full_name: str = "",
) -> int:
    """Insert a new user and return the auto-generated id."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO users (username, email, hashed_password, full_name)
            VALUES (%s, %s, %s, %s)
            """,
            (username, email, hashed_password, full_name),
        )
        connection.commit()
        return cursor.lastrowid
    except Exception:
        if connection and connection.is_connected():
            connection.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


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
            SELECT id, username, email, full_name, is_active, is_admin, created_at
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
