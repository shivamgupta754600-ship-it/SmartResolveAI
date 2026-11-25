from uuid import uuid4

from fastapi import HTTPException

from app.repositories.cases import event, require_role, staff_case, transaction


def daily_queue(user_id, view, offset):
    filters = {
        "mine": "c.officer_id=%(user)s",
        "unassigned": "c.officer_id IS NULL",
        "replied": "last_kind='in_progress'",
        "today": "DATE(c.next_update_at + INTERVAL 330 MINUTE)=DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE)",
        "overdue": "c.next_update_at<UTC_TIMESTAMP()",
        "resolved": "TRUE",
        "open": "TRUE",
        "stalled": "(c.officer_id IS NULL OR c.next_update_at<UTC_TIMESTAMP() OR transfers>=2 OR reopened>0)",
    }
    # Only fixed SQL fragments from this mapping enter the query.
    with transaction() as cursor:
        cursor.execute(f"""
            SELECT c.id,c.ticket,c.location,c.status,c.department,c.ward,c.officer_id,c.next_update_at,c.escalated_at,
                   c.next_update_at<UTC_TIMESTAMP() AS overdue,
                   (SELECT COUNT(*) FROM case_events e WHERE e.case_id=c.id AND e.kind='reopen_requested') AS reopened,
                   (SELECT COUNT(*) FROM case_events e WHERE e.case_id=c.id AND e.kind='transfer') AS transfers,
                   (SELECT kind FROM case_events e WHERE e.case_id=c.id AND e.public=1
                    ORDER BY e.id DESC LIMIT 1) AS last_kind
            FROM service_cases c
            WHERE (c.status='resolved')=%(closed)s AND EXISTS (
                SELECT 1 FROM case_staff s WHERE s.user_id=%(user)s AND s.ward=c.ward
                AND s.department=c.department AND s.role IN ('officer','supervisor')
                AND (%(stalled)s=0 OR s.role='supervisor'))
            HAVING {filters[view]}
            ORDER BY c.next_update_at,c.id LIMIT 25 OFFSET %(offset)s
        """, {"user": user_id, "offset": offset, "closed": view == "resolved", "stalled": view == "stalled"})
        return cursor.fetchall()


def can_edit(cursor, row, user_id):
    if row["status"] == "resolved":
        raise HTTPException(409, "invalid_transition")
    if row["officer_id"] not in (None, user_id):
        require_role(cursor, user_id, row["ward"], row["department"], ("supervisor",))


def link(user_id, ticket, other):
    if ticket == other:
        raise HTTPException(422, "invalid_link")
    with transaction() as cursor:
        first, second = [staff_case(cursor, user_id, key) for key in sorted((ticket, other))]
        for row in (first, second):
            can_edit(cursor, row, user_id)
        if (first["ward"], first["department"]) != (second["ward"], second["department"]):
            raise HTTPException(409, "invalid_link")
        cursor.execute("SELECT incident FROM incident_members WHERE case_id IN (%s,%s) FOR UPDATE",
                       (first["id"], second["id"]))
        groups = {item["incident"] for item in cursor.fetchall()}
        if len(groups) > 1:
            raise HTTPException(409, "different_incidents")
        group = next(iter(groups), uuid4().hex)
        for row in (first, second):
            cursor.execute("INSERT IGNORE INTO incident_members VALUES (%s,%s)", (row["id"], group))
            if cursor.rowcount:
                event(cursor, row["id"], "incident_linked", actor=user_id)
    return {"linked": True}


def share(user_id, ticket, body):
    with transaction() as cursor:
        root = staff_case(cursor, user_id, ticket)
        can_edit(cursor, root, user_id)
        cursor.execute("""
            SELECT c.* FROM incident_members m JOIN incident_members base ON base.incident=m.incident
            JOIN service_cases c ON c.id=m.case_id WHERE base.case_id=%s AND c.status<>'resolved'
            AND c.ward=%s AND c.department=%s ORDER BY c.id FOR UPDATE
        """, (root["id"], root["ward"], root["department"]))
        rows = cursor.fetchall()
        if len(rows) < 2:
            raise HTTPException(409, "invalid_link")
        for row in rows:
            can_edit(cursor, row, user_id)
            event(cursor, row["id"], "update", actor=user_id, public=True,
                  note=body.hindi if row["language"] == "hi" else body.english, sms=bool(row["contact_phone"]))
        return {"updated": len(rows)}
