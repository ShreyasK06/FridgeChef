# FridgeChef — Design Spec

**Date:** 2026-04-23
**Status:** Approved for implementation planning

## Overview

A web app that turns a photo of a fridge into three AI-generated recipes. Image → Google Cloud Vision → filtered ingredient list (user-editable) → Gemini 2.5 Flash → three structured recipes rendered as cards.

Portfolio project. Target: runs locally with one command, looks polished, has tests.

## Goals & non-goals

**Goals**
- One-command local run (`uvicorn backend.main:app`).
- Frontend is vanilla HTML/CSS/JS, no build step.
- Human-in-the-loop ingredient editing before recipe generation.
- Three structured recipes per request, regenerable.
- Test coverage on backend routes and the food filter.

**Non-goals**
- Auth, user accounts, persistence.
- Deployment (no Dockerfile, no CI in v1).
- Caching, rate limiting, image storage.
- Mobile-specific layout (responsive CSS is fine; no PWA/native).

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser (http://localhost:8000)                     │
│  ├─ index.html, style.css, app.js (vanilla)          │
│  └─ fetch() → same origin, no CORS worries           │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│  FastAPI app (uvicorn, port 8000)                    │
│  ├─ /            → serves frontend/ (StaticFiles)    │
│  ├─ /api/detect  → image upload → ingredients[]      │
│  └─ /api/recipes → ingredients[] → recipes[3]        │
│                                                      │
│  Modules:                                            │
│  ├─ main.py           routes + app wiring            │
│  ├─ vision_client.py  Google Cloud Vision wrapper    │
│  ├─ gemini_client.py  Gemini 2.5 Flash wrapper       │
│  ├─ food_filter.py    keyword allowlist + filter     │
│  └─ schemas.py        Pydantic request/response      │
└──────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
 Google Cloud Vision              Gemini 2.5 Flash
 (service account JSON)           (GEMINI_API_KEY)
```

Browser only talks to `localhost:8000`. All external AI calls happen server-side; keys never reach the client.

## Repo layout

```
FridgeChef/
├── backend/
│   ├── main.py
│   ├── vision_client.py
│   ├── gemini_client.py
│   ├── food_filter.py
│   ├── schemas.py
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/
│       ├── __init__.py
│       ├── test_routes.py
│       └── test_food_filter.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docs/
│   └── superpowers/specs/2026-04-23-fridgechef-design.md
├── .gitignore
└── README.md
```

`.gitignore` excludes `.env`, `*.json` (service account), `__pycache__/`, `.pytest_cache/`, `venv/`.

## Data flow

### Upload → detection

1. User drops/selects image → `FileReader` shows preview.
2. JS `POST /api/detect` with `multipart/form-data` (field `image`).
3. Backend validates bytes with Pillow (size ≤ 10 MB; MIME in `{jpeg, png, webp}`).
4. `vision_client.detect_ingredients(bytes)` → Vision `label_detection`.
5. `food_filter.filter_labels(labels)` keeps `score ≥ 0.6` AND description overlaps a food keyword allowlist.
6. Response: `{"ingredients": ["bell pepper", "milk", "chicken breast"]}`.
7. Frontend renders each as a removable chip; an input field adds more.

### Generate → recipes

1. User clicks "Generate Recipes" → JS `POST /api/recipes` with JSON `{"ingredients": [...]}`.
2. Backend validates (1–30 items, each 1–50 chars, stripped).
3. `gemini_client.generate_recipes(ingredients)` builds a prompt requiring a JSON array of 3 recipes matching the schema; calls Gemini with `response_mime_type="application/json"` and temperature ≈ 0.9.
4. Response parsed into `list[Recipe]`. On parse/validation failure → HTTP 502.
5. Response: `{"recipes": [...]}`. Frontend renders three cards.
6. "Generate Again" re-hits the endpoint.

No caching anywhere.

## API contracts

### `POST /api/detect`

**Request:** `multipart/form-data`
- `image`: file (JPEG/PNG/WebP, ≤ 10 MB)

**Success 200:**
```json
{ "ingredients": ["bell pepper", "milk", "chicken breast"] }
```

**Errors:**
- `400` — missing file, bad MIME, file too large, unreadable image
- `502` — Vision API error (message sanitized, no stack traces)

### `POST /api/recipes`

**Request:** `application/json`
```json
{ "ingredients": ["bell pepper", "milk", "chicken breast"] }
```

**Success 200:**
```json
{
  "recipes": [
    {
      "name": "Creamy Chicken Skillet",
      "description": "One-pan weeknight dinner with tender chicken and sweet peppers.",
      "cook_time_minutes": 25,
      "difficulty": "easy",
      "ingredients": [
        { "item": "chicken breast", "quantity": "2 pieces" },
        { "item": "bell pepper", "quantity": "1 large, sliced" },
        { "item": "milk", "quantity": "1/2 cup" }
      ],
      "steps": [
        "Season chicken with salt and pepper.",
        "Sear in a hot skillet until golden, about 4 minutes per side.",
        "Add sliced peppers and milk; simmer 8 minutes until chicken is cooked through."
      ]
    }
    // ...2 more
  ]
}
```

`difficulty` is one of `"easy" | "medium" | "hard"`.

**Errors:**
- `400` — empty/too-long ingredients list, items out of length bounds
- `502` — Gemini API error, or malformed JSON that can't be parsed into the schema

## Frontend UX

Single page, three logical states swapped in the same container.

**State 1 — Upload zone (initial).**
- Centered drop zone with dashed border, "Drop a photo of your fridge, or click to browse."
- Hover/drag state changes border color.
- On file select: FileReader preview appears below the zone; "Analyze" button becomes primary CTA.

**State 2 — Ingredient review.**
- Preview image on the left, chip list on the right.
- Each chip has an × to remove. Empty input below: "Add an ingredient…" → Enter adds a chip.
- "Generate Recipes" button at the bottom.
- "Start over" link returns to State 1.

**State 3 — Recipes.**
- Three cards in a grid (stacks on narrow viewports).
- Each card: name (h2), description (muted), meta row (⏱ 25 min · Easy), ingredients list, numbered steps.
- Buttons: "Generate Again" (re-calls API) and "Edit Ingredients" (back to State 2).

**Loading states.** Two spinners — one overlays the image during detection, one overlays the recipe grid during generation. Buttons disabled while in-flight.

**Error states.** Inline error bar at the top of the current state with the sanitized backend message and a "Try again" button. Errors do not drop the user back to State 1.

## Error handling

- Input validation at the route boundary with Pydantic; invalid input → 400 with a user-facing `detail`.
- External API failures caught in the client modules, re-raised as a typed `ExternalAPIError`; the route handler maps to 502 with a generic message (`"Vision service unavailable"` / `"Recipe generation failed"`). No stack traces or raw API errors leak to the client.
- Logging: `logging.getLogger("fridgechef")` at INFO for requests, WARNING for handled errors, ERROR for unexpected. Stdout only.
- Frontend: any non-2xx response reads `detail` if present, otherwise shows a generic "Something went wrong." No silent failures.

## Testing

**pytest suite under `backend/tests/`.**

- `test_food_filter.py` — pure unit tests:
  - Keeps known food labels above threshold.
  - Drops non-food labels ("shelf", "plastic container", "refrigerator").
  - Drops low-score labels.
  - Deduplicates.

- `test_routes.py` — `fastapi.testclient.TestClient`:
  - `/api/detect` happy path: Vision client mocked via `monkeypatch`, returns canned labels, assert shape.
  - `/api/detect` rejects missing file (400).
  - `/api/detect` rejects >10 MB / bad MIME (400).
  - `/api/detect` maps Vision failure → 502.
  - `/api/recipes` happy path: Gemini client mocked, assert Pydantic parse.
  - `/api/recipes` rejects empty list (400).
  - `/api/recipes` maps malformed Gemini output → 502.

Mocking happens at the `vision_client` / `gemini_client` module boundary — tests never touch the real Google SDKs. Run with `pytest` from `backend/`.

## Config & environment

`backend/.env` loaded via `python-dotenv`. Vars:

| Var | Purpose |
|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to Vision service-account JSON |
| `GEMINI_API_KEY` | From Google AI Studio |
| `GEMINI_MODEL` | Optional; defaults to `gemini-2.5-flash` |
| `LOG_LEVEL` | Optional; defaults to `INFO` |

`.env.example` ships with these keys blank. `README.md` walks through creating both credentials.

## Dependencies

`backend/requirements.txt`:

```
fastapi
uvicorn[standard]
python-dotenv
google-cloud-vision
google-genai
pillow
pytest
httpx            # for fastapi TestClient
```

Note: the Gemini Python SDK used is the current `google-genai` package (the successor to the older `google-generativeai`).

## Open questions / deferred

- No CI. Can be added later; out of scope for v1.
- No Dockerfile. Out of scope for v1.
- No persistent storage of uploaded images or generated recipes. Explicitly a non-goal.
