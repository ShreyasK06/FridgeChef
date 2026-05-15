"""FastAPI app. Serves frontend and two AI-backed endpoints."""
import io
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from backend import vision_client
from backend.errors import ExternalAPIError
from backend.food_filter import filter_labels
from backend.schemas import IngredientsResponse

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("fridgechef")

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="FridgeChef")


@app.post("/api/detect", response_model=IngredientsResponse)
async def detect(image: UploadFile = File(...)) -> IngredientsResponse:
    if image.content_type not in ALLOWED_MIMES:
        raise HTTPException(400, f"Unsupported content type: {image.content_type}")

    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Image exceeds 10 MB limit")
    if len(data) == 0:
        raise HTTPException(400, "Empty upload")

    try:
        Image.open(io.BytesIO(data)).verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "Could not read image")

    try:
        raw = vision_client.detect_raw_labels(data)
    except ExternalAPIError as exc:
        log.warning("vision failure: %s", exc)
        raise HTTPException(502, str(exc))

    return IngredientsResponse(ingredients=filter_labels(raw))
