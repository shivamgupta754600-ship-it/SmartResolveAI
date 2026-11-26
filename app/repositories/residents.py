from hashlib import sha256
from secrets import token_hex
import re

from fastapi import HTTPException

from app.core.config import settings


def profile(cursor, user_id, lock=False):
    query = """SELECT u.full_name,u.phone,COALESCE(v.phone=u.phone,0) AS phone_verified,r.document_type,r.document_suffix
               FROM users u LEFT JOIN resident_identity r ON r.user_id=u.id
               LEFT JOIN verified_phones v ON v.user_id=u.id
               WHERE u.id=%s AND u.is_active=1"""
    cursor.execute(query + (" FOR UPDATE" if lock else ""), (user_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(403, "inactive_account")
    row["verification_required"] = settings.PHONE_VERIFICATION_REQUIRED
    phone_eligible = row["phone_verified"] or not row["verification_required"]
    row["ready"] = bool(phone_eligible and row["document_type"] and (row["full_name"] or "").strip()
                        and re.fullmatch(r"(?:[+]91|91)?[6-9][0-9]{9}", row["phone"] or ""))
    return row


def require_profile(cursor, user_id):
    record = profile(cursor, user_id, lock=True)
    if not record["ready"]:
        raise HTTPException(409, "resident_profile_required")
    return record


def stop_outdated_sms(cursor, user_id, phone):
    params = (user_id, "+91" + phone[-10:])
    cursor.execute("""UPDATE service_cases c JOIN case_residents r ON r.case_id=c.id
                      SET c.contact_phone=NULL WHERE r.user_id=%s AND c.contact_phone<>%s""", params)
    cursor.execute("""DELETE m FROM case_sms m JOIN case_events e ON e.id=m.event_id
                      JOIN service_cases c ON c.id=e.case_id JOIN case_residents r ON r.case_id=c.id
                      WHERE r.user_id=%s AND c.contact_phone IS NULL AND m.sent_at IS NULL""", (user_id,))



def save_profile(cursor, user_id, body):
    current = profile(cursor,user_id,lock=True)
    phone = body.phone[-10:]
    if settings.PHONE_VERIFICATION_REQUIRED and (not current["phone_verified"] or current["phone"] != phone):
        raise HTTPException(409, "Verify your contact number before saving.")
    if current["phone"] != phone:
        stop_outdated_sms(cursor, user_id, phone)
        cursor.execute("DELETE FROM verified_phones WHERE user_id=%s", (user_id,))
    cursor.execute("UPDATE users SET full_name=%s,phone=%s WHERE id=%s", (body.full_name,phone,user_id))
    args = (body.document_type, body.document_suffix.upper())
    cursor.execute("""INSERT INTO resident_identity(user_id,document_type,document_suffix) VALUES (%s,%s,%s)
                   ON DUPLICATE KEY UPDATE document_type=%s,document_suffix=%s,
                   assistance_hash=NULL,assistance_expires=NULL""", (user_id, *args, *args))
    return profile(cursor, user_id)


def issue_code(cursor, user_id):
    require_profile(cursor, user_id)
    code = token_hex(8)
    cursor.execute("""UPDATE resident_identity SET assistance_hash=%s,
                      assistance_expires=UTC_TIMESTAMP()+INTERVAL 30 MINUTE WHERE user_id=%s""",
                   (sha256(code.encode()).digest(), user_id))
    return {"code": code}


def redeem_code(cursor, code):
    cursor.execute("""SELECT user_id FROM resident_identity WHERE assistance_hash=%s
                      AND assistance_expires>UTC_TIMESTAMP() FOR UPDATE""", (sha256(code.lower().encode()).digest(),))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(422, "invalid_assistance_code")
    cursor.execute("UPDATE resident_identity SET assistance_hash=NULL,assistance_expires=NULL WHERE user_id=%s",
                   (row["user_id"],))
    return row["user_id"]


def history(cursor, user_id, before):
    cursor.execute("""SELECT c.id,c.ticket,c.status,c.department,c.created_at FROM case_residents r
                      JOIN service_cases c ON c.id=r.case_id WHERE r.user_id=%s AND (%s=0 OR c.id<%s)
                      ORDER BY c.id DESC LIMIT 25""", (user_id, before, before))
    return cursor.fetchall()
