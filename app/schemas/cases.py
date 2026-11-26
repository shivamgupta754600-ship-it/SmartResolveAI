from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.india import IndiaLocation

Code = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_-]{1,32}$")]
Receipt = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class CaseInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    receipt: Receipt
    ward: Code
    department: Code
    photo: str | None = Field(default=None, min_length=1, max_length=6990508, repr=False)
    geography: IndiaLocation | None = None
    description: Note
    location: Annotated[str, StringConstraints(min_length=2, max_length=300)]
    language: Literal["en", "hi"] = "en"
    sms_phone: Annotated[str, StringConstraints(pattern=r"^\+[1-9][0-9]{7,14}$")] | None = None


class AssistedInput(CaseInput):
    assistance_code: Annotated[str, StringConstraints(pattern=r"^[a-fA-F0-9]{16}$")]
    channel: Literal["phone", "desk"]


class TicketReference(BaseModel):
    ticket: Annotated[str, StringConstraints(pattern=r"^SR-[A-F0-9]{21}$")]


class CaseAccess(TicketReference):
    receipt: Receipt


class AccountAction(TicketReference):
    action: Literal["reply", "reopen"]
    note: Note


class ResidentAction(AccountAction, CaseAccess):
    pass


class CaseEdit(BaseModel):
    expected_event_id: int | None = Field(default=None, ge=0)


class StaffAction(CaseEdit):
    action: Literal["assign", "visit", "blocked", "transfer", "start", "request_information", "update", "resolve", "accept_reopen", "decline_reopen"]
    department: Code | None = None
    next_update_at: AwareDatetime | None = None
    compose_seconds: Annotated[int, Field(ge=0, le=86400)] | None = None
    officer_id: Annotated[int, Field(gt=0)] | None = None
    note: Note | None = None


class StaffLogin(BaseModel):
    username: Annotated[str, StringConstraints(min_length=1, max_length=50)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]
    code: Annotated[str, StringConstraints(pattern=r"^[0-9]{6}$")]


class IncidentLink(BaseModel):
    ticket: Annotated[str, StringConstraints(pattern=r"^SR-[A-F0-9]{21}$")]


class IncidentUpdate(BaseModel):
    english: Note
    hindi: Note


ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class Responsibility(BaseModel):
    ward: Code
    department: Code
    locality: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    office: ShortText
    designation: ShortText
    escalation: ShortText
    target_hours: int = Field(ge=1, le=87600)
    scheme: ShortText | None = None
    authority: ShortText | None = None
    reviewer: int | None = Field(default=None, gt=0)
    appeal_days: int | None = Field(default=None, ge=1, le=3650)


class Referral(CaseEdit):
    office: ShortText
    follow_up: ShortText
    inward_number: ShortText | None = None


class Acknowledgement(CaseEdit):
    referral_id: int = Field(gt=0)
    inward_number: ShortText


class Delay(CaseEdit):
    reason: Note
    estimate: AwareDatetime
    update_due: AwareDatetime


class AccountAppeal(TicketReference):
    reason: Note


class Appeal(AccountAppeal, CaseAccess):
    pass


class Decision(BaseModel):
    note: Note


class Report(CaseEdit):
    designation: ShortText
    report: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12000)]

class ResidentProfile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    full_name: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    phone: Annotated[str, StringConstraints(pattern=r"^(?:[+]91|91)?[6-9][0-9]{9}$")]
    document_type: Literal["aadhaar", "voter", "passport", "driving_licence", "other"]
    document_suffix: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9]{4}$")]

    @model_validator(mode="after")
    def validate_reference(self):
        if self.document_type == "aadhaar" and not self.document_suffix.isdigit():
            raise ValueError("Use the last four digits of Aadhaar.")
        return self
