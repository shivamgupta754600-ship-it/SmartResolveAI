from pydantic import BaseModel, Field
from typing import Dict


class GrievanceResponse(BaseModel):

    prediction_id: int = Field(
        description="Unique ID of the saved prediction"
    )

    text: str = Field(
        description="Original grievance text"
    )

    predicted_category: str = Field(
        description="Category predicted by the ML model"
    )

    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Model confidence score between 0 and 1"
    )

    needs_human_review: bool = Field(
        description="Whether human review is required"
    )

    probabilities: Dict[str, float] = Field(
        description="Probability of each grievance category"
    )

    review_message: str = Field(
        description="Message explaining the review status"
    )

    safety_note: str = Field(
        description="Educational and safety disclaimer"
    )