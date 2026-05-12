"""Request and response schemas for FridgeChef routes and Gemini output."""
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

StepStr = Annotated[str, StringConstraints(min_length=1, max_length=1000)]


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
    item: str = Field(min_length=1, max_length=100)
    quantity: str = Field(min_length=1, max_length=100)


class Recipe(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    cook_time_minutes: int = Field(ge=1, le=480)
    difficulty: Literal["easy", "medium", "hard"]
    ingredients: list[RecipeIngredient] = Field(min_length=1)
    steps: list[StepStr] = Field(min_length=1)


class RecipesResponse(BaseModel):
    recipes: list[Recipe]
