"""
SmartResolve AI - Grievance Routes (Layer 1)

POST  /grievances/predict       → submit + classify a grievance  [JWT required]
GET   /grievances/history       → user's own prediction history  [JWT required]
GET   /grievances/admin/all     → all predictions                [Admin JWT]
GET   /grievances/admin/review  → flagged predictions queue      [Admin JWT]
PUT   /grievances/admin/{id}    → submit a review decision       [Admin JWT]
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.controllers.grievance_controller import (
    handle_get_all_predictions,
    handle_get_history,
    handle_get_review_queue,
    handle_grievance_prediction,
    handle_review_prediction,
)
from app.core.dependencies import get_current_admin, get_current_user
from app.middleware.rate_limiter import limiter
from app.schemas.grievance import GrievanceRequest
from app.schemas.grievance_response import GrievanceResponse, ReviewRequest

router = APIRouter(prefix="/grievances", tags=["Grievances"])


# ------------------------------------------------------------------
# Citizen endpoints
# ------------------------------------------------------------------

@router.post("/predict", response_model=GrievanceResponse)
@limiter.limit("10/minute")
def predict_grievance_route(
    request: Request,
    grievance: GrievanceRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Classify a grievance and save it to the prediction history.
    Requires a valid JWT Bearer token.
    Rate-limited to 10 submissions per minute per IP.
    """
    return handle_grievance_prediction(grievance, user_id=current_user["id"])


@router.get("/history")
def get_history(current_user: dict = Depends(get_current_user)):
    """Return the authenticated citizen's last 20 submissions."""
    return handle_get_history(current_user["id"])


# ------------------------------------------------------------------
# Admin endpoints
# ------------------------------------------------------------------

@router.get("/admin/all")
def get_all_predictions(current_admin: dict = Depends(get_current_admin)):
    """Return all predictions (admin dashboard)."""
    return handle_get_all_predictions()


@router.get("/admin/review")
def get_review_queue(current_admin: dict = Depends(get_current_admin)):
    """Return predictions flagged for human review."""
    return handle_get_review_queue()


@router.put("/admin/{prediction_id}")
def review_prediction(
    prediction_id: int,
    review: ReviewRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """Submit a review decision (approved / rejected) for a prediction."""
    return handle_review_prediction(prediction_id, review, admin_id=current_admin["id"])
