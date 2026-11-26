"""
SmartResolve AI - Grievance Controller (Layer 2)
"""

from __future__ import annotations

from fastapi import HTTPException

from app.repositories.prediction import (
    get_all_predictions,
    get_predictions_by_user,
    get_predictions_needing_review,
    update_review_status,
)
from app.schemas.grievance import GrievanceRequest
from app.schemas.grievance_response import ReviewRequest
from app.services.prediction import predict_grievance


def handle_grievance_prediction(
    grievance: GrievanceRequest,
    user_id: int,
) -> dict:

    try:
        return predict_grievance(grievance.text, user_id=user_id)

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="The grievance service is temporarily unavailable.")

    except Exception as error:
        print("Unexpected prediction error:", type(error).__name__)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


def handle_get_history(user_id: int) -> list:
    try:
        return get_predictions_by_user(user_id)
    except Exception as error:
        raise HTTPException(status_code=503, detail="The grievance service is temporarily unavailable.")


def handle_get_all_predictions() -> list:
    try:
        return get_all_predictions()
    except Exception as error:
        raise HTTPException(status_code=503, detail="The grievance service is temporarily unavailable.")


def handle_get_review_queue() -> list:
    try:
        return get_predictions_needing_review()
    except Exception as error:
        raise HTTPException(status_code=503, detail="The grievance service is temporarily unavailable.")


def handle_review_prediction(
    prediction_id: int,
    review: ReviewRequest,
    admin_id: int,
) -> dict:
    try:
        updated = update_review_status(
            prediction_id=prediction_id,
            review_status=review.review_status,
            reviewed_by=admin_id,
            review_notes=review.review_notes or "",
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Prediction not found.")
        return {"message": "Review status updated.", "prediction_id": prediction_id}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="The grievance service is temporarily unavailable.")
