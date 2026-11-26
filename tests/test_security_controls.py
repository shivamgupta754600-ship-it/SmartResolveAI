import unittest
from unittest.mock import AsyncMock

from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.middleware.request_limits import RequestLimits


class CredentialTests(unittest.TestCase):
    def test_placeholder_rejected_in_local_mode(self):
        with self.assertRaises(ValidationError):
            Settings(SECRET_KEY="CHANGE-THIS-TO-A-SECURE-RANDOM-64-CHAR-HEX-KEY",
                     CASE_PUBLIC_DEPLOYMENT=False)

    def test_access_token_round_trip(self):
        claims = decode_token(create_access_token({"sub": "test-resident"}))
        self.assertEqual(claims["token_type"], "access")
        self.assertEqual(claims["sub"], "test-resident")

    def test_bcrypt_limit_counts_bytes(self):
        with self.assertRaises(ValueError):
            hash_password("म" * 25)
        self.assertFalse(verify_password("म" * 25, hash_password("test password")))


class RequestSizeTests(unittest.IsolatedAsyncioTestCase):
    async def test_chunked_limit_checked_before_handler(self):
        app, send = AsyncMock(), AsyncMock()
        receive = AsyncMock(side_effect=[
            {"type": "http.request", "body": bytes(100_000), "more_body": True},
            {"type": "http.request", "body": bytes(40_000)},
        ])
        await RequestLimits(app)({"type":"http","method":"POST","path":"/auth/login","headers":[]}, receive, send)
        app.assert_not_awaited()
        self.assertEqual(send.await_args_list[0].args[0]["status"], 413)
