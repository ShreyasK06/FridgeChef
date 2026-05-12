"""Wrapper around Google Cloud Vision's label detection."""
from google.cloud import vision

from backend.errors import ExternalAPIError


def detect_raw_labels(image_bytes: bytes) -> list[tuple[str, float]]:
    """Return (description, score) pairs from Vision label detection."""
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.label_detection(image=image)
    except Exception as exc:
        raise ExternalAPIError("Vision service unavailable") from exc

    if response.error.message:
        raise ExternalAPIError(f"Vision API error: {response.error.message}")

    return [(label.description, label.score) for label in response.label_annotations]
