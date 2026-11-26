from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

STATES = (
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
    "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
)

PlaceName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class IndiaLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: str
    district: PlaceName
    subdistrict: PlaceName | None = None
    settlement_type: Literal["village", "town", "city"]
    settlement: PlaceName
    local_area: PlaceName | None = None

    @field_validator("state")
    @classmethod
    def known_state(cls, value):
        if value not in STATES:
            raise ValueError("Select an Indian state or union territory.")
        return value
