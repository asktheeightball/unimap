/* UniMap — search and browse a small catalogue of celestial bodies. */

const DATA_URL = "celestial-bodies.json";

/* Maps a filter button's category to the record `type` values it accepts.
   Keys and values are compared lowercased, so singular/plural both work. */
const CATEGORY_TYPES = {
  all: null,
  stars: ["star"],
  planets: ["planet"],
  exoplanets: ["exoplanet"],
  "dwarf planets": ["dwarf planet"],
  moons: ["moon"],
  nebulae: ["nebula", "nebulae"],
  "black holes": ["black hole"],
  // A pulsar is a neutron star, so one filter reaches both. Catalogue sources
  // distinguish them, and the record keeps whichever type its source reports.
  "neutron stars": ["neutron star", "pulsar"],
  galaxies: ["galaxy", "galaxies"],
  "star clusters": ["star cluster"],
};

const state = {
  bodies: [],
  query: "",
  category: "All",
  results: [],
};

const el = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  clearButton: document.getElementById("clear-button"),
  filterButtons: document.getElementById("filter-buttons"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  error: document.getElementById("error"),
  browseView: document.getElementById("browse-view"),
  detailView: document.getElementById("detail-view"),
  quizView: document.getElementById("quiz-view"),
  modeNav: document.getElementById("mode-nav"),
  backButton: document.getElementById("back-button"),
  detailName: document.getElementById("detail-name"),
  detailTypeValue: document.getElementById("detail-type-value"),
  detailDistance: document.getElementById("detail-distance"),
  detailSize: document.getElementById("detail-size"),
  detailCircumference: document.getElementById("detail-circumference"),
  detailMeasurementLabel: document.getElementById("detail-measurement-label"),
  detailMeasurementValue: document.getElementById("detail-measurement-value"),
  detailSource: document.getElementById("detail-source"),
  rowDistance: document.getElementById("detail-row-distance"),
  rowSize: document.getElementById("detail-row-size"),
  rowCircumference: document.getElementById("detail-row-circumference"),
  rowMeasurement: document.getElementById("detail-row-measurement"),
  rowSource: document.getElementById("detail-row-source"),
};

/* --- Data ---------------------------------------------------------------- */

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Request for ${DATA_URL} failed with status ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`${DATA_URL} did not contain an array of records`);
  }
  return data;
}

function showError(message) {
  el.error.textContent = message;
  el.error.hidden = false;
}

/* --- Filtering ----------------------------------------------------------- */

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesQuery(body, query) {
  // An empty query is handled by the caller; here a query is always present.
  return normalizeText(body.name).includes(query);
}

function matchesCategory(body, category) {
  const types = CATEGORY_TYPES[normalizeText(category)];
  if (!types) {
    return true; // "All", or an unknown category, matches everything.
  }
  return types.includes(normalizeText(body.type));
}

function filterBodies(bodies, query, category) {
  const needle = normalizeText(query);
  return bodies.filter((body) => {
    if (!matchesCategory(body, category)) {
      return false;
    }
    // An empty query means "no name restriction", not "match nothing".
    return needle === "" || matchesQuery(body, needle);
  });
}

/* --- Rendering ----------------------------------------------------------- */

function describeFilters() {
  const parts = [];
  if (state.query) {
    parts.push(`matching “${state.query}”`);
  }
  if (normalizeText(state.category) !== "all") {
    parts.push(`in ${state.category}`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function renderResults() {
  state.results = filterBodies(state.bodies, state.query, state.category);
  el.results.replaceChildren();

  const count = state.results.length;
  if (count === 0) {
    el.status.textContent = `No celestial bodies found${describeFilters()}. Try a different name or category.`;
    return;
  }

  el.status.textContent = `${count} ${count === 1 ? "result" : "results"}${describeFilters()}.`;

  for (const body of state.results) {
    el.results.append(createResultItem(body));
  }
}

function createResultItem(body) {
  const item = document.createElement("li");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "result-button";
  button.dataset.id = body.id;

  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = body.name;

  // Distance is optional: SIMBAD's basic table has no distance column, so its
  // galaxies, nebulae, clusters and pulsars carry coordinates and a
  // classification but no distance. Show the type alone rather than "undefined".
  const meta = document.createElement("span");
  meta.className = "result-meta";
  const distance = typeof body.distance === "string" ? body.distance.trim() : "";
  meta.textContent = distance ? `${body.type} · ${distance}` : body.type;

  button.append(name, meta);
  button.addEventListener("click", () => renderDetails(body));
  item.append(button);
  return item;
}

/* Fill a detail row, hiding it when the record has no value for that field.
   Not every object has a published diameter, and a blank row reads as missing
   data rather than as data that was never measured. */
function setDetailRow(row, valueElement, value) {
  const text = typeof value === "string" ? value.trim() : "";
  valueElement.textContent = text;
  row.hidden = text === "";
}

function renderDetails(body) {
  el.detailName.textContent = body.name;
  el.detailTypeValue.textContent = body.type;

  setDetailRow(el.rowDistance, el.detailDistance, body.distance);
  setDetailRow(el.rowSize, el.detailSize, body.size);
  setDetailRow(el.rowCircumference, el.detailCircumference, body.circumference);
  setDetailRow(el.rowSource, el.detailSource, body.sourceName);

  const hasMeasurement = Boolean(body.measurementLabel && body.measurementValue);
  el.detailMeasurementLabel.textContent = hasMeasurement ? body.measurementLabel : "";
  setDetailRow(el.rowMeasurement, el.detailMeasurementValue,
    hasMeasurement ? body.measurementValue : "");

  el.browseView.hidden = true;
  el.detailView.hidden = false;
  el.backButton.focus();
}

/* Returning to the browse view keeps the query, category and rendered list,
   because none of them were torn down when the detail view opened. */
function showBrowseView() {
  el.detailView.hidden = true;
  el.browseView.hidden = false;
  el.input.focus();
}

/* --- Interaction --------------------------------------------------------- */

/* Hide category buttons no record can match. This lets a category be added to
   the markup ahead of its data without leaving a dead filter in the interface. */
function hideEmptyCategories() {
  for (const button of el.filterButtons.querySelectorAll(".chip")) {
    const category = button.dataset.category;
    const isAll = normalizeText(category) === "all";
    button.hidden = !isAll && !state.bodies.some((body) => matchesCategory(body, category));
  }
}

function setCategory(category) {
  state.category = category;
  for (const button of el.filterButtons.querySelectorAll(".chip")) {
    const isActive = button.dataset.category === category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  renderResults();
}

function submitSearch() {
  state.query = el.input.value.trim();
  renderResults();
}

function resetSearch() {
  el.input.value = "";
  state.query = "";
  setCategory("All");
  el.input.focus();
}

/* Browse and quiz are the two top-level sections. app.js owns which one is on
   screen; quiz.js owns everything inside the quiz panel and listens for the
   mode event so it can stop its timer when the player leaves. */
function setMode(mode) {
  const quizzing = mode === "quiz";
  el.quizView.hidden = !quizzing;
  // Switching mode always returns Browse to the results list rather than a
  // stale detail view.
  el.detailView.hidden = true;
  el.browseView.hidden = quizzing;

  for (const button of el.modeNav.querySelectorAll(".chip")) {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  document.dispatchEvent(new CustomEvent("unimap:mode", { detail: mode }));
}

function attachHandlers() {
  el.modeNav.addEventListener("click", (event) => {
    const button = event.target.closest(".chip");
    if (button) {
      setMode(button.dataset.mode);
    }
  });

  // Submitting the form covers both the Search button and the Enter key.
  el.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSearch();
  });

  el.clearButton.addEventListener("click", resetSearch);
  el.backButton.addEventListener("click", showBrowseView);

  el.filterButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".chip");
    if (button) {
      setCategory(button.dataset.category);
    }
  });
}

async function init() {
  attachHandlers();
  try {
    state.bodies = await loadData();
  } catch (error) {
    console.error("UniMap could not load celestial body data:", error);
    el.status.textContent = "";
    showError(
      "Sorry — UniMap could not load its celestial body data. " +
        "If you opened index.html directly from your filesystem, serve the folder " +
        "over a local static server instead (see the README).",
    );
    return;
  }
  hideEmptyCategories();
  renderResults();

  // Hand the loaded catalogue to quiz mode. Gameplay makes no request of its
  // own, so a quiz never depends on the network (DECISIONS.md D6).
  document.dispatchEvent(new CustomEvent("unimap:data", { detail: state.bodies }));
}

init();
