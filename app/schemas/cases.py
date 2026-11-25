from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Code = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_-]{1,32}$")]
Receipt = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class CaseInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    receipt: Receipt
    ward: Code
    department: Code
    description: Note
    location: Annotated[str, StringConstraints(min_length=2, max_length=300)]
    language: Literal["en", "hi"] = "en"
    sms_phone: Annotated[str, StringConstraints(pattern=r"^\+[1-9][0-9]{7,14}$")] | None = None


class AssistedInput(CaseInput):
    channel: Literal["phone", "desk"]


class CaseAccess(BaseModel):
    ticket: Annotated[str, StringConstraints(pattern=r"^SR-[A-F0-9]{21}$")]
    receipt: Receipt


class ResidentAction(CaseAccess):
    action: Literal["reply", "reopen"]
    note: Note


class StaffAction(BaseModel):
    action: Literal["assign", "transfer", "start", "request_information", "update", "resolve", "accept_reopen", "decline_reopen"]
    department: Code | None = None
    officer_id: Annotated[int, Field(gt=0)] | None = None
    note: Note | None = None


class StaffLogin(BaseModel):
    username: Annotated[str, StringConstraints(min_length=1, max_length=50)]
    password: Annotated[str, StringConstraints(min_length=1, max_length=72)]
    code: Annotated[str, StringConstraints(pattern=r"^[0-9]{6}$")]
