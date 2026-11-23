"""
SmartResolve AI - Grievance Response Schema
"""

from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field


class GrievanceResponse(BaseModel):

    prediction_id: int = Field(description="Unique ID of the saved prediction")
    text: str = Field(description="Original grievance text (after normalisation)")
    predicted_category: str = Field(description="Category predicted by the ML model")
    confidence: float = Field(ge=0.0, le=1.0, description="Model confidence score 0–1")
    needs_human_review: bool = Field(description="Whether human review is required")
    probabilities: Dict[str, float] = Field(description="Per-category probability scores")
    review_message: str = Field(description="Message explaining the review status")
    safety_note: str = Field(description="Educational and safety disclaimer")


class ReviewRequest(BaseModel):
    review_status: str = Field(..., pattern="^(approved|rejected)$")
    review_notes: Optional[str] = Field(default="", max_length=500)
