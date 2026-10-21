// Static demo mode for hosting on GitHub Pages, where there is no backend.
// Active on *.github.io or with ?demo=1. It answers /api/detect and /api/recipes
// from a small built-in recipe set; no Vision or Gemini calls are made.
(function () {
  const isDemo =
    location.hostname.endsWith("github.io") ||
    new URLSearchParams(location.search).has("demo");
  if (!isDemo) return;

  const SAMPLE_FRIDGE = ["eggs", "spinach", "cheddar cheese", "tomatoes", "milk", "onion", "butter", "bell pepper"];

  const LIBRARY = [
    {
      tags: ["eggs", "spinach", "cheddar cheese", "onion"],
      name: "Spinach and Cheddar Omelette",
      description: "A fluffy three-egg omelette folded around wilted spinach and sharp cheddar.",
      cook_time_minutes: 12,
      difficulty: "easy",
      ingredients: [
        { item: "eggs", quantity: "3" },
        { item: "spinach", quantity: "2 handfuls" },
        { item: "cheddar cheese", quantity: "1/3 cup, grated" },
        { item: "onion", quantity: "1/4, finely diced" },
        { item: "butter", quantity: "1 tbsp" },
      ],
      steps: [
        "Melt the butter in a non-stick pan over medium heat and soften the onion for 2 minutes.",
        "Add the spinach and cook until just wilted, then move it to a plate.",
        "Whisk the eggs with a pinch of salt and pour them into the pan.",
        "When the edges set, add the spinach and cheese to one half and fold the omelette over.",
        "Cook 1 more minute and slide onto a plate.",
      ],
    },
    {
      tags: ["tomatoes", "eggs", "onion", "bell pepper"],
      name: "Shakshuka",
      description: "Eggs poached in a spiced tomato and pepper sauce, straight from the pan.",
      cook_time_minutes: 25,
      difficulty: "medium",
      ingredients: [
        { item: "tomatoes", quantity: "4, chopped" },
        { item: "bell pepper", quantity: "1, diced" },
        { item: "onion", quantity: "1, sliced" },
        { item: "eggs", quantity: "4" },
        { item: "olive oil or butter", quantity: "2 tbsp" },
      ],
      steps: [
        "Heat the oil in a wide pan and cook the onion and pepper for 6 minutes until soft.",
        "Add the tomatoes with salt, pepper and a pinch of paprika; simmer 10 minutes until thick.",
        "Make four wells in the sauce and crack an egg into each.",
        "Cover and cook 5 to 7 minutes until the whites are set and the yolks are still soft.",
        "Serve straight from the pan with bread.",
      ],
    },
    {
      tags: ["milk", "butter", "cheddar cheese"],
      name: "Cheddar Sauce Toast",
      description: "A quick cheddar béchamel poured over toast and browned under the grill.",
      cook_time_minutes: 15,
      difficulty: "easy",
      ingredients: [
        { item: "butter", quantity: "2 tbsp" },
        { item: "flour", quantity: "2 tbsp" },
        { item: "milk", quantity: "1 cup" },
        { item: "cheddar cheese", quantity: "1 cup, grated" },
        { item: "bread", quantity: "4 slices" },
      ],
      steps: [
        "Melt the butter, whisk in the flour and cook for 1 minute.",
        "Slowly whisk in the milk and simmer until it coats a spoon.",
        "Stir in most of the cheese until smooth and season to taste.",
        "Toast the bread, spoon the sauce over it and top with the remaining cheese.",
        "Grill for 2 to 3 minutes until bubbling and golden.",
      ],
    },
    {
      tags: ["spinach", "tomatoes", "bell pepper", "onion", "milk"],
      name: "Creamy Spinach and Tomato Soup",
      description: "A weeknight soup of simmered tomatoes and spinach, finished with a splash of milk.",
      cook_time_minutes: 30,
      difficulty: "easy",
      ingredients: [
        { item: "tomatoes", quantity: "5, quartered" },
        { item: "onion", quantity: "1, chopped" },
        { item: "spinach", quantity: "3 handfuls" },
        { item: "milk", quantity: "1/2 cup" },
        { item: "vegetable stock", quantity: "2 cups" },
      ],
      steps: [
        "Soften the onion in a pot, add the tomatoes and cook 10 minutes.",
        "Pour in the stock and simmer 10 minutes.",
        "Add the spinach and blend until smooth.",
        "Stir in the milk, warm through and season.",
      ],
    },
    {
      tags: ["bell pepper", "onion", "eggs", "cheddar cheese", "tomatoes"],
      name: "Loaded Pepper Frittata",
      description: "An oven-finished frittata with sweet peppers, onion and melted cheddar.",
      cook_time_minutes: 25,
      difficulty: "medium",
      ingredients: [
        { item: "eggs", quantity: "6" },
        { item: "bell pepper", quantity: "1, diced" },
        { item: "onion", quantity: "1/2, diced" },
        { item: "cheddar cheese", quantity: "1/2 cup, grated" },
        { item: "butter", quantity: "1 tbsp" },
      ],
      steps: [
        "Heat the oven to 200 C (400 F).",
        "Cook the pepper and onion in an oven-safe pan with the butter for 5 minutes.",
        "Pour in the beaten eggs, scatter the cheese on top and cook 2 minutes on the stove.",
        "Bake 10 to 12 minutes until puffed and set in the middle.",
        "Rest 3 minutes, then slice.",
      ],
    },
  ];

  let round = 0;

  function pickRecipes(ingredients) {
    const have = new Set(ingredients.map((s) => s.toLowerCase()));
    const ranked = LIBRARY.map((r) => ({
      r,
      score: r.tags.filter((t) => have.has(t)).length,
    })).sort((a, b) => b.score - a.score);
    // "Generate again" rotates through the ranked list so the button visibly does something.
    const offset = round++ % ranked.length;
    return [0, 1, 2].map((i) => ranked[(i + offset) % ranked.length].r);
  }

  function json(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;
    if (url.endsWith("/api/detect") || url.endsWith("/api/recipes")) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (url.endsWith("/api/detect")) return json({ ingredients: SAMPLE_FRIDGE });
      const body = JSON.parse(init && init.body ? init.body : "{}");
      return json({ recipes: pickRecipes(body.ingredients || []) });
    }
    return realFetch(input, init);
  };

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.className = "demo-banner";
    bar.textContent =
      "Demo mode: any photo returns a sample ingredient list, and recipes come from a small built-in set. " +
      "The full app uses Google Cloud Vision and Gemini (see the repo to run it).";
    document.body.insertBefore(bar, document.body.firstChild);
  });
})();
