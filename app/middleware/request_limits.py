"""Bound incoming bodies before JSON parsing, including chunked requests."""
from starlette.responses import JSONResponse


class RequestLimits:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)

        path = scope["path"].rstrip("/")
        # Intake may include one base64-encoded evidence image.
        limit = 7 * 1024 * 1024 if path in {"/cases", "/cases/staff/assisted"} else 128 * 1024
        reject = JSONResponse({"detail": "Request body too large."}, status_code=413)
        headers = dict(scope["headers"])
        length = headers.get(b"content-length", b"0")
        if not length.isdigit() or len(length) > 16 or int(length) > limit:
            await reject(scope, receive, send)
            return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > limit:
                await reject(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body"):
                break

        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, bounded_receive, send)
