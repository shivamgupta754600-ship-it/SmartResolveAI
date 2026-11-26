"""Restricted operator tool for an approved identity recovery request."""
import argparse
from getpass import getpass

from app.core.security import hash_password
from app.repositories.cases import transaction
from app.schemas.auth import validate_password


def recover(operation, username, reference, password=None):
    if not reference.strip() or len(reference) > 80:
        raise ValueError("Enter a recovery reference of up to 80 characters.")
    if operation == "resident_password":
        hashed = hash_password(validate_password(password or ""))
    elif operation != "revoke_sessions":
        raise ValueError("Unknown operation.")

    with transaction() as cursor:
        cursor.execute("SELECT id,is_admin,is_active FROM users WHERE username=%s FOR UPDATE", (username,))
        user = cursor.fetchone()
        if not user or (operation == "resident_password" and not user["is_active"]):
            raise ValueError("Account unavailable.")
        uid = user["id"]
        if operation == "resident_password":
            cursor.execute("SELECT 1 FROM case_staff WHERE user_id=%s LIMIT 1 FOR UPDATE", (uid,))
            if cursor.fetchone() or user["is_admin"]:
                raise ValueError("Staff and admin accounts require the staff recovery process.")
            cursor.execute("UPDATE users SET hashed_password=%s WHERE id=%s", (hashed, uid))
        cursor.execute("DELETE FROM auth_sessions WHERE user_id=%s", (uid,))
        cursor.execute("UPDATE resident_identity SET assistance_hash=NULL,assistance_expires=NULL WHERE user_id=%s", (uid,))
        cursor.execute("""INSERT INTO account_recovery_log(user_id,reference_number,operation,performed_by)
                          VALUES (%s,%s,%s,USER())""", (uid, reference, operation))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["resident_password", "revoke_sessions"])
    parser.add_argument("username")
    parser.add_argument("reference", help="Approved help-desk case number")
    args = parser.parse_args()
    password = None
    if args.operation == "resident_password":
        password = getpass("Resident enters new password: ")
        if password != getpass("Confirm password: "):
            parser.error("Passwords differ.")
    try:
        recover(args.operation, args.username, args.reference, password)
    except ValueError as exc:
        parser.error(str(exc))
    print("Recovery recorded. Existing sessions and filing codes revoked.")
