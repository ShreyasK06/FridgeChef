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

const store = {
  ingredients: [],
  previewDataUrl: null,
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -------------------- Upload state --------------------

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

// -------------------- Ingredients state --------------------

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
    const lowered = value.toLowerCase();
    if (!store.ingredients.includes(lowered)) {
      store.ingredients.push(lowered);
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

// -------------------- Recipes state --------------------

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
  const t = document.createElement("span");
  t.textContent = `⏱ ${r.cook_time_minutes} min`;
  const d = document.createElement("span");
  d.textContent = `· ${capitalize(r.difficulty)}`;
  meta.appendChild(t);
  meta.appendChild(d);
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

initUploadState();
initIngredientsState();
initRecipesState();
showState("upload");
