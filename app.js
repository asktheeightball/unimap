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
  index: [],
  query: "",
  category: "All",
  results: [],
  ranked: [],
  suggestions: [],
  activeSuggestion: -1,
  announcedCount: -1,
  // id -> record, built once at load. Related-object links resolve through
  // this rather than scanning the catalogue on every detail render, which
  // would make the cost of opening a page grow with the catalogue.
  byId: new Map(),
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
  detailDesignation: document.getElementById("detail-designation"),
  detailSummary: document.getElementById("detail-summary"),
  detailNotability: document.getElementById("detail-notability"),
  detailSections: document.getElementById("detail-sections"),
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

function matchesCategory(body, category) {
  const types = CATEGORY_TYPES[normalizeText(category)];
  if (!types) {
    return true; // "All", or an unknown category, matches everything.
  }
  return types.includes(normalizeText(body.type));
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

/* Identifiers indexed per record: the stable `id` slug and every entry in
   `aliases`. This catalogue has no separate `sourceRecordId` field — `id` and
   `aliases` are the documented identifier fields (README "Record schema"). */
function buildIndexEntry(body, position) {
  const nameTerm = createTerm(String(body.name ?? ""), "name");
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
  // A record displayed under a common name is headed by that name, so its
  // formal designation must stay findable — and vice versa. Indexing both means
  // "Betelgeuse" and "alf Ori" reach the same record whichever one the
  // catalogue happens to display. No record carries `commonName` yet; this is
  // here so search does not have to be revisited when a source supplies one.
  addTerm(String(body.commonName ?? ""), "name");

  for (const alias of Array.isArray(body.aliases) ? body.aliases : []) {
    if (typeof alias === "string") {
      addTerm(alias, "alias");
    }
  }
  addTerm(String(body.id ?? ""), "identifier");

  return {
    body,
    position, // catalogue order, used as the final deterministic tiebreak
    name: nameTerm ? nameTerm.normalized : "",
    nameCompact: nameTerm ? nameTerm.compact : "",
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
  if (entry.name.startsWith(normalized) || entry.nameCompact.startsWith(compact)) {
    return { tier: TIER.prefixName, label: entry.body.name };
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
  if (normalizeText(state.category) !== "all") {
    parts.push(`in ${state.category}`);
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
  button.textContent = body.name;
  button.addEventListener("click", () => {
    el.input.value = body.name;
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

/* --- Detail view ---------------------------------------------------------

   The detail page is grouped rather than listed: a reader looking for where an
   object is should not have to scan past its parallax to find its coordinates.

   Each section declares the fields it may show, in display order, as a
   [label, value] pair. A field with no value produces no row, and a section
   with no rows is never created — so an enriched record and a sparse one both
   read as finished pages rather than one looking broken. Nothing here prints a
   raw field name, a null, or an empty string. */

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/* The generic measurement slot means something different on every record, and
   each meaning now has a field that names itself. Show the generic pair only
   when its label is not one of those, so a record written before the named
   fields existed — or by a future importer — still displays its measurement
   instead of silently losing it. */
const NAMED_MEASUREMENT_LABELS = new Set([
  "Radius (Earth radii)",
  "Parallax (mas)",
  "Semi-major axis (AU)",
  "SIMBAD classification",
]);

function legacyMeasurement(body) {
  const label = text(body.measurementLabel);
  const value = text(body.measurementValue);
  if (!label || !value || NAMED_MEASUREMENT_LABELS.has(label)) {
    return [];
  }
  return [[label, value]];
}

function detailSections(body) {
  const identifiers = Array.isArray(body.catalogueIdentifiers)
    ? body.catalogueIdentifiers.filter((entry) => text(entry))
    : [];

  return [
    ["Overview", [
      ["Type", body.type],
      ["Classification", body.classification],
      ["Host star", body.hostName],
      ["Orbits", body.parentBody],
    ]],
    ["Location", [
      ["Constellation", body.constellation],
      ["Distance", body.distance],
      ["Right ascension", body.rightAscension ? `${body.rightAscension}°` : ""],
      ["Declination", body.declination ? `${body.declination}°` : ""],
    ]],
    ["Discovery", [
      ["Discovered by", body.discoverer],
      ["Discovery date", body.discoveryDate],
      ["Discovered", body.discoveryDate ? "" : body.discoveryYear],
      ["Method", body.discoveryMethod],
    ]],
    ["Physical details", [
      ["Size", body.size],
      ["Circumference", body.circumference],
      ["Radius", body.radiusEarth ? `${body.radiusEarth} × Earth` : ""],
      ["Mass", body.massEarth ? `${body.massEarth} × Earth` : ""],
      ["Spectral type", body.spectralType],
      ["Parallax", body.parallaxMas ? `${body.parallaxMas} mas` : ""],
      ["Semi-major axis", body.semiMajorAxisAu ? `${body.semiMajorAxisAu} AU` : ""],
      ...legacyMeasurement(body),
    ]],
    ["Names and identifiers", [
      ["Also known as", identifiers.join(", ")],
    ]],
  ];
}

function createDetailSection(title) {
  const section = document.createElement("section");
  section.className = "detail-section";

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  return section;
}

function createDetailRow(label, value) {
  const row = document.createElement("div");
  row.className = "detail-row";

  const term = document.createElement("dt");
  term.textContent = label;

  const definition = document.createElement("dd");
  definition.textContent = value;

  row.append(term, definition);
  return row;
}

/* Related objects are rendered as buttons into the same detail view, so a
   reader can walk from a planet to its star, or a black hole to its galaxy,
   without going back through search. An id that names no record is skipped
   rather than rendered as a link that goes nowhere; the validator already
   rejects that case, so this is defence against a hand-edited catalogue. */
function createRelatedSection(body) {
  const ids = Array.isArray(body.relatedObjectIds) ? body.relatedObjectIds : [];
  const related = ids
    .map((id) => state.byId.get(id))
    .filter((entry) => entry && entry.id !== body.id);

  if (related.length === 0) {
    return null;
  }

  const section = createDetailSection("Related objects");
  const list = document.createElement("ul");
  list.className = "detail-related";

  for (const entry of related) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "link-button";
    button.dataset.id = entry.id;
    button.textContent = entry.name;
    button.addEventListener("click", () => renderDetails(entry));
    item.append(button);
    list.append(item);
  }

  section.append(list);
  return section;
}

/* Attribution is a section of its own so a reader can always tell where a
   record came from. An importer-owned record links to the service that
   published it; an editorial record names the person's work instead and does
   NOT invent a URL for prose no source supplied. */
function createSourceSection(body) {
  const rows = [];
  const sourceName = text(body.sourceName);
  const sourceUrl = text(body.sourceUrl);
  const editorial = text(body.summarySource);

  const section = createDetailSection("Source");
  const list = document.createElement("dl");
  list.className = "detail-list";

  if (sourceName) {
    const row = document.createElement("div");
    row.className = "detail-row";
    const term = document.createElement("dt");
    term.textContent = "Data from";
    const definition = document.createElement("dd");
    if (sourceUrl) {
      const link = document.createElement("a");
      link.href = sourceUrl;
      link.textContent = sourceName;
      link.rel = "noopener noreferrer";
      definition.append(link);
    } else {
      definition.textContent = sourceName;
    }
    row.append(term, definition);
    list.append(row);
    rows.push(row);
  }

  for (const [label, value] of [
    ["Reviewed", body.lastReviewed],
    ["Description", editorial],
    ["Description reviewed", body.summaryReviewed],
  ]) {
    if (!text(value)) {
      continue;
    }
    const row = createDetailRow(label, text(value));
    list.append(row);
    rows.push(row);
  }

  if (rows.length === 0) {
    return null;
  }
  section.append(list);
  return section;
}

function renderDetails(body) {
  el.detailName.textContent = body.name;

  // A record displayed under a common name keeps its formal designation
  // visible; one displayed under its designation already shows it as the
  // heading, so repeating it would be noise.
  const commonName = text(body.commonName);
  const designation = commonName && commonName !== body.name ? body.name : "";
  el.detailName.textContent = commonName || body.name;
  el.detailDesignation.textContent = designation;
  el.detailDesignation.hidden = designation === "";

  const description = describeBody(body);
  el.detailSummary.textContent = description;
  el.detailSummary.hidden = description === "";

  const notability = text(body.notability);
  el.detailNotability.textContent = notability;
  el.detailNotability.hidden = notability === "";

  el.detailSections.replaceChildren();

  for (const [title, fields] of detailSections(body)) {
    const rows = fields.filter(([, value]) => text(value));
    if (rows.length === 0) {
      continue;
    }
    const section = createDetailSection(title);
    const list = document.createElement("dl");
    list.className = "detail-list";
    for (const [label, value] of rows) {
      list.append(createDetailRow(label, text(value)));
    }
    section.append(list);
    el.detailSections.append(section);
  }

  for (const section of [createRelatedSection(body), createSourceSection(body)]) {
    if (section) {
      el.detailSections.append(section);
    }
  }

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

  const name = document.createElement("span");
  name.className = "suggestion-name";
  name.textContent = match.entry.body.name;

  const meta = document.createElement("span");
  meta.className = "suggestion-meta";
  // Show which alias or identifier matched, but only when it is not simply the
  // name again — repeating the name as its own subtitle reads as a bug.
  const matchedLabel = match.label && match.label !== match.entry.body.name
    ? `${match.entry.body.type} · ${match.label}`
    : match.entry.body.type;
  meta.textContent = matchedLabel;

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
  el.input.value = body.name;
  closeSuggestions();
  submitSearch();
  renderDetails(body);
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
  // Suggestions respect the category filter, so a filter change invalidates an
  // open list.
  closeSuggestions();
}

function submitSearch() {
  state.query = el.input.value.trim();
  renderResults();
}

function resetSearch() {
  el.input.value = "";
  state.query = "";
  closeSuggestions();
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

  el.filterButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".chip");
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
  state.byId = new Map(state.bodies.map((body) => [body.id, body]));
  hideEmptyCategories();
  closeSuggestions();
  renderResults();

  // Hand the loaded catalogue to quiz mode. Gameplay makes no request of its
  // own, so a quiz never depends on the network (DECISIONS.md D6).
  document.dispatchEvent(new CustomEvent("unimap:data", { detail: state.bodies }));
}

init();
