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
