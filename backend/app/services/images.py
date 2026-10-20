"""Validate and store uploaded photos.

An upload is trusted for nothing: its name and declared type are ignored, the
bytes must decode as a real JPEG, PNG or WebP within size limits, and the image
is re-encoded before saving, which drops EXIF (GPS) data and anything smuggled
after the pixels.
"""

import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_PIXELS = 40_000_000  # about 7000 x 5700; refuses decompression bombs
MAX_SIDE = 1600  # the stored copy is downscaled to this on its longest side

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class ImageRejected(ValueError):
    pass


def load_upload(data: bytes) -> Image.Image:
    if not data:
        raise ImageRejected("The file is empty.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise ImageRejected("Upload a JPEG, PNG or WebP photo.")
            # Pillow only raises past twice MAX_IMAGE_PIXELS, so check the header's size ourselves
            # before anything is decoded.
            width, height = probe.size
            if width * height > MAX_PIXELS:
                raise ImageRejected("That photo is too large. Use one under 40 megapixels.")
            probe.verify()
        image = Image.open(io.BytesIO(data))
        image.load()
    except ImageRejected:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError) as exc:
        raise ImageRejected("That file isn't a readable JPEG, PNG or WebP photo.") from exc
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


THUMB_SIDE = 320


def thumb_name(relative: str) -> str:
    return relative.removesuffix(".jpg") + "_thumb.jpg"


def save_image(image: Image.Image) -> str:
    """Save a re-encoded copy (and a small thumbnail beside it) under a random name.

    Returns the full copy's path relative to UPLOAD_DIR.
    """
    root = get_settings().upload_path
    name = f"{uuid.uuid4().hex}.jpg"
    stored = image.copy()
    stored.thumbnail((MAX_SIDE, MAX_SIDE))
    stored.save(root / name, format="JPEG", quality=88, optimize=True)
    stored.thumbnail((THUMB_SIDE, THUMB_SIDE))
    stored.save(root / thumb_name(name), format="JPEG", quality=82, optimize=True)
    return name


def resolve_image(relative: str) -> Path | None:
    """Map a stored relative path back to a file inside UPLOAD_DIR, or None."""
    root = get_settings().upload_path.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        return None
    return path


def delete_image(relative: str) -> None:
    for name in (relative, thumb_name(relative)):
        path = resolve_image(name)
        if path is not None:
            path.unlink(missing_ok=True)
