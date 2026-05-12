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
    except json.JSONDecodeError as exc:
        raise ExternalAPIError("Recipe generation returned non-JSON output") from exc

    if not isinstance(raw, list):
        raise ExternalAPIError("Recipe generation returned non-array JSON")

    try:
        recipes = [Recipe.model_validate(item) for item in raw]
    except (ValidationError, TypeError) as exc:
        raise ExternalAPIError("Recipe generation returned malformed data") from exc

    if len(recipes) != 3:
        raise ExternalAPIError(f"Expected 3 recipes, got {len(recipes)}")

    return recipes
