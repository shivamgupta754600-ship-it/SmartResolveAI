
from pydantic import BaseModel, Field, field_validator


class GrievanceRequest(BaseModel):

    text: str = Field(
        ...,
        description="Citizen grievance in Hindi, English, or Hinglish",
        min_length=5,
        max_length=1000
    )

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:

        # Remove unnecessary spaces
        value = value.strip()

        # Reject empty text after stripping
        if not value:

            raise ValueError(
                "Grievance text cannot be empty."
            )

        # Reject text shorter than 5 characters
        if len(value) < 5:

            raise ValueError(
                "Grievance text must contain at least 5 characters."
            )

        return value