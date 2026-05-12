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
