"""
SmartResolve AI - Grievance Request Schema (Layer 1 ↔ 2 contract)
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class GrievanceRequest(BaseModel):

    text: str = Field(
        ...,
        description="Citizen grievance in Hindi, English, or Hinglish",
        min_length=5,
        max_length=1000,
    )

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:

        # Strip surrounding whitespace
        value = value.strip()

        if not value:
            raise ValueError("Grievance text cannot be empty.")

        if len(value) < 5:
            raise ValueError("Grievance text must contain at least 5 characters.")

        # Reject purely numeric input (not a real grievance)
        if value.replace(" ", "").isdigit():
            raise ValueError(
                "Grievance text must be a meaningful description, not just numbers."
            )

        return value
