"""Run with python -m app.services.case_worker from a scheduled job."""
import argparse
import json
import logging
import os
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from app.repositories.cases import event, transaction
from app.services.prediction import MODEL_PATH, suggest_category

log = logging.getLogger(__name__)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def classify(cursor, retry_unavailable=False):
    cursor.execute(
        """SELECT id, description FROM service_cases
           WHERE suggestion_state='pending' OR (%s AND suggestion_state='unavailable')
           ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED""",
        (retry_unavailable,),
    )
    for row in cursor.fetchall():
        try:
            category, scores = suggest_category(row["description"])
        except Exception:
            log.warning("Advisory classifier unavailable for case %s", row["id"])
            cursor.execute("UPDATE service_cases SET suggestion_state='unavailable' WHERE id=%s", (row["id"],))
            continue
        cursor.execute(
            """UPDATE service_cases SET suggestion_state='ready', suggested_category=%s,
               suggestion_confidence=%s, suggestion_model=%s WHERE id=%s""",
            (category, scores[category], MODEL_PATH.name, row["id"]),
        )


def escalate(cursor):
    cursor.execute(
        """SELECT id FROM service_cases
           WHERE status<>'resolved' AND escalated_at IS NULL AND next_update_at<UTC_TIMESTAMP()
           ORDER BY next_update_at LIMIT 100 FOR UPDATE SKIP LOCKED"""
    )
    for row in cursor.fetchall():
        cursor.execute("UPDATE service_cases SET escalated_at=UTC_TIMESTAMP() WHERE id=%s", (row["id"],))
        event(cursor, row["id"], "escalated")


def deliver(cursor, url, token):
    if not url:
        return
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or not token:
        raise ValueError("Configure an HTTPS SMS webhook and a bearer token.")
    cursor.execute(
        """SELECT m.event_id, e.kind, c.language, c.contact_phone
           FROM case_sms m JOIN case_events e ON e.id=m.event_id
           JOIN service_cases c ON c.id=e.case_id
           WHERE m.sent_at IS NULL AND m.attempts<8 AND m.try_at<=UTC_TIMESTAMP()
           ORDER BY m.try_at,m.event_id LIMIT 1 FOR UPDATE SKIP LOCKED"""
    )
    row = cursor.fetchone()
    if row is None:
        return False
    # A user-entered number may belong to someone else. Send a generic update only.
    message = ("आपकी शिकायत का एक अपडेट उपलब्ध है। अपनी निजी रसीद से स्थिति देखें।"
               if row["language"] == "hi" else
               "A grievance update is available. Use your private receipt to check its status.")
    request = Request(url, json.dumps({"to": row["contact_phone"], "message": message}).encode(),
                      {"Content-Type": "application/json", "Authorization": f"Bearer {token}",
                       "Idempotency-Key": f"smartresolve-case-event-{row['event_id']}"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=5):
            pass
    except OSError:
        log.warning("SMS delivery failed for event %s", row["event_id"])
        cursor.execute(
            """UPDATE case_sms SET attempts=attempts+1, try_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
               WHERE event_id=%s""", (row["event_id"],),
        )
    else:
        cursor.execute("UPDATE case_sms SET sent_at=UTC_TIMESTAMP() WHERE event_id=%s", (row["event_id"],))
    return True


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_mutually_exclusive_group()
    commands.add_argument("--purge-resolved-days", type=int, help="Apply the approved retention period to closed cases.")
    commands.add_argument("--retry-unavailable", action="store_true", help="Retry cases after restoring the model.")
    args = parser.parse_args()
    if args.purge_resolved_days is not None:
        if args.purge_resolved_days < 1:
            parser.error("retention must be at least one day")
        with transaction() as cursor:
            cursor.execute(
                """DELETE FROM service_cases WHERE status='resolved'
                   AND NOT EXISTS (SELECT 1 FROM service_appeals a WHERE a.case_id=service_cases.id AND a.decided_at IS NULL)
                   AND NOT EXISTS (SELECT 1 FROM authority_referrals f WHERE f.case_id=service_cases.id AND f.acknowledged_at IS NULL)
                   AND NOT EXISTS (SELECT 1 FROM case_targets t JOIN responsibility_rules r ON r.id=t.rule_id
                       WHERE t.case_id=service_cases.id AND r.scheme IS NOT NULL
                       AND DATE_ADD(service_cases.resolved_at, INTERVAL r.appeal_days DAY)>=UTC_TIMESTAMP())
                   AND resolved_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL %s DAY)
                   ORDER BY resolved_at LIMIT 500""", (args.purge_resolved_days,),
            )
            print(f"Purged {cursor.rowcount} resolved cases")
        return
    with transaction() as cursor:
        escalate(cursor)
    with transaction() as cursor:
        classify(cursor, retry_unavailable=args.retry_unavailable)
    for _ in range(25):
        with transaction() as cursor:
            if not deliver(cursor, os.getenv("CASE_SMS_WEBHOOK"), os.getenv("CASE_SMS_TOKEN")):
                break


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
