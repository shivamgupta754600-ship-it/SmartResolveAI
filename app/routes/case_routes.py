from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.middleware.rate_limiter import limiter
from app.repositories import cases, staff_work, municipal
from app.schemas.cases import Responsibility, Referral, Acknowledgement, Delay, Appeal, Decision, Report
from app.schemas.cases import IncidentLink, IncidentUpdate, AssistedInput, CaseAccess, CaseInput, ResidentAction, StaffAction, StaffLogin
from app.services.case_staff import current_case_staff, staff_login

router = APIRouter(prefix="/cases", tags=["Cases"])
StaffId = Annotated[int, Depends(current_case_staff)]


@router.get("/catalog")
def catalog():
    return cases.catalog()


@router.post("", status_code=201)
@limiter.limit("8/minute")
def submit(request: Request, response: Response, body: CaseInput):
    response.headers["Cache-Control"] = "no-store"
    return cases.submit(body)


@router.post("/lookup")
@limiter.limit("30/minute")
def lookup(request: Request, response: Response, body: CaseAccess):
    response.headers["Cache-Control"] = "no-store"
    return cases.resident_view(body)


@router.post("/respond")
@limiter.limit("10/minute")
def respond(request: Request, body: ResidentAction):
    return cases.resident_action(body)


@router.post("/staff/session")
@limiter.limit("5/minute")
def session(request: Request, response: Response, body: StaffLogin):
    response.headers["Cache-Control"] = "no-store"
    return staff_login(body)


@router.get("/staff/scope")
def scope(user_id: StaffId):
    return cases.staff_scope(user_id)


@router.post("/staff/assisted", status_code=201)
def assisted(response: Response, body: AssistedInput, user_id: StaffId):
    response.headers["Cache-Control"] = "no-store"
    return cases.submit(body, staff_id=user_id, channel=body.channel)


@router.get("/staff/queue")
def queue(response: Response, user_id: StaffId,
          after: Annotated[int, Query(ge=0)] = 0,
          limit: Annotated[int, Query(ge=1, le=100)] = 25,
          filter: Literal["open", "overdue", "resolved"] = "open"):
    response.headers["Cache-Control"] = "no-store"
    return cases.queue(user_id, after, limit, filter)


@router.get("/staff/metrics")
def metrics(user_id: StaffId):
    return cases.metrics(user_id)


@router.get("/staff/case/{ticket}")
def detail(response: Response, ticket: str, user_id: StaffId):
    response.headers["Cache-Control"] = "no-store"
    return cases.staff_view(user_id, ticket)


@router.post("/staff/case/{ticket}")
def action(ticket: str, body: StaffAction, user_id: StaffId):
    return cases.staff_action(user_id, ticket, body)


@router.get("/staff/work")
def daily_work(response: Response, user_id: StaffId, view: Literal["mine", "unassigned", "replied", "today", "overdue", "resolved", "open", "stalled"] = "mine",
               offset: Annotated[int, Query(ge=0)] = 0):
    response.headers["Cache-Control"] = "no-store"
    return staff_work.daily_queue(user_id, view, offset)


@router.post("/staff/case/{ticket}/link")
def link(ticket: str, body: IncidentLink, user_id: StaffId):
    return staff_work.link(user_id, ticket, body.ticket)


@router.post("/staff/case/{ticket}/broadcast")
def broadcast(ticket: str, body: IncidentUpdate, user_id: StaffId):
    return staff_work.share(user_id, ticket, body)

@router.post("/staff/register")
def register(body: Responsibility, user_id: StaffId):
    return municipal.register(user_id, body)


@router.get("/staff/weekly")
def weekly(user_id: StaffId):
    return municipal.weekly(user_id)


@router.get("/staff/appeals")
def appeals(user_id: StaffId):
    return municipal.appeals(user_id)


@router.post("/appeal")
@limiter.limit("10/minute")
def appeal(request: Request, body: Appeal):
    return municipal.file_appeal(body)


@router.post("/staff/case/{ticket}/decision")
def decide(ticket: str, body: Decision, user_id: StaffId):
    return municipal.decide(user_id, ticket, body)


@router.post("/staff/case/{ticket}/refer")
def refer(ticket: str, body: Referral, user_id: StaffId):
    return municipal.change(user_id, ticket, "refer", body)


@router.post("/staff/case/{ticket}/acknowledge")
def acknowledge(ticket: str, body: Acknowledgement, user_id: StaffId):
    return municipal.change(user_id, ticket, "acknowledge", body)


@router.post("/staff/case/{ticket}/delay")
def delay(ticket: str, body: Delay, user_id: StaffId):
    return municipal.change(user_id, ticket, "delay", body)


@router.post("/staff/case/{ticket}/report")
def report(ticket: str, body: Report, user_id: StaffId):
    return municipal.change(user_id, ticket, "report", body)


@router.get("/staff/reviewers")
def reviewers(user_id: StaffId):
    return municipal.reviewers(user_id)


@router.get("/staff/register")
def verification_history(response: Response, user_id: StaffId):
    response.headers["Cache-Control"] = "no-store"
    return municipal.verification_history(user_id)
