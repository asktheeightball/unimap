/* UniMap — search and browse a small catalogue of celestial bodies. */

const DATA_URL = "celestial-bodies.json";

/* --- Category model ------------------------------------------------------

   One declaration drives the filter buttons, the matching rules, the counts and
   the empty-category rule. A category is identified by a stable `id`, never by
   its visible label, so a label can be reworded without changing stored state
   or the markup's contract.

   `types` lists the catalogue `type` values a category accepts, spelled exactly
   as records spell them. Matching is an exact comparison against that list —
   never an inference from pluralising the label, which is what previously tied
   "Galaxies" to "galaxy" by a second spelling in the list.

   A group owns `children` instead of `types`. Its children are ordinary
   categories; the group itself is a disclosure control, not a filter. */
const CATEGORY_GROUPS = [
  { id: "all", label: "All", types: null },
  { id: "stars", label: "Stars", types: ["Star"] },
  {
    id: "planets",
    label: "Planets",
    children: [
      // A composite: every kind of planet the catalogue distinguishes. Moons and
      // brown dwarfs are deliberately absent — a moon orbits a planet rather
      // than being one, and a brown dwarf never became a star but is not a
      // planet either.
      {
        id: "all-planets",
        label: "All Planets",
        types: ["Planet", "Exoplanet", "Dwarf Planet", "Candidate Dwarf Planet"],
      },
      { id: "solar-system-planets", label: "Solar System Planets", types: ["Planet"] },
      { id: "exoplanets", label: "Exoplanets", types: ["Exoplanet"] },
      { id: "dwarf-planets", label: "Dwarf Planets", types: ["Dwarf Planet"] },
      // A candidate is not a recognised dwarf planet, so it is a separate type
      // and a separate filter. No record carries it yet; the empty-category rule
      // keeps the control out of the interface until P7 supplies one.
      {
        id: "candidate-dwarf-planets",
        label: "Candidate Dwarf Planets",
        types: ["Candidate Dwarf Planet"],
      },
    ],
  },
  { id: "moons", label: "Moons", types: ["Moon"] },
  { id: "brown-dwarfs", label: "Brown Dwarfs", types: ["Brown Dwarf"] },
  { id: "nebulae", label: "Nebulae", types: ["Nebula"] },
  { id: "black-holes", label: "Black Holes", types: ["Black Hole"] },
  // A pulsar is a neutron star, so one filter reaches both. Catalogue sources
  // distinguish them, and the record keeps whichever type its source reports.
  { id: "neutron-stars", label: "Neutron Stars", types: ["Neutron Star", "Pulsar"] },
  { id: "galaxies", label: "Galaxies", types: ["Galaxy"] },
  { id: "star-clusters", label: "Star Clusters", types: ["Star Cluster"] },
];

const DEFAULT_CATEGORY = "all";
/* Activating the Planets group selects this child, so the group always produces
   a result set rather than only revealing more controls. */
const DEFAULT_PLANET_CATEGORY = "all-planets";

/* Flatten the model once: id -> { label, types, groupId }. Built at load rather
   than per keystroke, because filtering and the autocomplete both consult it. */
const CATEGORIES = new Map();
for (const entry of CATEGORY_GROUPS) {
  if (entry.children) {
    for (const child of entry.children) {
      CATEGORIES.set(child.id, { ...child, groupId: entry.id });
    }
  } else {
    CATEGORIES.set(entry.id, { ...entry, groupId: null });
  }
}

const CATEGORY_GROUP_IDS = new Set(
  CATEGORY_GROUPS.filter((entry) => entry.children).map((entry) => entry.id),
);

function categoryById(id) {
  return CATEGORIES.get(String(id ?? "").trim()) || null;
}

function categoryLabel(id) {
  const category = categoryById(id);
  return category ? category.label : "";
}

const state = {
  bodies: [],
  index: [],
  query: "",
  category: DEFAULT_CATEGORY,
  // Which disclosure group is open, or null. Separate from `category` because a
  // group is a container, never a filter.
  openGroup: null,
  results: [],
  ranked: [],
  suggestions: [],
  activeSuggestion: -1,
  announcedCount: -1,
};

const el = {
  form: document.getElementById("search-form"),
  input: document.getElementById("search-input"),
  clearButton: document.getElementById("clear-button"),
  filters: document.getElementById("filters"),
  filterButtons: document.getElementById("filter-buttons"),
  planetFilters: document.getElementById("planet-filters"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  error: document.getElementById("error"),
  browseView: document.getElementById("browse-view"),
  detailView: document.getElementById("detail-view"),
  quizView: document.getElementById("quiz-view"),
  modeNav: document.getElementById("mode-nav"),
  backButton: document.getElementById("back-button"),
  detailName: document.getElementById("detail-name"),
  detailFormal: document.getElementById("detail-formal"),
  detailSummary: document.getElementById("detail-summary"),
  searchField: document.getElementById("search-combobox"),
  suggestions: document.getElementById("search-suggestions"),
  suggestionStatus: document.getElementById("search-suggestion-status"),
  searchHelp: document.getElementById("search-help"),
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

/* Exact type matching against the category's declared list. An unknown id and
   the "all" category both match everything, so a stale stored value degrades to
   showing the catalogue rather than to showing nothing. */
function matchesCategory(body, categoryId) {
  const category = categoryById(categoryId);
  if (!category || !category.types) {
    return true;
  }
  return category.types.includes(String(body?.type ?? "").trim());
}

/* How many records each category would show, counted once after load. The
   counts drive the visible counts in the interface and the empty-category rule,
   and neither should re-scan the catalogue on every click. */
function countCategories(bodies) {
  const counts = new Map();
  for (const [id, category] of CATEGORIES) {
    counts.set(id, category.types
      ? bodies.filter((body) => matchesCategory(body, id)).length
      : bodies.length);
  }
  // A group's count is its own children's composite, which is the "All X" child.
  for (const entry of CATEGORY_GROUPS) {
    if (!entry.children) {
      continue;
    }
    const total = entry.children.reduce(
      (best, child) => Math.max(best, counts.get(child.id) || 0), 0);
    counts.set(entry.id, total);
  }
  return counts;
}

/* --- Search index --------------------------------------------------------

   The catalogue is small enough to search directly, but the raw strings are
   not comparable as typed: SIMBAD aliases arrive as "* alf Ori", JPL ones as
   "136199 Eris (2003 UB313)", and names carry hyphens and spaces a visitor
   will not reproduce exactly. So each record is indexed once, after load, into
   normalized forms. The records themselves are never mutated — the index holds
   references, and everything displayed still comes from the original values. */

/* Fold a string to its comparable form: decomposed accents dropped, common
   Unicode dashes and quotes flattened to ASCII, punctuation reduced to spaces,
   whitespace collapsed. "Kepler-200 c" and "* alf Ori" both survive as
   something a person could actually type. */
function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* The same text with spaces removed, so "kepler200c" finds "Kepler-200 c" and
   "proximacentauri" finds "Proxima Centauri". Compared separately from the
   spaced form rather than replacing it, because dropping spaces makes short
   queries far more collision-prone. */
function compactSearchText(normalized) {
  return normalized.replace(/ /g, "");
}

/* One searchable string belonging to a record. `label` is the text to show a
   visitor when this term is what matched; `kind` decides which ranking tier
   the match lands in. */
function createTerm(label, kind) {
  const normalized = normalizeSearchText(label);
  if (!normalized) {
    return null;
  }
  return { label, kind, normalized, compact: compactSearchText(normalized) };
}

/* The name to show a reader. `name` holds the formal designation the import
   produced ("* 51 Peg"); `commonName` holds the recognisable name the source
   publishes for the same object ("Helvetios"). Preferring the common name is a
   display decision only — nothing in the data is renamed, and the designation
   is still shown beside it and still searchable. */
function displayName(body) {
  const common = typeof body?.commonName === "string" ? body.commonName.trim() : "";
  return common || String(body?.name ?? "");
}

/* The formal designation, returned only when it differs from what is displayed,
   so callers can show it as secondary text without repeating the heading. */
function formalName(body) {
  const formal = String(body?.name ?? "").trim();
  return formal && formal !== displayName(body) ? formal : "";
}

/* Identifiers indexed per record: the stable `id` slug, every entry in
   `aliases`, and every alternate name in `catalogueIdentifiers`. A record's
   `commonName` is indexed as a *name*, not an identifier: someone typing
   "Sirius" means the object, and demoting that to the alias tier would rank an
   exact common-name match below a prefix match on a designation. */
function buildIndexEntry(body, position) {
  const nameTerm = createTerm(String(body.name ?? ""), "name");
  const commonTerm = createTerm(displayName(body), "name");
  const terms = [];
  const seen = new Set();

  const addTerm = (label, kind) => {
    const term = createTerm(label, kind);
    // A record whose id merely re-slugs its name adds nothing to search but
    // would show up as a duplicate suggestion line, so identical forms are
    // indexed once.
    if (term && !seen.has(term.normalized)) {
      seen.add(term.normalized);
      terms.push(term);
    }
  };

  if (nameTerm) {
    seen.add(nameTerm.normalized);
  }
  if (commonTerm) {
    seen.add(commonTerm.normalized);
  }
  for (const alias of Array.isArray(body.aliases) ? body.aliases : []) {
    if (typeof alias === "string") {
      addTerm(alias, "alias");
    }
  }
  for (const identifier of Array.isArray(body.catalogueIdentifiers) ? body.catalogueIdentifiers : []) {
    if (typeof identifier === "string") {
      addTerm(identifier, "alias");
    }
  }
  addTerm(String(body.id ?? ""), "identifier");

  return {
    body,
    position, // catalogue order, used as the final deterministic tiebreak
    name: nameTerm ? nameTerm.normalized : "",
    nameCompact: nameTerm ? nameTerm.compact : "",
    // The displayed name, compared in the same tiers as the formal one so
    // either route reaches an exact match.
    common: commonTerm ? commonTerm.normalized : "",
    commonCompact: commonTerm ? commonTerm.compact : "",
    commonLabel: commonTerm ? commonTerm.label : "",
    terms,
  };
}

function buildSearchIndex(bodies) {
  return bodies.map(buildIndexEntry);
}

/* --- Matching and ranking ------------------------------------------------ */

/* Lower is better. Fuzzy is deliberately the last tier so a typo-tolerant
   match can never outrank a literal one. */
const TIER = {
  exactName: 0,
  prefixName: 1,
  exactTerm: 2,
  prefixTerm: 3,
  substringName: 4,
  substringTerm: 5,
  fuzzy: 6,
};

/* Edit distance allowed by query length. Short queries get no tolerance at
   all: at three characters almost every catalogue name is within one edit, so
   fuzzy matching there produces noise rather than corrections. */
function fuzzyBudget(length) {
  if (length < 4) return 0;
  if (length < 6) return 1;
  if (length < 10) return 2;
  return 3;
}

/* Damerau-Levenshtein (optimal string alignment), bounded: it stops as soon as
   every cell in a row exceeds `max`, which keeps the cost near O(n · max)
   instead of O(n · m) for the overwhelming majority of non-matching records.
   Transpositions count as one edit, so "Betelguese" is one step from
   "Betelgeuse". */
function boundedEditDistance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length <= max ? b.length : max + 1;
  if (!b.length) return a.length <= max ? a.length : max + 1;

  // Three rolling rows: the row before last is what a transposition looks back
  // at. They are rotated rather than reallocated so a full catalogue sweep does
  // not churn the garbage collector.
  let twoBack = new Array(b.length + 1);
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowBest = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowBest) {
        rowBest = value;
      }
    }
    if (rowBest > max) {
      return max + 1; // no continuation of this row can come back under the bound
    }
    const spare = twoBack;
    twoBack = previous;
    previous = current;
    current = spare;
  }
  return previous[b.length] <= max ? previous[b.length] : max + 1;
}

/* A candidate is only offered as a correction when it is close in absolute
   edits *and* proportionally close. Without the ratio test a three-edit budget
   lets a ten-character query reach unrelated short names. */
function isCloseEnough(distance, budget, queryLength, targetLength) {
  if (distance > budget) return false;
  const longest = Math.max(queryLength, targetLength);
  return longest > 0 && distance / longest <= 0.34;
}

/* Best literal (non-fuzzy) match for one record, or null. */
function scoreDirect(entry, normalized, compact) {
  if (entry.name === normalized || entry.nameCompact === compact) {
    return { tier: TIER.exactName, label: entry.body.name };
  }
  // A common name is a name, so it shares the name tiers. Checked after the
  // formal name only to decide which label to report, never to change the tier.
  if (entry.common && (entry.common === normalized || entry.commonCompact === compact)) {
    return { tier: TIER.exactName, label: entry.commonLabel };
  }
  if (entry.name.startsWith(normalized) || entry.nameCompact.startsWith(compact)) {
    return { tier: TIER.prefixName, label: entry.body.name };
  }
  if (entry.common
      && (entry.common.startsWith(normalized) || entry.commonCompact.startsWith(compact))) {
    return { tier: TIER.prefixName, label: entry.commonLabel };
  }

  let best = null;
  const consider = (tier, label) => {
    if (!best || tier < best.tier) {
      best = { tier, label };
    }
  };

  for (const term of entry.terms) {
    if (term.normalized === normalized || term.compact === compact) {
      consider(TIER.exactTerm, term.label);
    } else if (term.normalized.startsWith(normalized) || term.compact.startsWith(compact)) {
      consider(TIER.prefixTerm, term.label);
    }
  }
  if (best) {
    return best;
  }

  if (entry.name.includes(normalized) || entry.nameCompact.includes(compact)) {
    return { tier: TIER.substringName, label: entry.body.name };
  }
  if (entry.common && (entry.common.includes(normalized) || entry.commonCompact.includes(compact))) {
    return { tier: TIER.substringName, label: entry.commonLabel };
  }
  for (const term of entry.terms) {
    if (term.normalized.includes(normalized) || term.compact.includes(compact)) {
      consider(TIER.substringTerm, term.label);
    }
  }
  return best;
}

/* Closest fuzzy match for one record, measured against the whole name, each
   individual word of the name, and each identifier. Comparing words as well as
   the whole string is what lets "Andromida" reach "Andromeda Galaxy" and
   "Centari" reach "Proxima Centauri". */
function scoreFuzzy(entry, normalized, budget) {
  if (budget < 1) {
    return null;
  }
  let best = null;
  const consider = (candidate, label) => {
    if (!candidate) return;
    const distance = boundedEditDistance(normalized, candidate, budget);
    if (!isCloseEnough(distance, budget, normalized.length, candidate.length)) return;
    if (!best || distance < best.distance) {
      best = { tier: TIER.fuzzy, label, distance };
    }
  };

  consider(entry.name, entry.body.name);
  for (const word of entry.name.split(" ")) {
    if (word.length > 2) {
      consider(word, entry.body.name);
    }
  }
  // A misspelled common name should be correctable too: "Betelguese" already
  // worked, "Arcturis" only works if the common name is compared as well.
  if (entry.common) {
    consider(entry.common, entry.commonLabel);
    for (const word of entry.common.split(" ")) {
      if (word.length > 2) {
        consider(word, entry.commonLabel);
      }
    }
  }
  for (const term of entry.terms) {
    consider(term.normalized, term.label);
  }
  return best;
}

/* A fuzzy pass never contributes more than this many records. Corrections are
   meant to rescue a misspelling, not to fill the page with near-misses. */
const MAX_FUZZY_MATCHES = 12;

/* Rank records for a query within the active category.

   `directTarget` is how many literal matches are enough: the fuzzy pass runs
   only when the literal passes fall short of it. That is the whole performance
   story — on a typed prefix, the common case, no edit distance is computed at
   all. The results list passes 1 (correct only a query that found nothing);
   the suggestion list passes 8 (top up a short list). */
function searchIndex(query, category, directTarget) {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }
  const compact = compactSearchText(normalized);
  const budget = fuzzyBudget(normalized.length);

  const matches = [];
  const unmatched = [];
  for (const entry of state.index) {
    if (!matchesCategory(entry.body, category)) {
      continue; // search always respects the active category filter
    }
    const direct = scoreDirect(entry, normalized, compact);
    if (direct) {
      matches.push({ ...direct, entry, distance: 0 });
    } else {
      unmatched.push(entry);
    }
  }

  if (matches.length < directTarget && budget > 0) {
    const fuzzy = [];
    for (const entry of unmatched) {
      const scored = scoreFuzzy(entry, normalized, budget);
      if (scored) {
        fuzzy.push({ ...scored, entry });
      }
    }
    fuzzy.sort((a, b) => a.distance - b.distance || a.entry.position - b.entry.position);
    matches.push(...fuzzy.slice(0, MAX_FUZZY_MATCHES));
  }

  matches.sort((a, b) =>
    a.tier - b.tier ||
    a.distance - b.distance ||
    a.entry.name.length - b.entry.name.length ||
    a.entry.position - b.entry.position);
  return matches;
}

/* The browse list. With no query the catalogue keeps its original order; with
   a query it is ordered by match quality. */
function filterBodies(query, category) {
  if (!normalizeSearchText(query)) {
    state.ranked = [];
    return state.bodies.filter((body) => matchesCategory(body, category));
  }
  // Kept so the no-results panel can ask *how* the results matched without
  // running the search a second time.
  state.ranked = searchIndex(query, category, 1);
  return state.ranked.map((match) => match.entry.body);
}

/* --- Rendering ----------------------------------------------------------- */

function describeFilters() {
  const parts = [];
  if (state.query) {
    parts.push(`matching “${state.query}”`);
  }
  if (state.category !== DEFAULT_CATEGORY) {
    parts.push(`in ${categoryLabel(state.category)}`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

function renderResults() {
  state.results = filterBodies(state.query, state.category);
  el.results.replaceChildren();
  renderSearchHelp();

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

/* Spelling guidance. Two cases, and nothing in between:

   - the query found nothing at all, which needs the full panel: what was
     searched, a correction, a few close names, and a way out;
   - the query only matched by edit distance, which needs the correction line
     alone — the results are already on screen underneath it.

   The query is never silently rewritten in either case. */
function renderSearchHelp() {
  el.searchHelp.replaceChildren();
  const empty = state.query !== "" && state.results.length === 0;
  const corrected = state.query !== "" && state.ranked.length > 0
    && state.ranked[0].tier === TIER.fuzzy;
  el.searchHelp.hidden = !empty && !corrected;
  if (el.searchHelp.hidden) {
    return;
  }

  if (empty) {
    const intro = document.createElement("p");
    intro.className = "search-help-intro";
    intro.textContent = `Nothing in the catalogue matches “${state.query}”.`;
    el.searchHelp.append(intro);
  }

  // On an empty result set the correction ignores the category filter: when a
  // filter is the reason a spelling matched nothing, the useful answer is still
  // the object itself.
  const nearby = empty
    ? searchIndex(state.query, "All", 8).slice(0, 4)
    : state.ranked.slice(0, 1);

  if (nearby.length) {
    const suggestion = document.createElement("p");
    suggestion.className = "search-help-correction";
    suggestion.append(document.createTextNode("Did you mean "));
    suggestion.append(createCorrectionButton(nearby[0].entry.body));
    suggestion.append(document.createTextNode("?"));
    el.searchHelp.append(suggestion);

    const rest = nearby.slice(1);
    if (rest.length) {
      const alsoLabel = document.createElement("p");
      alsoLabel.className = "search-help-intro";
      alsoLabel.textContent = "Other close matches:";
      const list = document.createElement("ul");
      list.className = "search-help-list";
      for (const match of rest) {
        const item = document.createElement("li");
        item.append(createCorrectionButton(match.entry.body));
        list.append(item);
      }
      el.searchHelp.append(alsoLabel, list);
    }
  }

  if (empty) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn";
    clear.id = "search-help-clear";
    clear.textContent = "Clear search";
    clear.addEventListener("click", resetSearch);
    el.searchHelp.append(clear);
  }
}

/* Accepting a correction replaces the query with the object's real name and
   re-runs the search, so the visitor can see what was corrected rather than
   being teleported into a detail view they did not ask for. */
function createCorrectionButton(body) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "link-button";
  button.dataset.id = body.id;
  button.textContent = displayName(body);
  button.addEventListener("click", () => {
    el.input.value = displayName(body);
    submitSearch();
    el.input.focus();
  });
  return button;
}

function createResultItem(body) {
  const item = document.createElement("li");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "result-button";
  button.dataset.id = body.id;

  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = displayName(body);

  // Distance is optional: SIMBAD's basic table has no distance column, so its
  // galaxies, nebulae, clusters and pulsars carry coordinates and a
  // classification but no distance. Show the type alone rather than "undefined".
  // The formal designation joins the subtitle when a common name took the
  // heading, so a reader can still see which catalogue object this is.
  const meta = document.createElement("span");
  meta.className = "result-meta";
  const distance = typeof body.distance === "string" ? body.distance.trim() : "";
  const formal = formalName(body);
  meta.textContent = [formal, body.type, distance].filter(Boolean).join(" · ");

  button.append(name, meta);
  button.addEventListener("click", () => renderDetails(body));
  item.append(button);
  return item;
}

/* --- Detail sections -----------------------------------------------------

   The detail view groups fields under headings rather than listing every field
   it knows about. A row appears only when the record carries a value, and a
   section appears only when it ended up with at least one row, so a sparse
   record shows a short page instead of a page of blanks. Labels are written for
   a reader; no internal field name is ever displayed. */

/* One row's worth of text, or "" when the record has nothing to show. Arrays are
   joined so a list of names reads as a sentence rather than as JSON. */
function detailValue(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).join(" · ");
  }
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value.trim() : "";
}

function appendDetailRow(list, label, value) {
  const text = detailValue(value);
  if (!text) {
    return false;
  }
  const row = document.createElement("div");
  row.className = "detail-row";
  const term = document.createElement("dt");
  term.textContent = label;
  const definition = document.createElement("dd");
  definition.textContent = text;
  row.append(term, definition);
  list.append(row);
  return true;
}

/* Which rows belong to which section. Each entry is [label, value], resolved
   against the record at render time. */
function detailSections(body) {
  const coordinates = body.rightAscension && body.declination
    ? `RA ${body.rightAscension}°, Dec ${body.declination}° (J2000)`
    : "";

  // A measurement's label is stored with it, because the quantity differs by
  // object type — a parallax and an Earth-radius ratio are not the same kind of
  // number and must never be shown under one heading.
  const measurement = body.measurementLabel && body.measurementValue
    ? [String(body.measurementLabel), body.measurementValue]
    : null;

  return [
    ["overview", [
      ["Type", body.type],
      // SIMBAD's own words for what the object is, which is finer-grained than
      // the category UniMap files it under.
      ["Source classification", body.classification],
      ["Spectral type", body.spectralType],
    ]],
    ["location", [
      ["Distance", body.distance],
      ["Orbits", body.hostName],
      ["Orbit class", body.orbitClass],
      ["Coordinates", coordinates],
    ]],
    ["discovery", [
      ["Discovered by", body.discoverer],
      ["Discovery date", body.discoveryDate || body.discoveryYear],
      ["Discovery method", body.discoveryMethod],
      ["Discovery site", body.discoverySite],
    ]],
    ["physical", [
      ["Size", body.size],
      ["Circumference", body.circumference],
      ["Mass", body.massEarth ? `${body.massEarth} × Earth` : ""],
      measurement ? measurement : ["", ""],
    ]],
    ["names", [
      ["Catalogue designation", formalName(body)],
      ["Also known as", body.catalogueIdentifiers],
      ["Other identifiers", body.aliases],
    ]],
    ["source", [
      ["Source", body.sourceName],
      ["Reviewed", body.lastReviewed],
    ]],
  ];
}

function renderDetailSections(body) {
  for (const [key, rows] of detailSections(body)) {
    const section = document.getElementById(`detail-section-${key}`);
    const list = document.getElementById(`detail-list-${key}`);
    if (!section || !list) {
      continue;
    }
    list.replaceChildren();
    let filled = 0;
    for (const [label, value] of rows) {
      if (label && appendDetailRow(list, label, value)) {
        filled += 1;
      }
    }
    section.hidden = filled === 0;
  }
}

/* A hand-written `summary` always wins over the importer-generated
   `sourceSummary`, and the two are never merged: one is editorial prose a person
   wrote, the other is assembled from the values a source returned. A record with
   neither shows no paragraph at all rather than an empty block. */
function describeBody(body) {
  const written = typeof body.summary === "string" ? body.summary.trim() : "";
  if (written) {
    return written;
  }
  return typeof body.sourceSummary === "string" ? body.sourceSummary.trim() : "";
}

function renderDetails(body) {
  el.detailName.textContent = displayName(body);

  // The formal designation sits under the heading when a common name took it,
  // so the recognisable name leads and the catalogue identity is still visible.
  const formal = formalName(body);
  el.detailFormal.textContent = formal;
  el.detailFormal.hidden = formal === "";

  const description = describeBody(body);
  el.detailSummary.textContent = description;
  el.detailSummary.hidden = description === "";

  renderDetailSections(body);

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

/* --- Autocomplete --------------------------------------------------------

   An ARIA 1.2 combobox: the input owns `aria-expanded`, `aria-controls` and
   `aria-activedescendant`, and the list below it is a listbox of options. The
   options are not buttons — a listbox may only contain options — so selection
   is driven by pointer and key handlers on the list itself.

   Selecting a suggestion opens that object's detail view. The search box is
   also set to the object's name and the search re-run, so Back returns to a
   result list that contains it rather than to whatever was on screen before. */

const MIN_SUGGEST_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

function closeSuggestions() {
  state.suggestions = [];
  state.activeSuggestion = -1;
  state.announcedCount = -1;
  el.suggestions.replaceChildren();
  el.suggestions.hidden = true;
  el.input.setAttribute("aria-expanded", "false");
  el.input.removeAttribute("aria-activedescendant");
  el.suggestionStatus.textContent = "";
}

function updateSuggestions() {
  const query = el.input.value.trim();
  if (normalizeSearchText(query).length < MIN_SUGGEST_LENGTH) {
    closeSuggestions();
    return;
  }

  const matches = searchIndex(query, state.category, MAX_SUGGESTIONS)
    .slice(0, MAX_SUGGESTIONS);
  if (!matches.length) {
    closeSuggestions();
    return;
  }

  // searchIndex returns each record once, at its best tier, so a record can
  // never appear twice and two aliases of the same object cannot both show.
  state.suggestions = matches;
  state.activeSuggestion = -1;
  el.suggestions.replaceChildren(...matches.map(createSuggestionItem));
  el.suggestions.hidden = false;
  el.input.setAttribute("aria-expanded", "true");
  el.input.removeAttribute("aria-activedescendant");
  announceSuggestionCount(matches.length);
}

/* Announce only when the number changes. Re-announcing an unchanged count on
   every keystroke is the chatter this is meant to avoid. */
function announceSuggestionCount(count) {
  if (count === state.announcedCount) {
    return;
  }
  state.announcedCount = count;
  el.suggestionStatus.textContent =
    `${count} ${count === 1 ? "suggestion" : "suggestions"} available.`;
}

function createSuggestionItem(match, position) {
  const item = document.createElement("li");
  item.className = "suggestion";
  item.id = `search-suggestion-${position}`;
  item.setAttribute("role", "option");
  item.setAttribute("aria-selected", "false");
  item.dataset.position = String(position);

  const body = match.entry.body;
  const shown = displayName(body);

  const name = document.createElement("span");
  name.className = "suggestion-name";
  name.textContent = shown;

  const meta = document.createElement("span");
  meta.className = "suggestion-meta";
  // Show the formal designation and whichever alias matched, skipping anything
  // that merely repeats the heading — a name echoed as its own subtitle reads
  // as a bug.
  const matched = match.label && match.label !== shown && match.label !== body.name
    ? match.label
    : "";
  meta.textContent = [formalName(body), body.type, matched].filter(Boolean).join(" · ");

  item.append(name, meta);
  return item;
}

function setActiveSuggestion(position) {
  const options = el.suggestions.querySelectorAll(".suggestion");
  state.activeSuggestion = position;
  options.forEach((option, index) => {
    const isActive = index === position;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
    if (isActive) {
      el.input.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    }
  });
  if (position < 0) {
    el.input.removeAttribute("aria-activedescendant");
  }
}

function moveActiveSuggestion(step) {
  const count = state.suggestions.length;
  if (!count) {
    return;
  }
  // Wraps in both directions, so Arrow Up from the input lands on the last
  // suggestion — the usual shortcut to the bottom of a short list.
  const next = (state.activeSuggestion + step + count + 1) % (count + 1);
  setActiveSuggestion(next === count ? -1 : next);
}

function selectSuggestion(position) {
  const match = state.suggestions[position];
  if (!match) {
    return;
  }
  const body = match.entry.body;
  // The displayed name is what the reader just chose, and it is indexed in the
  // same tiers as the formal one, so the re-run search still contains it.
  el.input.value = displayName(body);
  closeSuggestions();
  submitSearch();
  renderDetails(body);
}

/* --- Interaction --------------------------------------------------------- */

/* Hide category controls no record can match, so a category can be declared
   ahead of its data without leaving a dead filter in the interface. This is the
   single rule for every empty category — Moons, Brown Dwarfs and Candidate Dwarf
   Planets are all declared and all currently hidden, and each appears by itself
   the moment P7 supplies a record. A group hides only when every child is empty.

   Counts are written into the labels here too, so the number a control promises
   is the number it delivers. */
function renderCategoryControls() {
  const counts = countCategories(state.bodies);

  for (const button of document.querySelectorAll("[data-category]")) {
    const id = button.dataset.category;
    const count = counts.get(id) || 0;
    button.hidden = id !== DEFAULT_CATEGORY && count === 0;
    const label = button.querySelector(".chip-count");
    if (label) {
      label.textContent = String(count);
    }
  }

  for (const toggle of document.querySelectorAll("[data-group]")) {
    toggle.hidden = (counts.get(toggle.dataset.group) || 0) === 0;
  }
}

/* Open or close a disclosure group. Opening one selects its default child, so a
   group always produces results rather than only revealing more controls. */
function setOpenGroup(groupId) {
  state.openGroup = groupId;
  for (const toggle of document.querySelectorAll("[data-group]")) {
    const open = toggle.dataset.group === groupId;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("is-open", open);
    const children = document.getElementById(toggle.getAttribute("aria-controls"));
    if (children) {
      children.hidden = !open;
    }
  }
}

function setCategory(categoryId) {
  const category = categoryById(categoryId);
  const id = category ? categoryId : DEFAULT_CATEGORY;
  state.category = id;

  // A child selection keeps its group open; anything else closes every group,
  // so the planet sub-filters are never left showing beside an unrelated filter.
  setOpenGroup(category ? category.groupId : null);

  for (const button of document.querySelectorAll("[data-category]")) {
    const isActive = button.dataset.category === id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  // The group control reflects that the filter lives inside it, without
  // claiming to be the pressed filter itself.
  for (const toggle of document.querySelectorAll("[data-group]")) {
    toggle.classList.toggle("is-active",
      Boolean(category) && category.groupId === toggle.dataset.group);
  }

  renderResults();
  // Suggestions respect the category filter, so a filter change invalidates an
  // open list.
  closeSuggestions();
}

/* The group control is a disclosure, not a filter: opening it selects the
   group's default child, closing it returns to the unfiltered catalogue. */
function toggleGroup(groupId) {
  if (state.openGroup === groupId) {
    setCategory(DEFAULT_CATEGORY);
    return;
  }
  const group = CATEGORY_GROUPS.find((entry) => entry.id === groupId);
  const fallback = group && group.children ? group.children[0].id : DEFAULT_CATEGORY;
  setCategory(groupId === "planets" ? DEFAULT_PLANET_CATEGORY : fallback);
}

function submitSearch() {
  state.query = el.input.value.trim();
  renderResults();
}

function resetSearch() {
  el.input.value = "";
  state.query = "";
  closeSuggestions();
  setCategory(DEFAULT_CATEGORY);
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
  closeSuggestions();

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
    closeSuggestions();
    submitSearch();
  });

  el.clearButton.addEventListener("click", resetSearch);
  el.backButton.addEventListener("click", showBrowseView);

  // One handler for the whole filter area, including the second row of planet
  // sub-filters, so a category added to the markup needs no new wiring.
  el.filters.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-group]");
    if (toggle) {
      toggleGroup(toggle.dataset.group);
      return;
    }
    const button = event.target.closest("[data-category]");
    if (button) {
      setCategory(button.dataset.category);
    }
  });

  attachSuggestionHandlers();
}

function attachSuggestionHandlers() {
  el.input.addEventListener("input", updateSuggestions);

  el.input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (el.suggestions.hidden) {
        updateSuggestions();
        // Opening the list is the whole action for the first Arrow Down; the
        // caret should not also jump to the end of the input.
        event.preventDefault();
        return;
      }
      event.preventDefault();
      moveActiveSuggestion(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && state.activeSuggestion >= 0) {
      // Only an active suggestion intercepts Enter. With none highlighted the
      // form submits as it always has.
      event.preventDefault();
      selectSuggestion(state.activeSuggestion);
      return;
    }
    if (event.key === "Escape" && !el.suggestions.hidden) {
      event.preventDefault();
      closeSuggestions();
    }
  });

  // Pointer events cover mouse and touch alike. `pointerdown` runs before the
  // input loses focus, so it must not be allowed to blur the field out from
  // under the click that follows.
  el.suggestions.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".suggestion")) {
      event.preventDefault();
    }
  });

  el.suggestions.addEventListener("click", (event) => {
    const option = event.target.closest(".suggestion");
    if (option) {
      selectSuggestion(Number(option.dataset.position));
    }
  });

  el.suggestions.addEventListener("pointermove", (event) => {
    const option = event.target.closest(".suggestion");
    if (option) {
      setActiveSuggestion(Number(option.dataset.position));
    }
  });

  // Leaving the search interaction entirely closes the list; moving between the
  // input and the suggestions does not.
  el.searchField.addEventListener("focusout", (event) => {
    if (!el.searchField.contains(event.relatedTarget)) {
      closeSuggestions();
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
  // Build the search index once, immediately after load: every keystroke then
  // compares pre-normalized strings instead of re-folding the catalogue.
  state.index = buildSearchIndex(state.bodies);
  renderCategoryControls();
  closeSuggestions();
  renderResults();

  // Hand the loaded catalogue to quiz mode. Gameplay makes no request of its
  // own, so a quiz never depends on the network (DECISIONS.md D6).
  document.dispatchEvent(new CustomEvent("unimap:data", { detail: state.bodies }));
}

init();
