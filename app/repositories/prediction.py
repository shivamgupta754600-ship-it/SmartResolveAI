"""
SmartResolve AI - Prediction Repository (Layer 4)
Raw MySQL CRUD for the `prediction_history` table.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.database import get_database_connection


def _make_ticket(row_id: int) -> str:
    year = datetime.now().year
    return f"GRV-{year}-{row_id:06d}"


def save_prediction(
    grievance_text: str,
    predicted_category: str,
    confidence: float,
    needs_human_review: bool,
    user_id: Optional[int] = None,
) -> dict:
    """
    Insert a prediction record, generate a ticket number, and return
    {'id': int, 'ticket_number': str}.
    """
    connection = None
    cursor = None
    try:
        connection = get_database_connection()

        if connection is None or not connection.is_connected():
            raise Exception("Database connection could not be established.")

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO prediction_history (
                user_id, grievance_text, predicted_category,
                confidence, needs_human_review
            ) VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, grievance_text, predicted_category, confidence, needs_human_review),
        )
        row_id = cursor.lastrowid
        ticket = _make_ticket(row_id)

        cursor.execute(
            "UPDATE prediction_history SET ticket_number = %s WHERE id = %s",
            (ticket, row_id),
        )
        connection.commit()
        return {"id": row_id, "ticket_number": ticket}

    except Exception as error:
        if connection is not None and connection.is_connected():
            connection.rollback()
        raise Exception(f"Could not save prediction: {error}")

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def get_predictions_by_user(user_id: int, limit: int = 20) -> list:
    """Return the most recent *limit* predictions for a given user."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT id, ticket_number, grievance_text, predicted_category, confidence,
                   needs_human_review, review_status, created_at
            FROM   prediction_history
            WHERE  user_id = %s
            ORDER  BY created_at DESC
            LIMIT  %s
            """,
            (user_id, limit),
        )
        return cursor.fetchall()
    except Exception as error:
        raise Exception(f"Could not fetch user history: {error}")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_predictions_needing_review(limit: int = 100) -> list:
    """Return predictions flagged for human review (admin use)."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ph.id, ph.ticket_number, ph.grievance_text, ph.predicted_category,
                   ph.confidence, ph.review_status, ph.created_at,
                   u.username AS submitted_by, u.full_name, u.phone,
                   u.address, u.city, u.state, u.pincode
            FROM   prediction_history ph
            LEFT   JOIN users u ON ph.user_id = u.id
            WHERE  ph.needs_human_review = TRUE
            ORDER  BY ph.created_at DESC
            LIMIT  %s
            """,
            (limit,),
        )
        return cursor.fetchall()
    except Exception as error:
        raise Exception(f"Could not fetch review queue: {error}")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_all_predictions(limit: int = 200) -> list:
    """Return all predictions (admin dashboard overview)."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT ph.id, ph.ticket_number, ph.grievance_text, ph.predicted_category,
                   ph.confidence, ph.needs_human_review, ph.review_status,
                   ph.created_at,
                   u.username AS submitted_by, u.full_name, u.phone,
                   u.address, u.city, u.state, u.pincode
            FROM   prediction_history ph
            LEFT   JOIN users u ON ph.user_id = u.id
            ORDER  BY ph.created_at DESC
            LIMIT  %s
            """,
            (limit,),
        )
        return cursor.fetchall()
    except Exception as error:
        raise Exception(f"Could not fetch all predictions: {error}")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def update_review_status(
    prediction_id: int,
    review_status: str,
    reviewed_by: int,
    review_notes: str = "",
) -> bool:
    """Update the review outcome for a flagged prediction."""
    connection = None
    cursor = None
    try:
        connection = get_database_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE prediction_history
            SET    review_status = %s,
                   reviewed_by   = %s,
                   review_notes  = %s,
                   reviewed_at   = NOW()
            WHERE  id = %s
            """,
            (review_status, reviewed_by, review_notes, prediction_id),
        )
        connection.commit()
        return cursor.rowcount > 0
    except Exception as error:
        if connection and connection.is_connected():
            connection.rollback()
        raise Exception(f"Could not update review status: {error}")
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
