"use strict";

// FridgeChef front end. Three steps: photo -> ingredients -> recipes.
// All model-generated text is inserted with textContent (via h()), never innerHTML.

const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";

const STEP_ORDER = ["upload", "ingredients", "recipes"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const PANTRY = ["salt", "pepper", "olive oil", "garlic", "butter", "flour", "rice", "pasta"];
const ASSUMED = ["salt", "pepper", "black pepper", "water"]; // not counted as "to buy"
const STATUS_DETECT = ["Looking at the shelves...", "Spotting produce and reading labels...", "Almost done..."];
const STATUS_RECIPES = ["Asking the chef...", "Matching recipes to your ingredients...", "Writing out the steps..."];

const store = { file: null, previewUrl: null, ingredients: [], recipes: [], cards: [], filter: "all", generation: 0 };

const states = { upload: $("state-upload"), ingredients: $("state-ingredients"), recipes: $("state-recipes") };

// ---------- DOM helpers ----------

function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
  return node;
}

function icon(name, extraClass = "") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `icon ${extraClass}`.trim());
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// ---------- Step state, errors, toast ----------

function updateSteps(active) {
  const activeIndex = STEP_ORDER.indexOf(active);
  document.querySelectorAll(".steps li").forEach((li, i) => {
    li.classList.toggle("active", i === activeIndex);
    li.classList.toggle("done", i < activeIndex);
    if (i === activeIndex) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    const num = li.querySelector(".num");
    num.replaceChildren(i < activeIndex ? icon("check") : String(i + 1));
  });
}

// On a real navigation, move focus to the new step's heading so keyboard and screen-reader users land on it.
// The first call at page load must not steal focus.
function showState(name, { initial = false } = {}) {
  for (const [key, el] of Object.entries(states)) el.classList.toggle("hidden", key !== name);
  updateSteps(name);
  if (initial) return;
  states[name].querySelector("h1, h2")?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function showError(message) {
  $("error-text").textContent = message;
  $("error-bar").classList.remove("hidden");
}

function clearError() {
  $("error-text").textContent = "";
  $("error-bar").classList.add("hidden");
}

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// Cycles through status lines while a request is in flight; returns a stop function.
function rotate(el, messages) {
  let i = 0;
  el.textContent = messages[0];
  const id = setInterval(() => {
    i = Math.min(i + 1, messages.length - 1);
    el.textContent = messages[i];
  }, 2200);
  return () => {
    clearInterval(id);
    el.textContent = "";
  };
}

async function readJson(res, fallback) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error((body && typeof body.detail === "string" && body.detail) || fallback);
  return body;
}

const friendly = (err) =>
  err instanceof TypeError ? "Can't reach the server. Check your connection and try again." : err.message;

// ---------- Step 1: photo ----------

function releasePreview() {
  if (store.previewUrl) URL.revokeObjectURL(store.previewUrl);
  store.previewUrl = null;
}

function showDropzone() {
  $("upload-preview").classList.add("hidden");
  $("drop-zone").classList.remove("hidden");
  if (window.__FRIDGECHEF_DEMO__) $("btn-sample").classList.remove("hidden");
}

function setFile(file, { sample = false } = {}) {
  if (!file) return;
  if (!sample) {
    if (!ALLOWED_TYPES.includes(file.type)) return showError("Please choose a JPEG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return showError("That image is over 10 MB. Try a smaller photo.");
  }
  clearError();
  releasePreview();
  store.file = file;
  store.previewUrl = URL.createObjectURL(file);
  $("preview-img").src = store.previewUrl;
  $("drop-zone").classList.add("hidden");
  $("btn-sample").classList.add("hidden");
  $("upload-preview").classList.remove("hidden");
  $("btn-analyze").focus();
}

function clearPhoto() {
  store.file = null;
  releasePreview();
  $("file-input").value = "";
  $("upload-status").textContent = "";
  showDropzone();
}

async function analyze() {
  if (!store.file) return;
  const analyzeBtn = $("btn-analyze");
  const clearBtn = $("btn-clear");
  analyzeBtn.disabled = clearBtn.disabled = true;
  $("scan").classList.remove("hidden");
  clearError();
  const stop = rotate($("upload-status"), STATUS_DETECT);
  try {
    const form = new FormData();
    form.append("image", store.file);
    const res = await fetch("/api/detect", { method: "POST", body: form });
    const data = await readJson(res, "We couldn't analyse that photo.");
    store.ingredients = (data.ingredients || []).map((s) => String(s).toLowerCase());
    renderIngredients();
    showState("ingredients");
  } catch (err) {
    showError(friendly(err));
  } finally {
    stop();
    analyzeBtn.disabled = clearBtn.disabled = false;
    $("scan").classList.add("hidden");
  }
}

function initUpload() {
  const zone = $("drop-zone");
  const input = $("file-input");

  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", (e) => setFile(e.target.files[0]));

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    setFile(e.dataTransfer.files[0]);
  });

  // Pasting a screenshot or copied image works too.
  document.addEventListener("paste", (e) => {
    if (states.upload.classList.contains("hidden")) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (file) setFile(file);
  });

  $("btn-clear").addEventListener("click", clearPhoto);
  $("btn-analyze").addEventListener("click", analyze);

  // Demo builds have no real detector, so offer the illustration as a sample photo.
  if (window.__FRIDGECHEF_DEMO__) {
    const sample = $("btn-sample");
    sample.classList.remove("hidden");
    sample.addEventListener("click", () => {
      const svg = new XMLSerializer().serializeToString($("hero-art"));
      setFile(new File([svg], "sample-fridge.svg", { type: "image/svg+xml" }), { sample: true });
    });
  }
}

// ---------- Step 2: ingredients ----------

function normalizeIngredient(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
}

function syncIngredientUi() {
  const n = store.ingredients.length;
  $("ing-count").textContent = String(n);
  $("ing-count-label").textContent = n === 1 ? "ingredient" : "ingredients";
  $("chip-empty").classList.toggle("hidden", n > 0);
  $("btn-generate").disabled = n === 0;
  document.querySelectorAll("#pantry-list .toggle").forEach((btn) => {
    const on = store.ingredients.includes(btn.dataset.item);
    btn.setAttribute("aria-pressed", String(on));
    btn.replaceChildren(icon(on ? "check" : "plus"), btn.dataset.item);
  });
}

function chipEl(name, index) {
  return h(
    "li",
    { class: "chip", style: `--i:${index}`, "data-name": name },
    h("span", { text: name }),
    h("button", { type: "button", "aria-label": `Remove ${name}`, onclick: () => removeIngredient(name) }, icon("x"))
  );
}

function renderIngredients() {
  $("ingredients-preview").src = store.previewUrl || "";
  $("chip-list").replaceChildren(...store.ingredients.map(chipEl));
  if (!$("pantry-list").children.length) {
    $("pantry-list").append(
      ...PANTRY.map((item) =>
        h("button", { type: "button", class: "toggle", "data-item": item, "aria-pressed": "false", onclick: () => togglePantry(item) })
      )
    );
  }
  syncIngredientUi();
}

function addIngredient(raw) {
  const name = normalizeIngredient(raw);
  if (!name) return false;
  if (store.ingredients.includes(name)) {
    toast(`${name} is already on the list`);
    return false;
  }
  store.ingredients.push(name);
  $("chip-list").append(chipEl(name, 0));
  syncIngredientUi();
  return true;
}

function removeIngredient(name) {
  store.ingredients = store.ingredients.filter((i) => i !== name);
  const chip = [...$("chip-list").children].find((c) => c.dataset.name === name);
  if (chip) {
    chip.classList.add("leaving");
    setTimeout(() => chip.remove(), 160);
  }
  syncIngredientUi();
  $("add-ingredient-input").focus();
}

function togglePantry(item) {
  if (store.ingredients.includes(item)) removeIngredient(item);
  else addIngredient(item);
}

function initIngredients() {
  $("add-ingredient-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("add-ingredient-input");
    if (addIngredient(input.value)) input.value = "";
    input.focus();
  });

  $("btn-restart").addEventListener("click", () => {
    store.ingredients = [];
    store.recipes = [];
    store.cards = [];
    store.generation++;
    clearPhoto();
    clearError();
    showState("upload");
  });

  $("btn-generate").addEventListener("click", () => generate("ingredients"));
}

// ---------- Step 3: recipes ----------

const normalize = (s) => s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const stem = (w) => w.replace(/(es|s)$/, "");
const tokens = (s) => normalize(s).split(" ").filter(Boolean).map(stem);

// A recipe ingredient is "in the fridge" when every word of the shorter phrase appears in the longer one,
// so "egg" matches "eggs" but not "eggplant", and "cheese" matches "cheddar cheese".
function haveIngredient(recipeItem, owned) {
  const rt = tokens(recipeItem);
  if (!rt.length) return false;
  if (ASSUMED.includes(normalize(recipeItem))) return true;
  return owned.some((name) => {
    const ot = tokens(name);
    if (!ot.length) return false;
    const [short, long] = ot.length <= rt.length ? [ot, rt] : [rt, ot];
    return short.every((t) => long.includes(t));
  });
}

function setBusy(busy) {
  ["btn-generate", "btn-regenerate", "btn-edit-ingredients"].forEach((id) => ($(id).disabled = busy));
  $("recipe-grid").setAttribute("aria-busy", String(busy));
  if (!busy) syncIngredientUi();
}

function renderSkeletons() {
  const line = (w) => h("div", { class: `sk-line ${w}` });
  $("recipe-grid").replaceChildren(
    ...[0, 1, 2].map(() =>
      h(
        "div",
        { class: "skeleton", "aria-hidden": "true" },
        h("div", { class: "sk-band" }),
        h("div", { class: "sk-body" }, line("w60"), line(""), line("w80"), line("w40"), line(""))
      )
    )
  );
  $("recipe-empty").classList.add("hidden");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = h("textarea", { "aria-hidden": "true", style: "position:fixed;opacity:0" });
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function recipeAsText(r) {
  const ingredients = r.ingredients.map((i) => `- ${i.item} (${i.quantity})`).join("\n");
  const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${r.name}\n${r.cook_time_minutes} min, ${r.difficulty}\n\nIngredients\n${ingredients}\n\nSteps\n${steps}`;
}

function recipeCard(r, index) {
  const items = r.ingredients.map((i) => ({ ...i, have: haveIngredient(i.item, store.ingredients) }));
  const haveCount = items.filter((i) => i.have).length;
  const missing = items.filter((i) => !i.have);
  const pct = items.length ? haveCount / items.length : 0;
  const summary = `You have ${haveCount} of ${items.length} ingredients`;

  const progress = h("span", { class: "prog", text: `0 of ${r.steps.length} done` });
  const stepItems = r.steps.map((step) =>
    h(
      "li",
      {},
      h(
        "label",
        {},
        h("input", {
          type: "checkbox",
          onchange: () => {
            const done = card.querySelectorAll(".steps-list input:checked").length;
            progress.textContent = `${done} of ${r.steps.length} done`;
          },
        }),
        h("span", { text: step })
      )
    )
  );

  const actions = h(
    "div",
    { class: "card-actions" },
    h("button", { type: "button", class: "btn", onclick: () => copyText(recipeAsText(r), "Recipe copied") }, icon("copy"), "Copy recipe"),
    missing.length
      ? h(
          "button",
          {
            type: "button",
            class: "btn",
            onclick: () => copyText(missing.map((m) => `- ${m.item} (${m.quantity})`).join("\n"), "Shopping list copied"),
          },
          icon("cart"),
          `Shopping list (${missing.length})`
        )
      : null
  );

  const card = h(
    "article",
    { class: "recipe-card", style: `--i:${index}`, "data-difficulty": r.difficulty, "data-time": r.cook_time_minutes, "data-pct": pct },
    h(
      "div",
      { class: "card-band" },
      icon("chef", "mark"),
      h("span", { class: "badge diff", text: r.difficulty }),
      h("span", { class: "badge" }, icon("clock"), `${r.cook_time_minutes} min`)
    ),
    h(
      "div",
      { class: "card-body" },
      h("h3", { text: r.name }),
      h("p", { class: "desc", text: r.description }),
      h(
        "div",
        { class: "match" },
        h("span", { class: "match-label", text: summary }),
        h("div", { class: "meter", role: "img", "aria-label": summary }, h("span", { style: "--p:0" }))
      ),
      h("h4", { class: "section-title", text: "Ingredients" }),
      h(
        "ul",
        { class: "ing-list" },
        items.map((i) =>
          h(
            "li",
            { class: i.have ? "have" : "need" },
            icon(i.have ? "check" : "cart"),
            h(
              "span",
              {},
              h("span", { class: "sr-only", text: i.have ? "You have: " : "To buy: " }),
              h("span", { class: "name", text: i.item }),
              h("span", { class: "qty", text: ` (${i.quantity})` })
            )
          )
        )
      ),
      h("details", { class: "steps-box", open: true }, h("summary", {}, h("span", { text: "Steps" }), progress), h("ol", { class: "steps-list" }, stepItems)),
      actions
    )
  );
  return card;
}

function applyFilter() {
  let visible = 0;
  for (const card of store.cards) {
    const time = Number(card.dataset.time);
    const show =
      store.filter === "all" ||
      (store.filter === "easy" && card.dataset.difficulty === "easy") ||
      (store.filter === "quick" && time <= 30);
    card.hidden = !show;
    if (show) visible++;
  }
  document.querySelectorAll(".filters .toggle").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === store.filter)));
  $("recipe-empty").classList.toggle("hidden", visible > 0 || store.cards.length === 0);
}

function renderRecipes() {
  const grid = $("recipe-grid");
  store.filter = "all";
  store.cards = store.recipes.map(recipeCard);
  grid.replaceChildren(...store.cards);
  grid.setAttribute("aria-busy", "false");
  $("rec-sub").textContent = `Built from ${plural(store.ingredients.length, "ingredient")}. Salt, pepper and water are assumed.`;
  applyFilter();
  // Let the meters animate from empty to their value.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => store.cards.forEach((c) => c.querySelector(".meter span").style.setProperty("--p", c.dataset.pct)))
  );
}

async function generate(origin) {
  if (!store.ingredients.length) {
    showError("Add at least one ingredient.");
    return;
  }
  const token = ++store.generation;
  clearError();
  setBusy(true);
  showState("recipes");
  renderSkeletons();
  const stop = rotate($("rec-sub"), STATUS_RECIPES);
  try {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients: store.ingredients }),
    });
    const data = await readJson(res, "We couldn't generate recipes.");
    if (token !== store.generation) return;
    stop();
    store.recipes = data.recipes || [];
    renderRecipes();
  } catch (err) {
    if (token !== store.generation) return;
    stop();
    showError(friendly(err));
    if (origin === "again" && store.recipes.length) renderRecipes();
    else showState("ingredients");
  } finally {
    if (token === store.generation) setBusy(false);
  }
}

function initRecipes() {
  $("btn-edit-ingredients").addEventListener("click", () => {
    clearError();
    showState("ingredients");
  });
  $("btn-regenerate").addEventListener("click", () => generate("again"));
  $("btn-print").addEventListener("click", () => window.print());
  document.querySelectorAll(".filters .toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      store.filter = btn.dataset.filter;
      applyFilter();
    })
  );
  $("clear-filter").addEventListener("click", () => {
    store.filter = "all";
    applyFilter();
  });
}

// ---------- Boot ----------

$("error-dismiss").addEventListener("click", clearError);
initUpload();
initIngredients();
initRecipes();
showState("upload", { initial: true });
