# FridgeChef

Take a photo of your fridge. Get three recipes back.

FridgeChef sends the photo to Google Cloud Vision for ingredient detection, lets you edit the result as chips, then asks Gemini 2.5 Flash for three complete recipes with ingredients, timings, and steps.

![FridgeChef web frontend: drop a photo of your fridge to start](docs/images/upload.png)

## Live demo

**[Try the demo](https://shreyask06.github.io/FridgeChef/)** on GitHub Pages. Pages has no backend, so the demo runs in a sample-data mode (`frontend/demo.js`): any photo returns a sample ingredient list, and the recipes are picked from a small built-in set by ingredient overlap. It shows the full flow (upload, edit ingredient chips, get three recipes, generate again) without calling Vision or Gemini. Run the app locally, as below, for real detection and generation. Append `?demo=1` to a local URL to try the demo mode there.

## Requirements

- Python 3.11+
- A Google Cloud project with the **Vision API** enabled, plus a service-account JSON key
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Setup

1. Clone and enter the repo.
2. Create a virtualenv and install deps:
   ```
   python -m venv .venv
   # macOS/Linux: source .venv/bin/activate
   # Windows PowerShell: .venv\Scripts\Activate.ps1
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

17 tests covering the food-filter logic and both API routes (Vision and Gemini clients mocked).

## Frontends

Two are available; pick whichever fits.

- **Web** (`frontend/`) — vanilla HTML/CSS/JS. Served automatically at `http://localhost:8000` by the backend. No build step.
- **Android** (`flutter_app/`) — native Flutter app with camera + gallery picker. See [`flutter_app/README.md`](flutter_app/README.md) for Flutter SDK setup, emulator config, and how to run on a physical device.

Both talk to the same `/api/detect` and `/api/recipes` endpoints.

## Architecture

See [docs/superpowers/specs/2026-04-23-fridgechef-design.md](docs/superpowers/specs/2026-04-23-fridgechef-design.md) for the full design.
