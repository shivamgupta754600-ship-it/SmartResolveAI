from datetime import timedelta, timezone

from fastapi import HTTPException

from app.repositories import cases


def register(user, body):
    with cases.transaction() as cur:
        cases.require_role(cur, user, body.ward, body.department, ("supervisor",))
        appeal_fields = (body.scheme, body.authority, body.reviewer, body.appeal_days)
        if any(appeal_fields) and not all(appeal_fields):
            raise HTTPException(422, "Complete all appeal settings")
        if body.reviewer:
            cases.require_role(cur, body.reviewer, body.ward, body.department, ("supervisor",))
            cur.execute("SELECT id FROM users WHERE id=%s AND is_active=TRUE", (body.reviewer,))
            if cur.fetchone() is None:
                raise HTTPException(422, "Select an active appellate reviewer")
        cur.execute("""INSERT INTO responsibility_rules
            (ward,department,locality,office,designation,escalation,target_hours,scheme,authority,reviewer,appeal_days,verified_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (body.ward, body.department, body.locality, body.office, body.designation, body.escalation,
             body.target_hours, *appeal_fields, user))
        return {"id": cur.lastrowid}


def directory(cur):
    cur.execute("""SELECT r.id,r.ward,r.department,r.locality,r.office,r.designation,r.escalation,r.target_hours,
                   r.scheme,r.authority,r.appeal_days,r.verified_at FROM responsibility_rules r
                   WHERE NOT EXISTS (SELECT 1 FROM responsibility_rules n WHERE n.ward=r.ward
                   AND n.department=r.department AND n.locality=r.locality AND n.id>r.id)
                   ORDER BY r.ward,r.department,r.locality""")
    return cur.fetchall()


def attach(cur, case_id, ward, department, location):
    cur.execute("""INSERT INTO case_targets(case_id,rule_id,due_at)
                   SELECT c.id,r.id,DATE_ADD(c.created_at,INTERVAL r.target_hours HOUR)
                   FROM service_cases c JOIN responsibility_rules r ON r.ward=%s AND r.department=%s
                   WHERE c.id=%s AND (r.locality='' OR r.locality=%s)
                   ORDER BY LENGTH(r.locality) DESC,r.id DESC LIMIT 1""", (ward, department, case_id, location))


def details(cur, row):
    cur.execute("""SELECT t.due_at,t.revised_at,t.delay_reason,r.office,r.designation,r.escalation,
                   r.scheme,r.authority,r.appeal_days FROM case_targets t JOIN responsibility_rules r ON r.id=t.rule_id
                   WHERE t.case_id=%s""", (row["id"],))
    target = cur.fetchone()
    if target and target["scheme"]:
        now = cases.utc_now()
        triggers = [row["resolved_at"]] if row["resolved_at"] else []
        if target["due_at"] <= now:
            triggers.append(target["due_at"])
        # A timely closure starts the review window on the closure date.
        trigger = min(triggers) if triggers else None
        deadline = trigger + timedelta(days=target["appeal_days"]) if trigger else None
        target.update(appeal_deadline=deadline, appeal_open=bool(deadline and now <= deadline))
    cur.execute("""SELECT id,office,follow_up,inward_number,referred_at,acknowledged_at
                   FROM authority_referrals WHERE case_id=%s ORDER BY id""", (row["id"],))
    referrals = cur.fetchall()
    cur.execute("SELECT reason,filed_at,decision,decided_at FROM service_appeals WHERE case_id=%s", (row["id"],))
    appeal = cur.fetchone()
    cur.execute("SELECT report,designation,reviewed_at FROM action_reports WHERE case_id=%s", (row["id"],))
    return {"target": target, "referrals": referrals, "appeal": appeal, "report": cur.fetchone()}


def change(user, ticket, operation, body):
    with cases.transaction() as cur:
        row = cases.staff_case(cur, user, ticket)
        if row["officer_id"] not in (None, user):
            cases.require_role(cur, user, row["ward"], row["department"], ("supervisor",))
        cid = row["id"]
        cases.check_case_version(cur, cid, body.expected_event_id)
        if operation == "refer":
            cur.execute("INSERT INTO authority_referrals(case_id,office,follow_up,inward_number) VALUES (%s,%s,%s,%s)",
                        (cid, body.office, body.follow_up, body.inward_number))
            note = body.office
        elif operation == "acknowledge":
            cur.execute("""UPDATE authority_referrals SET inward_number=%s,acknowledged_at=UTC_TIMESTAMP()
                           WHERE case_id=%s AND id=%s AND acknowledged_at IS NULL""",
                        (body.inward_number, cid, body.referral_id))
            if not cur.rowcount:
                raise HTTPException(409, "Referral already acknowledged or unavailable")
            note = body.inward_number
        elif operation == "delay":
            estimate, update = [v.astimezone(timezone.utc).replace(tzinfo=None) for v in (body.estimate, body.update_due)]
            target = details(cur, row)["target"]
            if not target or row["status"] == "resolved" or not cases.utc_now() < update <= estimate or estimate <= target["due_at"]:
                raise HTTPException(422, "Choose a later resolution estimate and a future update before it")
            cur.execute("UPDATE case_targets SET revised_at=%s,delay_reason=%s WHERE case_id=%s", (estimate, body.reason, cid))
            cur.execute("UPDATE service_cases SET next_update_at=%s,escalated_at=NULL WHERE id=%s", (update, cid))
            note = body.reason
        else:
            cur.execute("""INSERT INTO action_reports(case_id,report,designation,reviewed_by) VALUES (%s,%s,%s,%s)
                           ON DUPLICATE KEY UPDATE report=%s,designation=%s,reviewed_by=%s,reviewed_at=UTC_TIMESTAMP()""",
                        (cid, body.report, body.designation, user, body.report, body.designation, user))
            note = body.designation
        cases.event(cur, cid, operation, actor=user, note=note, public=True, sms=bool(row["contact_phone"]))
        return {"saved": True}


def file_appeal(body, owner_id=None):
    with cases.transaction() as cur:
        row = cases.resident_case(cur, body, owner_id)
        record = details(cur, row)
        if record["appeal"] or not (record["target"] or {}).get("appeal_open"):
            raise HTTPException(409, "Appeal unavailable")
        cur.execute("INSERT INTO service_appeals(case_id,reason) VALUES (%s,%s)", (row["id"], body.reason))
        cases.event(cur, row["id"], "appeal_filed", note=body.reason, public=True)
        return {"filed": True}


APPEAL_QUEUE = """FROM service_appeals a JOIN service_cases c ON c.id=a.case_id
    JOIN case_targets t ON t.case_id=c.id JOIN responsibility_rules r ON r.id=t.rule_id
    JOIN case_staff s ON s.user_id=r.reviewer AND s.ward=r.ward AND s.department=r.department
    AND s.role='supervisor' WHERE r.reviewer=%s AND a.decided_at IS NULL"""


def appeals(user):
    with cases.transaction() as cur:
        cur.execute("SELECT c.ticket,c.description,a.reason,a.filed_at,r.scheme,r.authority " + APPEAL_QUEUE +
                    " ORDER BY a.filed_at", (user,))
        return cur.fetchall()


def decide(user, ticket, body):
    with cases.transaction() as cur:
        cur.execute("SELECT c.id " + APPEAL_QUEUE + " AND c.ticket=%s FOR UPDATE", (user, ticket))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Appeal unavailable")
        cur.execute("UPDATE service_appeals SET decision=%s,decided_at=UTC_TIMESTAMP(),decided_by=%s WHERE case_id=%s",
                    (body.note, user, row["id"]))
        cases.event(cur, row["id"], "appeal_decided", actor=user, public=True, note=body.note)
        return {"saved": True}


def weekly(user):
    with cases.transaction() as cur:
        cur.execute("""SELECT c.ticket,c.created_at,c.location,c.ward,c.department,c.status,
            (SELECT current_rule.designation FROM responsibility_rules current_rule
             WHERE current_rule.ward=c.ward AND current_rule.department=c.department AND
             (current_rule.locality='' OR current_rule.locality=c.location)
             ORDER BY LENGTH(current_rule.locality) DESC,current_rule.id DESC LIMIT 1) AS designation,t.due_at, t.due_at<UTC_TIMESTAMP() AS missed,
            (SELECT GROUP_CONCAT(CONCAT(f.office,' (',f.follow_up,')') ORDER BY f.id SEPARATOR ', ')
             FROM authority_referrals f WHERE f.case_id=c.id AND f.acknowledged_at IS NULL) AS waiting,
            EXISTS(SELECT 1 FROM service_cases old WHERE old.ward=c.ward AND old.department=c.department
              AND old.location=c.location AND old.resolved_at<=c.created_at AND old.id<>c.id) AS repeated
            FROM service_cases c JOIN case_staff s ON s.ward=c.ward AND s.department=c.department
              AND s.user_id=%s AND s.role='supervisor'
            LEFT JOIN case_targets t ON t.case_id=c.id
            WHERE c.status<>'resolved' OR EXISTS (SELECT 1 FROM authority_referrals f WHERE f.case_id=c.id
              AND f.acknowledged_at IS NULL) ORDER BY c.created_at,c.id""", (user,))
        return cur.fetchall()


def reviewers(user):
    with cases.transaction() as cur:
        cur.execute("""SELECT s.ward,s.department,u.id,u.username FROM case_staff own
            JOIN case_staff s ON s.ward=own.ward AND s.department=own.department AND s.role='supervisor'
            JOIN users u ON u.id=s.user_id AND u.is_active=1 WHERE own.user_id=%s AND own.role='supervisor'
            ORDER BY s.ward,s.department,u.username""", (user,))
        return cur.fetchall()

def verification_history(user):
    with cases.transaction() as cur:
        cur.execute("""SELECT r.id,r.ward,r.department,r.locality,r.office,r.designation,r.target_hours,
                       r.verified_at,u.username AS verifier FROM responsibility_rules r
                       JOIN users u ON u.id=r.verified_by JOIN case_staff s ON s.ward=r.ward
                       AND s.department=r.department AND s.role='supervisor' AND s.user_id=%s
                       ORDER BY r.id DESC""", (user,))
        return cur.fetchall()
