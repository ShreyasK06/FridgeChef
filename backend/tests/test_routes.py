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
    big = b"\xff\xd8\xff" + b"\x00" * (10 * 1024 * 1024 + 1)
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
