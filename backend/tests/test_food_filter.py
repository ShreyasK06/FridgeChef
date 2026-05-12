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
        ("Banana", 0.45),
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
