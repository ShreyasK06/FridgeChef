"""Shared test fixtures."""
import io

import pytest
from PIL import Image


@pytest.fixture
def tiny_jpeg() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), "red").save(buf, "JPEG")
    return buf.getvalue()


@pytest.fixture
def tiny_png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), "blue").save(buf, "PNG")
    return buf.getvalue()
