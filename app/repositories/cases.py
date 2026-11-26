from base64 import b64encode
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_hex
import json
import os

from fastapi import HTTPException
from mysql.connector import IntegrityError

from app.schemas.india import STATES
from app.repositories import municipal, residents
from app.services.evidence import prepare_photo
from app.database import get_database_connection


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@contextmanager
def transaction():
    connection = get_database_connection()
    try:
        with connection.cursor(dictionary=True) as cursor:
            cursor.execute("SET time_zone = '+00:00'")
            yield cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def event(cursor, case_id, kind, *, actor=None, note=None, public=False, sms=False):
    cursor.execute(
        "INSERT INTO case_events (case_id, actor_id, kind, note, public) VALUES (%s,%s,%s,%s,%s)",
        (case_id, actor, kind, note, public),
    )
    event_id = cursor.lastrowid
    if sms:
        cursor.execute("INSERT INTO case_sms (event_id) VALUES (%s)", (event_id,))
    return event_id


def catalog():
    with transaction() as cursor:
        cursor.execute("SELECT code, name FROM service_wards ORDER BY name")
        wards = cursor.fetchall()
        cursor.execute("SELECT code, name FROM service_departments ORDER BY name")
        return {"states": STATES, "wards": wards, "departments": cursor.fetchall(), "sms_enabled": sms_enabled(), "register": municipal.directory(cursor)}


def sms_enabled():
    return bool(os.getenv("CASE_SMS_WEBHOOK", "").startswith("https://") and os.getenv("CASE_SMS_TOKEN"))


def submit(body, *, resident_id=None, staff_id=None, channel="web"):
    photo = prepare_photo(body.photo) if body.photo is not None else None
    digest = sha256(body.receipt.encode()).digest()
    ticket = "SR-" + token_hex(11).upper()[:21]
    with transaction() as cursor:
        if body.geography is not None:
            cursor.execute(
                """SELECT r.ward FROM india_intake_routes r
                   WHERE r.state_name=%s AND r.department=%s AND EXISTS (
                       SELECT 1 FROM case_staff s JOIN users u ON u.id=s.user_id AND u.is_active
                       WHERE s.ward=r.ward AND s.department=r.department
                       AND s.role IN ('supervisor','officer')
                   )""",
                (body.geography.state, body.department),
            )
            routing = cursor.fetchone()
            if not routing:
                raise HTTPException(422, "location_not_served")
            body = body.model_copy(update={"ward": routing["ward"]})
        if staff_id:
            require_role(cursor, staff_id, body.ward, body.department, ("intake", "supervisor"))
        cursor.execute("SELECT ticket FROM service_cases WHERE receipt_hash=%s", (digest,))
        existing = cursor.fetchone()
        if existing:
            return existing
        if staff_id:
            resident_id = residents.redeem_code(cursor, body.assistance_code)
        contact = residents.require_profile(cursor, resident_id)
        if body.sms_phone and not contact["phone_verified"]:
            raise HTTPException(422, "sms_requires_verified_phone")
        if body.sms_phone and body.sms_phone != "+91" + contact["phone"][-10:]:
            raise HTTPException(422, "use_profile_phone")
        if body.sms_phone and not sms_enabled():
            raise HTTPException(422, "sms_unavailable")
        cursor.execute("SELECT code FROM service_wards WHERE code=%s", (body.ward,))
        if cursor.fetchone() is None:
            raise HTTPException(422, "unknown_ward")
        deadline = utc_now() + timedelta(hours=response_hours(cursor, body.department))
        try:
            cursor.execute(
                """INSERT INTO service_cases
                   (ticket, receipt_hash, ward, department, description, location,
                    language, channel, contact_phone, next_update_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (ticket, digest, body.ward, body.department, body.description,
                 body.location, body.language, channel, body.sms_phone, deadline),
            )
        except IntegrityError as error:
            if error.errno != 1062:
                raise
            cursor.execute(
                "SELECT ticket FROM service_cases WHERE receipt_hash=%s FOR UPDATE", (digest,),
            )
            existing = cursor.fetchone()
            if existing is None:
                raise
            return existing
        case_id = cursor.lastrowid
        cursor.execute("INSERT INTO case_residents(case_id,user_id) VALUES (%s,%s)", (case_id,resident_id))
        if body.geography is not None:
            cursor.execute("INSERT INTO case_geography(case_id, details) VALUES (%s,%s)",
                           (case_id, body.geography.model_dump_json()))
        if photo is not None:
            cursor.execute("INSERT INTO case_photos (case_id, jpeg) VALUES (%s,%s)", (case_id, photo))
        municipal.attach(cursor, case_id, body.ward, body.department, body.location)
        event(cursor, case_id, "received", actor=staff_id, public=True, sms=bool(body.sms_phone))
        return {"ticket": ticket}


def response_hours(cursor, department):
    cursor.execute("SELECT response_hours FROM service_departments WHERE code=%s", (department,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(422, "unknown_department")
    return row["response_hours"]


def require_role(cursor, user_id, ward, department, roles):
    cursor.execute(
        "SELECT role FROM case_staff WHERE user_id=%s AND ward=%s AND department=%s",
        (user_id, ward, department),
    )
    if not any(row["role"] in roles for row in cursor.fetchall()):
        raise HTTPException(403, "outside_scope")


def resident_case(cursor, access, owner_id=None):
    if owner_id is not None:
        cursor.execute(
            """SELECT c.* FROM service_cases c JOIN case_residents r ON r.case_id=c.id
               WHERE c.ticket=%s AND r.user_id=%s FOR UPDATE""", (access.ticket, owner_id),
        )
    else:
        cursor.execute(
            "SELECT * FROM service_cases WHERE ticket=%s AND receipt_hash=%s FOR UPDATE",
            (access.ticket, sha256(access.receipt.encode()).digest()),
        )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "case_not_found")
    return row


def has_photo(cursor, case_id):
    cursor.execute("SELECT 1 FROM case_photos WHERE case_id=%s", (case_id,))
    return cursor.fetchone() is not None


def read_photo(cursor, case_id):
    cursor.execute("SELECT jpeg FROM case_photos WHERE case_id=%s", (case_id,))
    record = cursor.fetchone()
    if record is None:
        raise HTTPException(404, "photo_not_found")
    return {"jpeg": b64encode(record["jpeg"]).decode("ascii")}


def resident_photo(access, owner_id=None):
    with transaction() as cursor:
        row = resident_case(cursor, access, owner_id)
        event(cursor, row["id"], "resident_view")
        return read_photo(cursor, row["id"])


def staff_photo(user_id, ticket):
    with transaction() as cursor:
        row = staff_case(cursor, user_id, ticket)
        event(cursor, row["id"], "staff_view", actor=user_id)
        return read_photo(cursor, row["id"])


def resident_view(access, owner_id=None):
    with transaction() as cursor:
        row = resident_case(cursor, access, owner_id)
        event(cursor, row["id"], "resident_view")
        cursor.execute(
            "SELECT id, kind, note, created_at FROM case_events WHERE case_id=%s AND public=TRUE ORDER BY id",
            (row["id"],),
        )
        result = {key: row[key] for key in ("ticket", "ward", "department", "status", "next_update_at", "created_at")}
        events = cursor.fetchall()
        result["has_photo"] = has_photo(cursor, row["id"])
        cursor.execute("SELECT name FROM service_departments WHERE code=%s", (row["department"],))
        return {**result, "office": cursor.fetchone()["name"], "events": events, **municipal.details(cursor, row)}


def resident_action(body, owner_id=None):
    with transaction() as cursor:
        row = resident_case(cursor, body, owner_id)
        permitted = {"reply": "needs_information", "reopen": "resolved"}
        if row["status"] != permitted[body.action]:
            raise HTTPException(409, "invalid_transition")
        status = "in_progress" if body.action == "reply" else "reopen_requested"
        deadline = utc_now() + timedelta(hours=response_hours(cursor, row["department"]))
        cursor.execute(
            """UPDATE service_cases SET status=%s, next_update_at=%s,
               resolved_at=NULL, escalated_at=NULL WHERE id=%s""",
            (status, deadline, row["id"]),
        )
        event(cursor, row["id"], status, note=body.note, public=True, sms=bool(row["contact_phone"]))
    return {"status": status}


def staff_scope(user_id):
    with transaction() as cursor:
        cursor.execute(
            "SELECT ward, department, role FROM case_staff WHERE user_id=%s ORDER BY ward, department, role",
            (user_id,),
        )
        return cursor.fetchall()


def queue(user_id, after, limit, status_filter):
    with transaction() as cursor:
        cursor.execute(
            """SELECT c.id, c.ticket, c.ward, c.department, c.status, c.created_at,
                      c.next_update_at, c.escalated_at, c.assigned_at, c.suggested_category
               FROM service_cases c WHERE c.id>%s
               AND ((%s='resolved' AND c.status='resolved')
                    OR (%s='open' AND c.status<>'resolved')
                    OR (%s='overdue' AND c.status<>'resolved' AND c.next_update_at<UTC_TIMESTAMP()))
               AND EXISTS (
                   SELECT 1 FROM case_staff s WHERE s.user_id=%s AND s.ward=c.ward
                   AND s.department=c.department AND s.role IN ('officer','supervisor')
               ) ORDER BY c.id LIMIT %s""",
            (after, status_filter, status_filter, status_filter, user_id, limit),
        )
        rows = cursor.fetchall()
        # Queue summaries exclude resident text, precise location and contact details.
        return rows


def staff_case(cursor, user_id, ticket):
    cursor.execute("SELECT * FROM service_cases WHERE ticket=%s FOR UPDATE", (ticket,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(404, "case_not_found")
    try:
        require_role(cursor, user_id, row["ward"], row["department"], ("officer", "supervisor"))
    except HTTPException:
        raise HTTPException(404, "case_not_found") from None
    return row


def incident_context(cursor, row):
    cursor.execute("SELECT incident FROM incident_members WHERE case_id=%s", (row["id"],))
    membership = cursor.fetchone()
    cursor.execute("""
        SELECT c.ticket,c.location,c.created_at FROM service_cases c
        LEFT JOIN incident_members m ON m.case_id=c.id
        WHERE c.ward=%s AND c.department=%s AND c.status<>'resolved' AND c.id<>%s
        AND LOWER(TRIM(c.location))=LOWER(TRIM(%s))
        AND ABS(TIMESTAMPDIFF(HOUR,c.created_at,%s))<=72
        AND (m.incident IS NULL OR %s IS NULL OR m.incident<>%s)
        ORDER BY c.created_at DESC LIMIT 10
    """, (row["ward"], row["department"], row["id"], row["location"], row["created_at"],
          membership and membership["incident"], membership and membership["incident"]))
    matches = cursor.fetchall()
    members = []
    if membership:
        cursor.execute("""SELECT c.ticket,c.status FROM incident_members m JOIN service_cases c ON c.id=m.case_id
                          WHERE m.incident=%s AND c.ward=%s AND c.department=%s ORDER BY c.id""",
                       (membership["incident"], row["ward"], row["department"]))
        members = cursor.fetchall()
    return {"matches": matches, "members": members}


def staff_view(user_id, ticket):
    with transaction() as cursor:
        row = staff_case(cursor, user_id, ticket)
        event(cursor, row["id"], "staff_view", actor=user_id)
        cursor.execute(
            """SELECT id, kind, note, created_at FROM case_events
               WHERE case_id=%s AND kind NOT IN ('staff_view','resident_view') ORDER BY id""",
            (row["id"],),
        )
        events = cursor.fetchall()
        cursor.execute(
            """SELECT DISTINCT u.id, u.username FROM case_staff s JOIN users u ON u.id=s.user_id
               WHERE s.ward=%s AND s.department=%s AND s.role IN ('officer','supervisor')
               AND u.is_active=TRUE ORDER BY u.username""",
            (row["ward"], row["department"]),
        )
        officers = cursor.fetchall()
        cursor.execute("""SELECT u.full_name,u.phone FROM case_residents r JOIN users u ON u.id=r.user_id
                          WHERE r.case_id=%s""", (row["id"],))
        row["resident_contact"] = cursor.fetchone()
        cursor.execute("SELECT details FROM case_geography WHERE case_id=%s", (row["id"],))
        geography = cursor.fetchone()
        row["geography"] = json.loads(geography["details"]) if geography else None
        row.update(municipal.details(cursor, row))
        row["has_photo"] = has_photo(cursor, row["id"])
        row.update(incident_context(cursor, row))
        for private in ("receipt_hash", "contact_phone"):
            row.pop(private)
        return {**row, "events": events, "officers": officers, "assigned_to_me": row["officer_id"] == user_id}


TRANSITIONS = {
    "assign": ({"received", "assigned", "in_progress", "needs_information", "reopen_requested"}, None),
    "visit": ({"assigned", "in_progress"}, "in_progress"),
    "blocked": ({"assigned", "in_progress"}, "in_progress"),
    "transfer": ({"received", "assigned", "in_progress", "needs_information", "reopen_requested"}, "received"),
    "start": ({"assigned"}, "in_progress"),
    "request_information": ({"assigned", "in_progress"}, "needs_information"),
    "update": ({"assigned", "in_progress", "needs_information"}, None),
    "resolve": ({"assigned", "in_progress", "needs_information"}, "resolved"),
    "accept_reopen": ({"reopen_requested"}, "received"),
    "decline_reopen": ({"reopen_requested"}, "resolved"),
}


def check_case_version(cursor, case_id, expected):
    if expected is None:
        return
    cursor.execute(
        """SELECT COALESCE(MAX(id), 0) AS version FROM case_events
           WHERE case_id=%s AND kind NOT IN ('staff_view','resident_view')""",
        (case_id,),
    )
    if cursor.fetchone()["version"] != expected:
        raise HTTPException(409, "case_changed")


def staff_action(user_id, ticket, body):
    with transaction() as cursor:
        row = staff_case(cursor, user_id, ticket)
        check_case_version(cursor, row["id"], body.expected_event_id)
        allowed, next_status = TRANSITIONS[body.action]
        if row["status"] not in allowed:
            raise HTTPException(409, "invalid_transition")
        if body.action in {"transfer", "accept_reopen", "decline_reopen"}:
            require_role(cursor, user_id, row["ward"], row["department"], ("supervisor",))
        if row["officer_id"] and row["officer_id"] != user_id:
            require_role(cursor, user_id, row["ward"], row["department"], ("supervisor",))
        if body.action not in {"assign", "start"} and not body.note:
            raise HTTPException(422, "note_required")

        department = row["department"]
        officer = row["officer_id"]
        assigned_at = row["assigned_at"]
        now = utc_now()
        if body.action == "assign":
            officer = body.officer_id or user_id
            if officer != user_id:
                require_role(cursor, user_id, row["ward"], department, ("supervisor",))
            require_role(cursor, officer, row["ward"], department, ("officer", "supervisor"))
            cursor.execute("SELECT id FROM users WHERE id=%s AND is_active=TRUE", (officer,))
            if cursor.fetchone() is None:
                raise HTTPException(422, "inactive_officer")
            assigned_at = assigned_at or now
        if body.action == "transfer":
            if not body.department or body.department == department:
                raise HTTPException(422, "choose_department")
            department = body.department
            cursor.execute(
                """SELECT 1 FROM case_staff s JOIN users u ON u.id=s.user_id AND u.is_active=TRUE
                   WHERE s.ward=%s AND s.department=%s AND s.role IN ('officer','supervisor') LIMIT 1""",
                (row["ward"], department),
            )
            if cursor.fetchone() is None:
                raise HTTPException(422, "department_unstaffed")
        if body.action in {"transfer", "accept_reopen"}:
            officer = None

        status = next_status or row["status"]
        if body.action == "assign" and status == "received":
            status = "assigned"
        deadline = now + timedelta(hours=response_hours(cursor, department))
        if body.action in {"visit", "blocked"}:
            if not body.next_update_at:
                raise HTTPException(422, "future_deadline_required")
            deadline = body.next_update_at.astimezone(timezone.utc).replace(tzinfo=None)
            if deadline <= now:
                raise HTTPException(422, "future_deadline_required")
        cursor.execute(
            """UPDATE service_cases SET department=%s, officer_id=%s, status=%s,
               assigned_at=%s, next_update_at=%s, resolved_at=%s, escalated_at=NULL WHERE id=%s""",
            (department, officer, status, assigned_at, deadline,
             now if status == "resolved" else None, row["id"]),
        )
        if body.action == "transfer":
            cursor.execute("DELETE FROM incident_members WHERE case_id=%s", (row["id"],))
            event(cursor, row["id"], "routing_changed", actor=user_id, note=f"{row['department']} → {department}")
        event_id = event(cursor, row["id"], body.action, actor=user_id, note=body.note,
              public=True, sms=bool(row["contact_phone"]))
        if body.note and body.compose_seconds is not None:
            cursor.execute("INSERT INTO case_message_times VALUES (%s,%s)", (event_id, body.compose_seconds))
        return {"status": status}


def metrics(user_id):
    with transaction() as cursor:
        cursor.execute(
            """SELECT c.ward, c.department, c.language, COUNT(*) AS total,
                      COUNT(CASE WHEN c.officer_id IS NOT NULL AND c.suggestion_state='ready' THEN 1 END) AS assessed,
                      COUNT(CASE WHEN c.officer_id IS NOT NULL AND c.suggestion_state='ready'
                                 AND REPLACE(LOWER(c.suggested_category),'_',' ')=LOWER(d.name) THEN 1 END) AS matching,

                      AVG((SELECT TIMESTAMPDIFF(SECOND,c.created_at,MIN(e.created_at))
                           FROM case_events e WHERE e.case_id=c.id AND e.actor_id IS NOT NULL AND e.public=1
                           AND e.kind<>'received')) AS first_action_seconds,
                      AVG((SELECT AVG(t.seconds_spent) FROM case_events e JOIN case_message_times t ON t.event_id=e.id
                           WHERE e.case_id=c.id)) AS compose_seconds,
                      SUM(c.status='resolved') AS resolved,
                      SUM(c.status<>'resolved' AND c.next_update_at<UTC_TIMESTAMP()) AS overdue,
                      AVG(TIMESTAMPDIFF(MINUTE,c.created_at,c.assigned_at)) AS avg_assignment_minutes,
                      SUM(EXISTS(SELECT 1 FROM case_events e WHERE e.case_id=c.id AND e.kind='transfer')) AS transferred,
                      SUM(EXISTS(SELECT 1 FROM case_events e WHERE e.case_id=c.id AND e.kind='reopen_requested')) AS reopened
               FROM service_cases c JOIN service_departments d ON d.code=c.department WHERE EXISTS (
                   SELECT 1 FROM case_staff s WHERE s.user_id=%s AND s.ward=c.ward
                   AND s.department=c.department AND s.role='supervisor'
               ) GROUP BY c.ward, c.department, c.language ORDER BY c.ward, c.department, c.language""",
            (user_id,),
        )
        return cursor.fetchall()


def operations(user_id):
    with transaction() as cursor:
        cursor.execute("""SELECT ward,department FROM case_staff WHERE user_id=%s AND role='supervisor'""",
                       (user_id,))
        if not cursor.fetchall():
            raise HTTPException(403, "outside_scope")
        cursor.execute("""SELECT MAX(completed_at) AS completed_at,
                          TIMESTAMPDIFF(MINUTE,MAX(completed_at),UTC_TIMESTAMP()) AS minutes_ago
                          FROM case_worker_health WHERE worker='case_worker'""")
        heartbeat = cursor.fetchone()
        cursor.execute("""SELECT COUNT(*) AS waiting, COUNT(CASE WHEN m.attempts>=8 THEN 1 END) AS exhausted,
                          TIMESTAMPDIFF(MINUTE,MIN(e.created_at),UTC_TIMESTAMP()) AS oldest_minutes
                          FROM case_sms m JOIN case_events e ON e.id=m.event_id JOIN service_cases c ON c.id=e.case_id
                          JOIN case_staff s ON s.ward=c.ward AND s.department=c.department
                          WHERE s.user_id=%s AND s.role='supervisor' AND m.sent_at IS NULL""", (user_id,))
        delivery = cursor.fetchone()
        cursor.execute("""SELECT s.ward,s.department,
                          COUNT(DISTINCT CASE WHEN u.is_active AND team.role IN ('supervisor','officer')
                                              THEN u.id END) AS handlers
                          FROM case_staff s JOIN case_staff team ON team.ward=s.ward AND team.department=s.department
                          JOIN users u ON u.id=team.user_id WHERE s.user_id=%s AND s.role='supervisor'
                          GROUP BY s.ward,s.department ORDER BY s.ward,s.department""", (user_id,))
        return {"heartbeat": heartbeat, "delivery": delivery, "coverage": cursor.fetchall()}
