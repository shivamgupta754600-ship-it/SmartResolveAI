import unittest
from unittest.mock import Mock

from fastapi import HTTPException

from app.repositories.cases import resident_case
from app.schemas.cases import TicketReference
from app.services.account_recovery import recover


class PilotControls(unittest.TestCase):
    def test_owner_lookup_checks_account_and_ticket_in_same_query(self):
        cursor = Mock()
        cursor.fetchone.return_value = None
        ticket = TicketReference(ticket="SR-" + "A" * 21)
        with self.assertRaises(HTTPException) as failure:
            resident_case(cursor, ticket, owner_id=42)
        self.assertEqual(failure.exception.status_code, 404)
        sql, params = cursor.execute.call_args.args
        self.assertIn("r.user_id=%s", sql)
        self.assertIn("c.ticket=%s", sql)
        self.assertEqual(params, (ticket.ticket, 42))

    def test_recovery_rejects_empty_reference_and_weak_password(self):
        with self.assertRaises(ValueError):
            recover("revoke_sessions", "resident", "")
        with self.assertRaises(ValueError):
            recover("resident_password", "resident", "DESK-1", "weak")
