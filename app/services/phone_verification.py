import hashlib
import hmac
import json
import os
import secrets
from datetime import timedelta
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

from app.core.config import settings
from app.repositories.residents import stop_outdated_sms
from app.repositories.cases import transaction, utc_now


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def post_json(url, body, headers=None, *, read_json=False):
    req = Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with build_opener(NoRedirect()).open(req, timeout=6) as result:
            return json.loads(result.read(16384)) if read_json else None
    except (URLError, OSError, ValueError):
        raise HTTPException(503, "Verification provider unavailable. Please try again.") from None


def check_captcha(token, action):
    secret = os.getenv("TURNSTILE_SECRET_KEY")
    hosts = {host.strip().lower() for host in os.getenv("TURNSTILE_HOSTNAMES", "").split(",") if host.strip()}
    if not secret or not hosts:
        raise HTTPException(503, "CAPTCHA is not configured.")
    result = post_json("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                       {"secret": secret, "response": token}, read_json=True)
    if not isinstance(result, dict) or result.get("success") is not True or result.get("action") != action or result.get("hostname", "").lower() not in hosts:
        raise HTTPException(400, "Complete the CAPTCHA again.")


def send_code(phone, code, challenge):
    url = os.getenv("OTP_SMS_WEBHOOK", "")
    token = os.getenv("OTP_SMS_TOKEN")
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or not token:
        raise HTTPException(503, "Mobile verification delivery is not configured.")
    post_json(url, {"to": "+91" + phone, "message": f"Your SmartResolve verification code is {code}. Valid for 5 minutes."},
              {"Authorization": "Bearer " + token, "Idempotency-Key": challenge})


def code_hash(challenge, code):
    return hmac.digest(settings.SECRET_KEY.encode(), f"phone-otp:{challenge}:{code}".encode(), "sha256")


def issue(body, user_id=None):
    check_captcha(body.captcha, "register" if user_id is None else "change_phone")
    challenge = secrets.token_hex(16)
    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction() as cur:
        cur.execute("DELETE FROM phone_challenges WHERE last_sent < UTC_TIMESTAMP()-INTERVAL 2 DAY LIMIT 50")
        # The unique phone row serializes send quotas across workers.
        cur.execute("""INSERT INTO phone_challenges(phone,challenge,expires_at,attempts,last_sent,window_start,sent_count)
                       VALUES(%s,%s,UTC_TIMESTAMP(),0,UTC_TIMESTAMP(),UTC_TIMESTAMP(),0)
                       ON DUPLICATE KEY UPDATE phone=phone""", (body.phone, challenge))
        cur.execute("SELECT last_sent,window_start,sent_count FROM phone_challenges WHERE phone=%s FOR UPDATE", (body.phone,))
        row = cur.fetchone()
        now = utc_now()
        count = row["sent_count"]
        window = row["window_start"]
        if now >= window + timedelta(days=1):
            count, window = 0, now
        if (row["sent_count"] and now < row["last_sent"] + timedelta(seconds=60)) or count >= 5:
            raise HTTPException(429, "SMS send limit reached. Wait before requesting another code.")
        cur.execute("""UPDATE phone_challenges SET challenge=%s,subject_id=%s,code_hash=%s,proof_hash=NULL,
                       expires_at=%s,attempts=5,last_sent=%s,window_start=%s,sent_count=%s WHERE phone=%s""",
                    (challenge,user_id,code_hash(challenge, code),now+timedelta(minutes=5),now,window,count+1,body.phone))
    try:
        send_code(body.phone, code, challenge)
    except HTTPException:
        with transaction() as cur:
            cur.execute("UPDATE phone_challenges SET code_hash=NULL,attempts=0 WHERE challenge=%s", (challenge,))
        raise
    return {"challenge": challenge}


def verify(body):
    proof = None
    with transaction() as cur:
        cur.execute("""SELECT code_hash,attempts FROM phone_challenges WHERE challenge=%s
                       AND expires_at>UTC_TIMESTAMP() FOR UPDATE""", (body.challenge,))
        row = cur.fetchone()
        if row and row["attempts"] and row["code_hash"]:
            if hmac.compare_digest(row["code_hash"], code_hash(body.challenge, body.code)):
                proof = secrets.token_hex(32)
                cur.execute("""UPDATE phone_challenges SET code_hash=NULL,attempts=0,proof_hash=%s,
                               expires_at=UTC_TIMESTAMP()+INTERVAL 10 MINUTE WHERE challenge=%s""",
                            (hashlib.sha256(proof.encode()).digest(), body.challenge))
            else:
                cur.execute("UPDATE phone_challenges SET attempts=attempts-1 WHERE challenge=%s", (body.challenge,))
    if not proof:
        raise HTTPException(400, "Incorrect or expired code. Check the SMS or request a new code.")
    return {"phone_proof": proof}


def consume(cur, phone, proof, user_id=None):
    cur.execute("""UPDATE phone_challenges SET proof_hash=NULL WHERE phone=%s AND subject_id <=> %s
                   AND proof_hash=%s AND expires_at>UTC_TIMESTAMP()""",
                (phone, user_id, hashlib.sha256(proof.encode()).digest()))
    if cur.rowcount != 1:
        raise HTTPException(400, "Verify this mobile number again.")


def record(cur, user_id, phone):
    cur.execute("""INSERT INTO verified_phones(user_id,phone) VALUES(%s,%s)
                   ON DUPLICATE KEY UPDATE phone=%s,verified_at=UTC_TIMESTAMP()""", (user_id,phone,phone))


def change_phone(body, user_id):
    with transaction() as cur:
        consume(cur, body.phone, body.phone_proof, user_id)
        cur.execute("UPDATE users SET phone=%s WHERE id=%s", (body.phone,user_id))
        stop_outdated_sms(cur, user_id, body.phone)
        record(cur,user_id,body.phone)
    return {"verified": True}
