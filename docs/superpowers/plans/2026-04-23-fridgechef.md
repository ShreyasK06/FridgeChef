# FridgeChef Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FridgeChef web app per the design spec — photo upload → Google Cloud Vision → editable ingredient chips → Gemini 2.5 Flash → three structured recipes.

**Architecture:** FastAPI serves both the vanilla-JS frontend (via StaticFiles mount at `/`) and two JSON endpoints (`/api/detect`, `/api/recipes`). Backend is split into five focused modules so external-service clients can be mocked at the module boundary in tests. Frontend is three DOM states swapped in place, styled with modern CSS.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, google-cloud-vision, google-genai (Gemini), Pillow, python-dotenv, pytest. Vanilla HTML/CSS/JS on the client.

**Reference:** [design spec](../specs/2026-04-23-fridgechef-design.md)

---

## File Structure

```
FridgeChef/
├── .gitignore                             # create (Task 1)
├── README.md                              # create (Task 14)
├── pyproject.toml                         # create (Task 1) — pytest config only
├── backend/
│   ├── __init__.py                        # create (Task 1) — empty
│   ├── main.py                            # create (Task 6) + extended (Tasks 7, 8)
│   ├── schemas.py                         # create (Task 2)
│   ├── food_filter.py                     # create (Task 3)
│   ├── vision_client.py                   # create (Task 4)
│   ├── gemini_client.py                   # create (Task 5)
│   ├── requirements.txt                   # create (Task 1)
│   ├── .env.example                       # create (Task 1)
│   └── tests/
│       ├── __init__.py                    # create (Task 1) — empty
│       ├── conftest.py                    # create (Task 6) — shared fixtures
│       ├── test_food_filter.py            # create (Task 3)
│       └── test_routes.py                 # create (Task 6) + extended (Task 7)
├── frontend/
│   ├── index.html                         # create (Task 9) + extended (Tasks 10-13)
│   ├── style.css                          # create (Task 9) + extended (Tasks 10-13)
│   └── app.js                             # create (Task 9) + extended (Tasks 10-13)
└── docs/superpowers/
    ├── specs/2026-04-23-fridgechef-design.md   # already exists
    └── plans/2026-04-23-fridgechef.md          # this file
```

**Module responsibilities:**
- `schemas.py` — Pydantic request/response models. No logic.
- `food_filter.py` — `FOOD_KEYWORDS` set + `filter_labels()`. Pure function, fully unit-tested.
- `vision_client.py` — thin wrapper around `google.cloud.vision`. Exposes `detect_raw_labels(image_bytes) -> list[RawLabel]`.
- `gemini_client.py` — thin wrapper around `google.genai`. Exposes `generate_recipes(ingredients) -> list[Recipe]`.
- `main.py` — FastAPI app, route handlers, error mapping, CORS, static mount. No business logic beyond orchestration.

---

## Task 1: Project scaffolding

**Files:**
- Create: `.gitignore`
- Create: `pyproject.toml`
- Create: `backend/__init__.py` (empty)
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`

- [ ] **Step 1: Create `.gitignore`**

```
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/
.env
*.json
!package.json
!pyproject.toml
.DS_Store
Thumbs.db
```

(The `*.json` ignore catches service-account credentials dumped anywhere in the tree. The `!` lines keep metadata JSON files if added later.)

- [ ] **Step 2: Create `pyproject.toml`**

```toml
[tool.pytest.ini_options]
testpaths = ["backend/tests"]
pythonpath = ["."]
```

- [ ] **Step 3: Create empty `backend/__init__.py` and `backend/tests/__init__.py`**

Both files exist and contain nothing. They make the directories importable as packages so `from backend.schemas import …` works from the repo root.

- [ ] **Step 4: Create `backend/requirements.txt`**

```
fastapi>=0.110
uvicorn[standard]>=0.29
python-dotenv>=1.0
google-cloud-vision>=3.7
google-genai>=0.3
pillow>=10.0
pytest>=8.0
httpx>=0.27
```

- [ ] **Step 5: Create `backend/.env.example`**

```
# Absolute path to your Google Cloud service-account JSON (Vision API).
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json

# From https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key-here

# Optional overrides.
GEMINI_MODEL=gemini-2.5-flash
LOG_LEVEL=INFO
```

- [ ] **Step 6: Install dependencies**

Run from repo root:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
```

Expected: clean install, no errors. Verify `pytest --version` and `uvicorn --version` both print.

- [ ] **Step 7: Commit**

```bash
git add .gitignore pyproject.toml backend/__init__.py backend/tests/__init__.py backend/requirements.txt backend/.env.example
git commit -m "chore: scaffold project structure and dependencies"
```

---

## Task 2: Pydantic schemas

**Files:**
- Create: `backend/schemas.py`

No tests — Pydantic's own validation is the test. These types are referenced everywhere downstream.

- [ ] **Step 1: Create `backend/schemas.py`**

```python
"""Request and response schemas for FridgeChef routes and Gemini output."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class IngredientsRequest(BaseModel):
    ingredients: list[str] = Field(min_length=1, max_length=30)

    @field_validator("ingredients")
    @classmethod
    def _strip_and_bounds_check(cls, v: list[str]) -> list[str]:
        out = []
        for item in v:
            stripped = item.strip()
            if not (1 <= len(stripped) <= 50):
                raise ValueError("each ingredient must be 1-50 characters")
            out.append(stripped)
        return out


class IngredientsResponse(BaseModel):
    ingredients: list[str]


class RecipeIngredient(BaseModel):
    item: str
    quantity: str


class Recipe(BaseModel):
    name: str
    description: str
    cook_time_minutes: int = Field(ge=1, le=480)
    difficulty: Literal["easy", "medium", "hard"]
    ingredients: list[RecipeIngredient] = Field(min_length=1)
    steps: list[str] = Field(min_length=1)


class RecipesResponse(BaseModel):
    recipes: list[Recipe]
```

- [ ] **Step 2: Verify imports load**

```bash
python -c "from backend.schemas import IngredientsRequest, Recipe, RecipesResponse; print('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add pydantic schemas for requests and recipes"
```

---

## Task 3: Food filter (TDD)

**Files:**
- Create: `backend/food_filter.py`
- Create: `backend/tests/test_food_filter.py`

Unit tests drive the implementation. `filter_labels` takes a list of `(description, score)` pairs and returns a deduplicated, filtered list of lowercase ingredient strings.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_food_filter.py`:

```python
from backend.food_filter import filter_labels


def test_keeps_food_labels_above_threshold():
    labels = [
        ("Bell pepper", 0.95),
        ("Milk", 0.88),
        ("Chicken breast", 0.81),
    ]
    result = filter_labels(labels)
    assert "bell pepper" in result
    assert "milk" in result
    assert "chicken breast" in result


def test_drops_non_food_labels():
    labels = [
        ("Shelf", 0.99),
        ("Plastic container", 0.97),
        ("Refrigerator", 0.94),
        ("Tomato", 0.80),
    ]
    result = filter_labels(labels)
    assert result == ["tomato"]


def test_drops_low_score_labels():
    labels = [
        ("Apple", 0.95),
        ("Banana", 0.45),  # below 0.6 threshold
    ]
    result = filter_labels(labels)
    assert result == ["apple"]


def test_deduplicates_case_insensitively():
    labels = [
        ("Milk", 0.95),
        ("milk", 0.92),
        ("MILK", 0.88),
    ]
    result = filter_labels(labels)
    assert result == ["milk"]


def test_empty_input_returns_empty_list():
    assert filter_labels([]) == []


def test_custom_threshold():
    labels = [("Apple", 0.55)]
    assert filter_labels(labels, min_score=0.5) == ["apple"]
    assert filter_labels(labels, min_score=0.6) == []
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest backend/tests/test_food_filter.py -v
```

Expected: all 6 tests fail with `ModuleNotFoundError: No module named 'backend.food_filter'`.

- [ ] **Step 3: Implement `backend/food_filter.py`**

```python
"""Keyword allowlist and filter for Google Vision labels."""
import re

FOOD_KEYWORDS: frozenset[str] = frozenset({
    # produce
    "apple", "banana", "orange", "lemon", "lime", "grape", "berry", "strawberry",
    "blueberry", "raspberry", "blackberry", "pear", "peach", "plum", "melon",
    "watermelon", "pineapple", "mango", "avocado", "tomato", "potato", "onion",
    "garlic", "ginger", "carrot", "celery", "cucumber", "lettuce", "spinach",
    "kale", "cabbage", "broccoli", "cauliflower", "pepper", "chili", "corn",
    "peas", "bean", "beans", "mushroom", "zucchini", "squash", "eggplant",
    "radish", "herb", "parsley", "cilantro", "basil", "mint", "rosemary", "thyme",
    # proteins
    "chicken", "beef", "pork", "lamb", "bacon", "sausage", "ham", "turkey",
    "fish", "salmon", "tuna", "shrimp", "egg", "eggs", "tofu",
    # dairy
    "milk", "cheese", "butter", "yogurt", "cream", "cheddar", "mozzarella",
    "parmesan",
    # pantry / grains
    "bread", "pasta", "rice", "flour", "noodle", "noodles", "tortilla", "cereal",
    "oat", "oats",
    # condiments / oils
    "oil", "vinegar", "sauce", "ketchup", "mustard", "mayonnaise", "honey",
    "sugar", "salt",
    # generic food terms
    "fruit", "vegetable", "meat", "seafood", "produce", "juice", "food",
})

# Multi-word phrases we want to match exactly.
FOOD_PHRASES: frozenset[str] = frozenset({
    "bell pepper", "olive oil", "soy sauce", "chicken breast", "ground beef",
    "dairy product", "leafy green",
})

_WORD_RE = re.compile(r"[a-z]+")


def _is_food(description: str) -> bool:
    lowered = description.lower().strip()
    if lowered in FOOD_PHRASES:
        return True
    tokens = set(_WORD_RE.findall(lowered))
    return bool(tokens & FOOD_KEYWORDS)


def filter_labels(
    labels: list[tuple[str, float]],
    min_score: float = 0.6,
) -> list[str]:
    """Return deduplicated, lowercased food labels above the score threshold."""
    result: list[str] = []
    seen: set[str] = set()
    for description, score in labels:
        if score < min_score:
            continue
        lowered = description.lower().strip()
        if lowered in seen:
            continue
        if not _is_food(description):
            continue
        seen.add(lowered)
        result.append(lowered)
    return result
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest backend/tests/test_food_filter.py -v
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/food_filter.py backend/tests/test_food_filter.py
git commit -m "feat: add food keyword filter with pytest coverage"
```

---

## Task 4: Vision client wrapper

**Files:**
- Create: `backend/vision_client.py`

This is a thin wrapper. It isn't unit-tested in isolation — it's tested via route tests with mocks. The goal is a single, mockable function that returns plain `(description, score)` tuples so the filter can consume them without knowing anything about Google's SDK types.

- [ ] **Step 1: Create `backend/vision_client.py`**

```python
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
```

- [ ] **Step 2: Create `backend/errors.py`**

```python
"""Typed exceptions that map cleanly to HTTP responses."""


class ExternalAPIError(Exception):
    """Raised when an upstream AI service fails. Maps to HTTP 502."""
```

- [ ] **Step 3: Verify imports load**

```bash
python -c "from backend.vision_client import detect_raw_labels; print('ok')"
```

Expected: prints `ok`. (A credentials error is only raised when the function is actually called, not at import time.)

- [ ] **Step 4: Commit**

```bash
git add backend/vision_client.py backend/errors.py
git commit -m "feat: add Vision client wrapper with typed error"
```

---

## Task 5: Gemini client wrapper

**Files:**
- Create: `backend/gemini_client.py`

Wraps `google-genai`. Builds the recipe prompt, asks for JSON output, parses into `list[Recipe]`.

- [ ] **Step 1: Create `backend/gemini_client.py`**

```python
"""Wrapper around Google Gemini for recipe generation."""
import json
import os

from google import genai
from google.genai import types
from pydantic import ValidationError

from backend.errors import ExternalAPIError
from backend.schemas import Recipe


_PROMPT_TEMPLATE = """You are a creative home cook. Given this list of ingredients from a user's fridge, generate exactly 3 distinct recipes they could make.

Ingredients available:
{ingredients}

Requirements:
- Each recipe must primarily use the listed ingredients. You may assume basic pantry staples (salt, pepper, oil, water) are always available even if not listed.
- Provide varied cuisines/styles across the 3 recipes.
- Return ONLY a JSON array of 3 recipe objects. No prose, no markdown fences.

Each recipe object must match this schema exactly:
{{
  "name": "string",
  "description": "one-sentence pitch",
  "cook_time_minutes": integer between 1 and 480,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [{{"item": "string", "quantity": "string with amount"}}],
  "steps": ["numbered steps as plain strings, no leading numbers"]
}}
"""


def _build_prompt(ingredients: list[str]) -> str:
    bulleted = "\n".join(f"- {item}" for item in ingredients)
    return _PROMPT_TEMPLATE.format(ingredients=bulleted)


def generate_recipes(ingredients: list[str]) -> list[Recipe]:
    """Call Gemini and return three validated Recipe objects."""
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ExternalAPIError("GEMINI_API_KEY is not configured")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=_build_prompt(ingredients),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.9,
            ),
        )
    except Exception as exc:
        raise ExternalAPIError("Recipe generation failed") from exc

    text = (response.text or "").strip()
    try:
        raw = json.loads(text)
        return [Recipe.model_validate(item) for item in raw]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise ExternalAPIError("Recipe generation returned malformed data") from exc
```

- [ ] **Step 2: Verify imports load**

```bash
python -c "from backend.gemini_client import generate_recipes; print('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/gemini_client.py
git commit -m "feat: add Gemini client wrapper with JSON mode and schema validation"
```

---

## Task 6: `/api/detect` route (TDD)

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_routes.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/conftest.py`:

```python
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
```

Create `backend/tests/test_routes.py`:

```python
"""Route-level tests. External clients are mocked at the module boundary."""
from fastapi.testclient import TestClient

from backend import main
from backend.errors import ExternalAPIError


def _client() -> TestClient:
    return TestClient(main.app)


# ---------- /api/detect ----------

def test_detect_happy_path(monkeypatch, tiny_jpeg):
    monkeypatch.setattr(
        "backend.main.vision_client.detect_raw_labels",
        lambda _b: [
            ("Bell pepper", 0.95),
            ("Milk", 0.88),
            ("Shelf", 0.99),
        ],
    )
    response = _client().post(
        "/api/detect",
        files={"image": ("fridge.jpg", tiny_jpeg, "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert "bell pepper" in body["ingredients"]
    assert "milk" in body["ingredients"]
    assert "shelf" not in body["ingredients"]


def test_detect_missing_file_returns_400():
    response = _client().post("/api/detect")
    assert response.status_code in (400, 422)


def test_detect_rejects_bad_mime(tiny_jpeg):
    response = _client().post(
        "/api/detect",
        files={"image": ("fridge.txt", tiny_jpeg, "text/plain")},
    )
    assert response.status_code == 400


def test_detect_rejects_oversize_file(monkeypatch):
    big = b"\xff\xd8\xff" + b"\x00" * (10 * 1024 * 1024 + 1)  # > 10 MB
    response = _client().post(
        "/api/detect",
        files={"image": ("big.jpg", big, "image/jpeg")},
    )
    assert response.status_code == 400


def test_detect_rejects_unreadable_image():
    response = _client().post(
        "/api/detect",
        files={"image": ("bogus.jpg", b"not-a-real-image", "image/jpeg")},
    )
    assert response.status_code == 400


def test_detect_maps_vision_failure_to_502(monkeypatch, tiny_jpeg):
    def boom(_b):
        raise ExternalAPIError("Vision service unavailable")
    monkeypatch.setattr("backend.main.vision_client.detect_raw_labels", boom)
    response = _client().post(
        "/api/detect",
        files={"image": ("fridge.jpg", tiny_jpeg, "image/jpeg")},
    )
    assert response.status_code == 502
    assert "Vision" in response.json()["detail"]
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
pytest backend/tests/test_routes.py -v
```

Expected: all tests fail (cannot import `backend.main`).

- [ ] **Step 3: Implement `backend/main.py` — just enough for `/api/detect`**

```python
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

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
pytest backend/tests/test_routes.py -v
```

Expected: all 6 `/api/detect` tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/conftest.py backend/tests/test_routes.py
git commit -m "feat: add /api/detect route with input validation and tests"
```

---

## Task 7: `/api/recipes` route (TDD)

**Files:**
- Modify: `backend/main.py` — add the recipes route
- Modify: `backend/tests/test_routes.py` — append new tests

- [ ] **Step 1: Append failing tests to `backend/tests/test_routes.py`**

```python

# ---------- /api/recipes ----------

from backend.schemas import Recipe, RecipeIngredient


def _sample_recipe(name: str) -> Recipe:
    return Recipe(
        name=name,
        description="Test recipe.",
        cook_time_minutes=20,
        difficulty="easy",
        ingredients=[RecipeIngredient(item="salt", quantity="1 tsp")],
        steps=["Cook it."],
    )


def test_recipes_happy_path(monkeypatch):
    monkeypatch.setattr(
        "backend.main.gemini_client.generate_recipes",
        lambda _ings: [_sample_recipe("Dish 1"), _sample_recipe("Dish 2"), _sample_recipe("Dish 3")],
    )
    response = _client().post(
        "/api/recipes",
        json={"ingredients": ["milk", "bell pepper", "chicken breast"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["recipes"]) == 3
    assert body["recipes"][0]["name"] == "Dish 1"


def test_recipes_rejects_empty_list():
    response = _client().post("/api/recipes", json={"ingredients": []})
    assert response.status_code == 422


def test_recipes_rejects_too_many_items():
    response = _client().post(
        "/api/recipes", json={"ingredients": [f"item{i}" for i in range(31)]}
    )
    assert response.status_code == 422


def test_recipes_rejects_overlong_item():
    response = _client().post(
        "/api/recipes", json={"ingredients": ["x" * 51]}
    )
    assert response.status_code == 422


def test_recipes_maps_gemini_failure_to_502(monkeypatch):
    def boom(_ings):
        raise ExternalAPIError("Recipe generation failed")
    monkeypatch.setattr("backend.main.gemini_client.generate_recipes", boom)
    response = _client().post(
        "/api/recipes", json={"ingredients": ["milk"]}
    )
    assert response.status_code == 502
    assert "Recipe" in response.json()["detail"]
```

- [ ] **Step 2: Run tests — confirm recipes tests fail**

```bash
pytest backend/tests/test_routes.py -v -k recipes
```

Expected: all 5 new tests fail (route does not exist yet → 404).

- [ ] **Step 3: Extend `backend/main.py` with the recipes route**

Add these imports at the top, next to the existing ones:

```python
from backend import gemini_client
from backend.schemas import IngredientsRequest, RecipesResponse
```

Add this handler below the `detect` function:

```python
@app.post("/api/recipes", response_model=RecipesResponse)
async def recipes(payload: IngredientsRequest) -> RecipesResponse:
    try:
        result = gemini_client.generate_recipes(payload.ingredients)
    except ExternalAPIError as exc:
        log.warning("gemini failure: %s", exc)
        raise HTTPException(502, str(exc))
    return RecipesResponse(recipes=result)
```

- [ ] **Step 4: Run all route tests — confirm pass**

```bash
pytest backend/tests/test_routes.py -v
```

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_routes.py
git commit -m "feat: add /api/recipes route with validation and tests"
```

---

## Task 8: Static files mount + CORS

**Files:**
- Modify: `backend/main.py`
- Create: `frontend/` (empty directory placeholder — will be populated in later tasks)

FastAPI must register API routes before mounting StaticFiles at `/`, otherwise the catch-all intercepts `/api/*`. Order already correct: `detect` and `recipes` are defined before the mount.

- [ ] **Step 1: Create an empty `frontend/` directory with a placeholder**

```bash
mkdir -p frontend
echo "FridgeChef frontend" > frontend/index.html  # replaced in Task 9
```

- [ ] **Step 2: Extend `backend/main.py` with CORS and the static mount**

Add these imports near the existing ones:

```python
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
```

Add CORS middleware immediately after `app = FastAPI(...)`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

(CORS is permissive because frontend and backend share an origin in production use; the middleware is kept in case someone runs the frontend separately during development.)

At the end of the file, after all route handlers, mount the frontend:

```python
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
```

- [ ] **Step 3: Run the server manually and confirm it boots**

```bash
uvicorn backend.main:app --reload
```

Expected: server starts on `http://localhost:8000` with no import errors. Open the URL — you see the placeholder text. Kill with Ctrl+C.

- [ ] **Step 4: Re-run the full test suite**

```bash
pytest
```

Expected: all 11 tests still pass (CORS and static mount do not interfere).

- [ ] **Step 5: Commit**

```bash
git add backend/main.py frontend/index.html
git commit -m "feat: mount frontend as static files and enable CORS"
```

---

## Task 9: Frontend scaffold

**Files:**
- Overwrite: `frontend/index.html`
- Create: `frontend/style.css`
- Create: `frontend/app.js`

Basic HTML skeleton with three empty state containers. Styling and logic filled in later tasks.

- [ ] **Step 1: Overwrite `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FridgeChef</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <header>
      <h1>FridgeChef</h1>
      <p class="tagline">Snap your fridge, cook something great.</p>
    </header>

    <main id="app">
      <div id="error-bar" class="error-bar hidden" role="alert"></div>

      <section id="state-upload" class="state"></section>
      <section id="state-ingredients" class="state hidden"></section>
      <section id="state-recipes" class="state hidden"></section>
    </main>

    <script src="/app.js" defer></script>
  </body>
</html>
```

- [ ] **Step 2: Create `frontend/style.css` with base styles**

```css
:root {
  --bg: #fafaf7;
  --fg: #1f1f1f;
  --muted: #666;
  --border: #e5e5e0;
  --accent: #2f7d5b;
  --accent-dark: #215b42;
  --danger: #b3261e;
  --danger-bg: #fdecea;
  --radius: 12px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.04);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
}

header {
  text-align: center;
  padding: 2.5rem 1rem 1.5rem;
}

header h1 {
  margin: 0;
  font-size: 2.25rem;
  letter-spacing: -0.02em;
}

.tagline {
  margin: 0.25rem 0 0;
  color: var(--muted);
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem 1.25rem 4rem;
}

.state { animation: fade-in 160ms ease-out; }
.hidden { display: none !important; }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

button {
  font: inherit;
  cursor: pointer;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: #fff;
  padding: 0.65rem 1.1rem;
  transition: background 120ms, border-color 120ms;
}

button:hover:not(:disabled) { border-color: var(--fg); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

button.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

button.primary:hover:not(:disabled) { background: var(--accent-dark); border-color: var(--accent-dark); }

.error-bar {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
```

- [ ] **Step 3: Create `frontend/app.js` with state-switching skeleton**

```javascript
const states = {
  upload: document.getElementById("state-upload"),
  ingredients: document.getElementById("state-ingredients"),
  recipes: document.getElementById("state-recipes"),
};
const errorBar = document.getElementById("error-bar");

function showState(name) {
  for (const [key, el] of Object.entries(states)) {
    el.classList.toggle("hidden", key !== name);
  }
}

function showError(message) {
  errorBar.textContent = message;
  errorBar.classList.remove("hidden");
}

function clearError() {
  errorBar.textContent = "";
  errorBar.classList.add("hidden");
}

// Keeps the current ingredient list and the raw preview data URL in memory.
const store = {
  ingredients: [],
  previewDataUrl: null,
};

// Populated by per-state init functions in later tasks.
function initUploadState() {}
function initIngredientsState() {}
function initRecipesState() {}

initUploadState();
initIngredientsState();
initRecipesState();
showState("upload");
```

- [ ] **Step 4: Manual smoke test**

Start the server: `uvicorn backend.main:app --reload`. Open `http://localhost:8000`. Expected: header renders, all three state sections exist in the DOM (only `state-upload` visible via CSS but empty). No console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/app.js
git commit -m "feat: add frontend scaffold with base styles and state switcher"
```

---

## Task 10: Upload state (State 1)

**Files:**
- Modify: `frontend/index.html` — fill in `#state-upload`
- Modify: `frontend/style.css` — add drop-zone styles
- Modify: `frontend/app.js` — implement `initUploadState` and detect call

- [ ] **Step 1: Extend `frontend/index.html` — replace the empty `#state-upload` section**

```html
      <section id="state-upload" class="state">
        <div id="drop-zone" class="drop-zone">
          <p class="drop-zone-primary">Drop a photo of your fridge here</p>
          <p class="drop-zone-secondary">or click to browse</p>
          <input type="file" id="file-input" accept="image/jpeg,image/png,image/webp" hidden />
        </div>
        <div id="upload-preview" class="upload-preview hidden">
          <img id="preview-img" alt="Selected fridge photo" />
          <div class="upload-actions">
            <button id="btn-clear" type="button">Choose different photo</button>
            <button id="btn-analyze" type="button" class="primary">Analyze</button>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Append to `frontend/style.css`**

```css
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  padding: 3rem 1.5rem;
  text-align: center;
  cursor: pointer;
  background: #fff;
  transition: border-color 120ms, background 120ms;
}

.drop-zone.dragging,
.drop-zone:hover {
  border-color: var(--accent);
  background: #f4fbf7;
}

.drop-zone-primary { margin: 0; font-size: 1.1rem; font-weight: 500; }
.drop-zone-secondary { margin: 0.25rem 0 0; color: var(--muted); }

.upload-preview {
  display: grid;
  gap: 1rem;
  justify-items: center;
}

.upload-preview img {
  max-width: 100%;
  max-height: 360px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.upload-actions { display: flex; gap: 0.5rem; }

.spinner-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.upload-preview { position: relative; }
```

- [ ] **Step 3: Replace the `initUploadState` stub in `frontend/app.js`**

```javascript
function initUploadState() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const preview = document.getElementById("upload-preview");
  const previewImg = document.getElementById("preview-img");
  const btnClear = document.getElementById("btn-clear");
  const btnAnalyze = document.getElementById("btn-analyze");

  let selectedFile = null;

  function setFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError("Image must be under 10 MB.");
      return;
    }
    clearError();
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      store.previewDataUrl = e.target.result;
      previewImg.src = e.target.result;
      dropZone.classList.add("hidden");
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => setFile(e.target.files[0]));

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragging");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragging");
    setFile(e.dataTransfer.files[0]);
  });

  btnClear.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    preview.classList.add("hidden");
    dropZone.classList.remove("hidden");
  });

  btnAnalyze.addEventListener("click", async () => {
    if (!selectedFile) return;
    btnAnalyze.disabled = true;
    btnClear.disabled = true;
    const overlay = document.createElement("div");
    overlay.className = "spinner-overlay";
    overlay.innerHTML = '<div class="spinner"></div>';
    preview.appendChild(overlay);
    clearError();

    try {
      const form = new FormData();
      form.append("image", selectedFile);
      const res = await fetch("/api/detect", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not analyze image.");
      }
      const data = await res.json();
      store.ingredients = data.ingredients;
      renderIngredientsState();
      showState("ingredients");
    } catch (err) {
      showError(err.message);
    } finally {
      btnAnalyze.disabled = false;
      btnClear.disabled = false;
      overlay.remove();
    }
  });
}

// Declared here so the upload state can call it; filled in by Task 11.
function renderIngredientsState() {}
```

- [ ] **Step 4: Manual smoke test**

Start server, load page, drop/select a food photo. Without a real Vision call working, the fetch will return an error from the backend — that's expected since you haven't set up credentials. Verify the error bar shows. Then temporarily hardcode `store.ingredients = ["milk", "apple"]; renderIngredientsState(); showState("ingredients");` directly in the browser console to preview State 2 rendering (will be empty until Task 11).

Once credentials are configured (Task 14 walks through this), the full flow works end to end.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/app.js
git commit -m "feat: implement upload state with drag-drop and detect call"
```

---

## Task 11: Ingredients state (State 2)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Modify: `frontend/app.js`

- [ ] **Step 1: Replace the `#state-ingredients` section in `frontend/index.html`**

```html
      <section id="state-ingredients" class="state hidden">
        <div class="ingredients-layout">
          <img id="ingredients-preview" alt="" />
          <div class="ingredients-panel">
            <h2>What's in your fridge?</h2>
            <p class="muted">Remove anything wrong. Add anything missing.</p>
            <div id="chip-list" class="chip-list"></div>
            <form id="add-ingredient-form" class="add-row">
              <input id="add-ingredient-input" type="text" placeholder="Add an ingredient…" maxlength="50" />
              <button type="submit">Add</button>
            </form>
            <div class="ingredients-actions">
              <button id="btn-restart" type="button">Start over</button>
              <button id="btn-generate" type="button" class="primary">Generate Recipes</button>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Append to `frontend/style.css`**

```css
.muted { color: var(--muted); margin: 0.25rem 0 1rem; }

.ingredients-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 2rem;
  align-items: start;
}

@media (max-width: 720px) {
  .ingredients-layout { grid-template-columns: 1fr; }
}

#ingredients-preview {
  width: 100%;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.ingredients-panel h2 { margin: 0 0 0.25rem; }

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  min-height: 2rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  font-size: 0.95rem;
}

.chip button {
  all: unset;
  cursor: pointer;
  color: var(--muted);
  font-weight: bold;
  padding: 0 0.15rem;
  line-height: 1;
}
.chip button:hover { color: var(--danger); }

.add-row { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }

.add-row input {
  flex: 1;
  font: inherit;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
}

.add-row input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.ingredients-actions { display: flex; justify-content: space-between; gap: 0.5rem; }
```

- [ ] **Step 3: Replace the `initIngredientsState`, `renderIngredientsState` stubs in `frontend/app.js`**

```javascript
function renderIngredientsState() {
  document.getElementById("ingredients-preview").src = store.previewDataUrl || "";
  renderChips();
}

function renderChips() {
  const list = document.getElementById("chip-list");
  list.innerHTML = "";
  store.ingredients.forEach((ing, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = ing;
    const x = document.createElement("button");
    x.type = "button";
    x.setAttribute("aria-label", `Remove ${ing}`);
    x.textContent = "×";
    x.addEventListener("click", () => {
      store.ingredients.splice(i, 1);
      renderChips();
    });
    chip.appendChild(x);
    list.appendChild(chip);
  });
}

function initIngredientsState() {
  const form = document.getElementById("add-ingredient-form");
  const input = document.getElementById("add-ingredient-input");
  const btnRestart = document.getElementById("btn-restart");
  const btnGenerate = document.getElementById("btn-generate");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    if (!store.ingredients.includes(value.toLowerCase())) {
      store.ingredients.push(value.toLowerCase());
      renderChips();
    }
    input.value = "";
  });

  btnRestart.addEventListener("click", () => {
    store.ingredients = [];
    store.previewDataUrl = null;
    document.getElementById("upload-preview").classList.add("hidden");
    document.getElementById("drop-zone").classList.remove("hidden");
    document.getElementById("file-input").value = "";
    clearError();
    showState("upload");
  });

  btnGenerate.addEventListener("click", async () => {
    if (store.ingredients.length === 0) {
      showError("Add at least one ingredient.");
      return;
    }
    btnGenerate.disabled = true;
    btnRestart.disabled = true;
    clearError();
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: store.ingredients }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not generate recipes.");
      }
      const data = await res.json();
      renderRecipesState(data.recipes);
      showState("recipes");
    } catch (err) {
      showError(err.message);
    } finally {
      btnGenerate.disabled = false;
      btnRestart.disabled = false;
    }
  });
}

function renderRecipesState(_recipes) {}
```

- [ ] **Step 4: Manual smoke test**

Load page, hardcode ingredients via console (`store.ingredients = ["milk","apple"]; renderIngredientsState(); showState("ingredients");`), verify chips render, adding/removing works, "Start over" returns to the upload state cleanly.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/app.js
git commit -m "feat: implement ingredient chip editing state"
```

---

## Task 12: Recipes state (State 3)

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Modify: `frontend/app.js`

- [ ] **Step 1: Replace the `#state-recipes` section in `frontend/index.html`**

```html
      <section id="state-recipes" class="state hidden">
        <div class="recipes-header">
          <h2>Three ideas for you</h2>
          <div class="recipes-actions">
            <button id="btn-edit-ingredients" type="button">Edit ingredients</button>
            <button id="btn-regenerate" type="button" class="primary">Generate again</button>
          </div>
        </div>
        <div id="recipe-grid" class="recipe-grid"></div>
      </section>
```

- [ ] **Step 2: Append to `frontend/style.css`**

```css
.recipes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.recipes-header h2 { margin: 0; }
.recipes-actions { display: flex; gap: 0.5rem; }

.recipe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  position: relative;
}

.recipe-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recipe-card h3 { margin: 0; font-size: 1.2rem; }

.recipe-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.recipe-section-title {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0.5rem 0 0.25rem;
  font-weight: 600;
}

.recipe-ingredients { list-style: none; padding: 0; margin: 0; }
.recipe-ingredients li { padding: 0.15rem 0; }
.recipe-ingredients .qty { color: var(--muted); margin-left: 0.35rem; }

.recipe-steps { padding-left: 1.2rem; margin: 0; }
.recipe-steps li { padding: 0.15rem 0; }
```

- [ ] **Step 3: Replace the `initRecipesState` and `renderRecipesState` stubs in `frontend/app.js`**

```javascript
function renderRecipesState(recipes) {
  const grid = document.getElementById("recipe-grid");
  grid.innerHTML = "";
  recipes.forEach((r) => grid.appendChild(recipeCard(r)));
}

function recipeCard(r) {
  const card = document.createElement("article");
  card.className = "recipe-card";

  const h3 = document.createElement("h3");
  h3.textContent = r.name;
  card.appendChild(h3);

  const desc = document.createElement("p");
  desc.className = "muted";
  desc.style.margin = "0";
  desc.textContent = r.description;
  card.appendChild(desc);

  const meta = document.createElement("div");
  meta.className = "recipe-meta";
  meta.innerHTML = `<span>⏱ ${r.cook_time_minutes} min</span><span>· ${capitalize(r.difficulty)}</span>`;
  card.appendChild(meta);

  const ingTitle = document.createElement("p");
  ingTitle.className = "recipe-section-title";
  ingTitle.textContent = "Ingredients";
  card.appendChild(ingTitle);

  const ingList = document.createElement("ul");
  ingList.className = "recipe-ingredients";
  r.ingredients.forEach((i) => {
    const li = document.createElement("li");
    li.textContent = i.item;
    const qty = document.createElement("span");
    qty.className = "qty";
    qty.textContent = `— ${i.quantity}`;
    li.appendChild(qty);
    ingList.appendChild(li);
  });
  card.appendChild(ingList);

  const stepsTitle = document.createElement("p");
  stepsTitle.className = "recipe-section-title";
  stepsTitle.textContent = "Steps";
  card.appendChild(stepsTitle);

  const steps = document.createElement("ol");
  steps.className = "recipe-steps";
  r.steps.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    steps.appendChild(li);
  });
  card.appendChild(steps);

  return card;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function initRecipesState() {
  document.getElementById("btn-edit-ingredients").addEventListener("click", () => {
    clearError();
    showState("ingredients");
  });

  document.getElementById("btn-regenerate").addEventListener("click", async () => {
    const btn = document.getElementById("btn-regenerate");
    const editBtn = document.getElementById("btn-edit-ingredients");
    btn.disabled = true;
    editBtn.disabled = true;
    const grid = document.getElementById("recipe-grid");
    const overlay = document.createElement("div");
    overlay.className = "spinner-overlay";
    overlay.innerHTML = '<div class="spinner"></div>';
    grid.appendChild(overlay);
    clearError();
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: store.ingredients }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not generate recipes.");
      }
      const data = await res.json();
      renderRecipesState(data.recipes);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      editBtn.disabled = false;
    }
  });
}
```

- [ ] **Step 4: Manual smoke test**

In the browser console, run:

```javascript
renderRecipesState([{
  name: "Test Dish", description: "A quick test.", cook_time_minutes: 15,
  difficulty: "easy",
  ingredients: [{ item: "salt", quantity: "1 tsp" }],
  steps: ["Do the thing.", "Eat it."]
}]);
showState("recipes");
```

Verify the card renders with correct sections.

- [ ] **Step 5: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/app.js
git commit -m "feat: render recipe cards with regenerate action"
```

---

## Task 13: Wire the full flow and polish

Nothing new here structurally — this task just verifies the full upload → detect → chips → generate → cards flow wires together and the error-bar UX works end to end.

- [ ] **Step 1: End-to-end check**

Confirm in `frontend/app.js`:
- `initUploadState` on success calls `renderIngredientsState()` and `showState("ingredients")` ✓ (Task 10)
- `renderIngredientsState()` populates the preview and chips ✓ (Task 11)
- "Generate Recipes" calls `renderRecipesState(...)` and `showState("recipes")` ✓ (Task 11)
- "Generate again" re-calls the endpoint and re-renders ✓ (Task 12)
- "Edit ingredients" flips to State 2 without clearing the chips ✓ (Task 12)
- "Start over" resets everything and returns to upload ✓ (Task 11)

If any of the above is missing, fix inline before continuing.

- [ ] **Step 2: Accessibility check**

- `<img alt>` populated on both previews ✓
- Chip remove buttons have `aria-label` ✓
- Error bar has `role="alert"` ✓
- Focus outline on text input ✓

- [ ] **Step 3: No commit needed unless fixes were required**

If you made changes in this task, commit with `git commit -m "fix: address end-to-end flow gaps"`.

---

## Task 14: README and manual smoke test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# FridgeChef

Take a photo of your fridge. Get three recipes back.

FridgeChef sends the photo to Google Cloud Vision for ingredient detection, lets you edit the result as chips, then asks Gemini 2.5 Flash for three complete recipes with ingredients, timings, and steps.

## Requirements

- Python 3.11+
- A Google Cloud project with the **Vision API** enabled, plus a service-account JSON key
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Setup

1. Clone and enter the repo.
2. Create a virtualenv and install deps:
   ```
   python -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```
3. Copy `backend/.env.example` to `backend/.env` and fill in both credentials.
4. Run the server:
   ```
   uvicorn backend.main:app --reload
   ```
5. Open [http://localhost:8000](http://localhost:8000).

## Tests

```
pytest
```

11 tests covering the food-filter logic and both API routes (Vision and Gemini clients mocked).

## Architecture

See [docs/superpowers/specs/2026-04-23-fridgechef-design.md](docs/superpowers/specs/2026-04-23-fridgechef-design.md) for the full design.
```

- [ ] **Step 2: Full manual smoke test**

With real credentials set in `backend/.env`:

1. `uvicorn backend.main:app --reload` — server boots cleanly.
2. Open `http://localhost:8000` — upload zone visible.
3. Drag a fridge photo in — preview shows, "Analyze" enabled.
4. Click Analyze — spinner, then ingredient chips appear (food-only).
5. Remove one chip, add a typed one — chip list updates.
6. Click Generate Recipes — spinner, then three recipe cards with ingredients and steps.
7. Click Generate Again — fresh set of three recipes (different content).
8. Click Edit Ingredients — back to chip list with same ingredients preserved.
9. Click Start Over (in State 2) — back to upload zone cleanly.
10. Upload a non-image file or >10 MB file — error bar shows, upload state preserved.

If any step fails, fix the code and re-run. Do **not** consider the project done until all 10 steps pass.

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup and smoke-test instructions"
```

---

## Done criteria

- All 11 pytest tests pass (`pytest` from repo root).
- Server starts with `uvicorn backend.main:app` and serves the frontend at `/`.
- All 10 smoke-test steps pass with real Vision + Gemini credentials.
- No secrets or service-account JSON files committed (`git status` clean, `.gitignore` respected).
- README documents exactly how to run the project from scratch.
