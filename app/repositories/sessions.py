from secrets import token_hex

from app.repositories.cases import transaction, utc_now


def start(cursor, user_id, lifetime):
    sid = token_hex(16)
    cursor.execute("DELETE FROM auth_sessions WHERE expires_at<=UTC_TIMESTAMP() LIMIT 100")
    cursor.execute("INSERT INTO auth_sessions VALUES (%s,%s,%s)", (sid,user_id,utc_now()+lifetime))
    return sid


def active(user_id, sid):
    if not isinstance(sid, str) or len(sid) != 32:
        return False
    with transaction() as cursor:
        cursor.execute("SELECT 1 FROM auth_sessions WHERE id=%s AND user_id=%s AND expires_at>UTC_TIMESTAMP()",
                       (sid,user_id))
        return cursor.fetchone() is not None


def revoke(sid):
    with transaction() as cursor:
        cursor.execute("DELETE FROM auth_sessions WHERE id=%s", (sid,))
