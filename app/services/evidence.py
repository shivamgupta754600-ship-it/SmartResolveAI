"""Decode a resident's optional photo into a bounded, metadata-free display copy."""
from base64 import b64decode
from binascii import Error as Base64Error
from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 24_000_000


def prepare_photo(encoded: str) -> bytes:
    try:
        raw = b64decode(encoded, validate=True)
        if len(raw) > MAX_BYTES:
            raise HTTPException(422, "photo_too_large")
        with Image.open(BytesIO(raw), formats=("JPEG", "PNG", "WEBP")) as source:
            if source.width * source.height > MAX_PIXELS:
                raise HTTPException(422, "photo_too_large")
            if getattr(source, "is_animated", False):
                raise HTTPException(422, "invalid_photo")
            source.load()
            image = ImageOps.exif_transpose(source)
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            rgba = image.convert("RGBA")
            clean = Image.new("RGB", rgba.size, "white")
            clean.paste(rgba, mask=rgba.getchannel("A"))
            output = BytesIO()
            clean.save(output, format="JPEG", quality=88)
            return output.getvalue()
    except Image.DecompressionBombError:
        raise HTTPException(422, "photo_too_large") from None
    except (Base64Error, UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise HTTPException(422, "invalid_photo") from None
