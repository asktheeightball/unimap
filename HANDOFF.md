# UniMap Handoff

Update this file at the end of every meaningful work session. It should describe the repository as it actually exists, not merely the intended state.

## Project summary

UniMap is a dependency-free static astronomy catalogue and quiz application.

Technology:

- HTML
- CSS
- Vanilla JavaScript
- JSON

There is no framework, package manager, build command, backend, database, or authentication.

## Repository

- GitHub: `asktheeightball/unimap`
- Current working branch: `claude/quiz-expansion-persistence-olq1ow`
- Previous working branch: `claude/search-intelligence-autocomplete-tzkv43` (this branch continues it)
- Repository default branch remains `claude/unimap-static-app-uj0ql5`
- Do not change branch strategy or deployment automation without first reconciling the default branch with the active branch

## Current implementation

- `index.html` contains the semantic page structure and Browse/Quiz navigation.
- `styles.css` contains responsive presentation.
- `app.js` loads the catalogue, builds the search index, ranks and filters results, renders details, drives the autocomplete combobox, and switches modes.
- `quiz.js` implements question generation, difficulty tiers, timing, scoring, and versioned local leaderboards.
- `celestial-bodies.json` contains **208 records**.
- Categories are a declared model with stable ids in `app.js`; Planets is a disclosure group holding All Planets (69), Solar System Planets (3), Exoplanets (61), Dwarf Planets (5) and Candidate Dwarf Planets (0). Moons and Brown Dwarfs are top-level and outside it.
- Moons, Brown Dwarfs and Candidate Dwarf Planets are declared, validated and tested but hidden — none has a record yet.
- The detail view prefers hand-written `summary` over importer-generated `sourceSummary`, and groups fields into six sections that hide when empty.
- 197 records carry source metadata and generated descriptions; 192 carry coordinates.
- Structured quiz fields: `hostName`, `discoveryYear` and `discoveryMethod` on the 60 exoplanets, `spectralType` on 63 stars, and the editorial `wellKnown` flag on 85 records.
- Enrichment fields (P5): `classification` 132, `commonName` 91, `massEarth` 59, `catalogueIdentifiers` 36, `orbitClass` 5, and `discoverer`/`discoveryDate`/`discoverySite` 1 each.
- `name` always holds the formal designation. Where a record has a `commonName` that is what the interface shows, with the designation beside it; both are searchable.
- Project-control documents define product scope, priorities, roadmap, decisions, deployment, and contributor instructions.

## Current functional behavior

The application currently provides:

- tiered search over names, aliases and catalogue ids, with punctuation-insensitive matching and spelling tolerance;
- an accessible autocomplete listbox with mouse, touch and keyboard selection;
- explicit `Did you mean …?` corrections that never rewrite the query;
- a Planets category group with sub-filters, and flat filters for everything else;
- result counts and a no-results state;
- Clear Search;
- keyboard-accessible results;
- detail view and Back navigation;
- preserved query/category/results when returning;
- responsive phone, tablet, and desktop layout;
- visible data-load errors;
- quiz mode with Effortless, Easy, Medium, Hard, and Impossible;
- 10 questions per game;
- four choices and exactly one correct answer;
- time-based scoring from 100 to 0;
- difficulty that changes the question content, not only the timer, with a fallback ladder that keeps each mode's own clock;
- eight question families, and a giveaway rule that discards any question whose answer is visible in its own prompt;
- separate top-10 `localStorage` leaderboards for all five modes, versioned, migrating, corruption-recovering, and exportable/importable as JSON;
- verified desktop and mobile Quiz navigation.

## Newly approved feature priorities

The user approved and requested these features be written into GitHub.

### Complete: P3 — Search intelligence and autocomplete

Delivered 2026-07-28. See `DECISIONS.md` D13 and the "Searching" section of
`README.md`.

### Complete: P4 — Quiz expansion and persistence

Delivered 2026-07-28. See `DECISIONS.md` D14, D14a and D15, and the "Quiz mode"
section of `README.md`.

Four requested question families could not be built from the real catalogue and
were rejected with evidence rather than approximated: discovery method (one
distinct value), discoverer and constellation (no such field on any record), and
host-star relationships and aliases (both give the answer away through naming
convention). Each returns automatically when the data supports it.

### Complete: P5 — Catalogue information enrichment

Delivered 2026-07-28. See `DECISIONS.md` D16, D17 and D18, and the "Record
schema" and "Searching" sections of `README.md`.

### Complete: P6 — Planet category hierarchy

Delivered 2026-07-28. See `DECISIONS.md` D19–D22 and the "Categories" section of
`README.md`.

### Current: P7 — Add candidate dwarf planets, brown dwarfs, galaxy clusters, and more sourced objects

### Then

1. P8 — Add per-object and catalogue-wide celestial maps
2. P9 — Add properly attributed local images
3. P10 — Expand lightweight validation automation

See `PRIORITY.md` for acceptance criteria and `ROADMAP.md` for full outcomes.

## Important product decisions carried forward

- UniMap remains static and dependency-free.
- Search, autocomplete, quiz, and the first map use local data only.
- Do not fabricate astronomy facts or provenance.
- Candidate dwarf planets must be distinct from recognized dwarf planets.
- Brown dwarfs must have their own category and must not be placed under Planets.
- Galaxy clusters must remain distinct from star clusters.
- Solar-system planets, exoplanets, dwarf planets, and candidate dwarf planets should share a Planets hierarchy.
- Changing solar-system positions must not be displayed as permanent fixed sky coordinates without clear date/epoch semantics.

## Known limitations

- Leaderboards persist only in `localStorage` on the same browser and device. Export/import is the supported way to move them; there is no cross-device sync.
- Discovery data exists for the 60 exoplanets plus Ceres. `discoveryMethod` is `Transit` for all 60, so no discovery-method question can be asked. Only Ceres carries a `discoverer`, so that family needs four distinct values before it can exist.
- No record carries a constellation. See the probe steps below.
- Exoplanets are named after their host stars, so the host question family stays withdrawn (`DECISIONS.md` D14a). The alias family is superseded by the designation family, which pairs `commonName` with `name` instead.
- **No exoplanet host star exists as a record.** All 60 were checked by name and alias; none resolves. Related-object links cannot be built until the hosts are imported.
- `massEarth` is available on 59 records with 56 distinct values, so a mass question family is *possible* but was not enabled: it would be exoplanets only, in a unit most players have no intuition for.
- `distance` and `size` are absent from most imported deep-sky records — 24 of 28 galaxies and 14 of 17 nebulae have neither — so measurement questions come mostly from stars and exoplanets.
- Why an object is notable is not available from current imported source responses for most records.
- Black-hole expansion remains blocked on a defensible authoritative classification source.
- The previously configured moon endpoint returned HTTP 404 and must not be reused without correction.
- Fuzzy matching compares whole strings and whole words, so a typo *inside* a
  multi-word name is corrected but a query that is a misspelled fragment of a
  long name may not be. This was judged the right trade against false positives.
- Aliases are indexed as their sources wrote them, so classification-style
  entries such as `Spectral type K5+III` are searchable. That is useful but they
  are not names.
- Suggestions are capped at eight and the fuzzy pass contributes at most twelve
  records to any result list.
- `tools/search_checks.mjs` and `tools/quiz_checks.mjs` need a Playwright
  install; they are optional maintainer tooling and the site itself still has no
  dependencies.
- **Correction (2026-07-28): the astronomy hosts are not universally blocked.**
  Earlier sessions recorded an HTTP 403 at CONNECT for every astronomy host and
  treated it as a permanent constraint. That was a property of *that* sandbox,
  not of the sources. On a normally networked machine SIMBAD, the NASA Exoplanet
  Archive and the JPL SBDB all respond, and P5's common names were fetched live
  from SIMBAD. SIMBAD needs `--ca-bundle` on Windows (see `tools/README.md`).
  Check before assuming an import cannot be run; the recovery tools remain
  useful because they are cheaper and auditable, not because the network is
  unreachable.
- `tools/search_checks.mjs` and `tools/quiz_checks.mjs` locate a global
  Playwright install by running `npm root -g`. Recent Node refuses to launch
  npm's `.cmd` shim without a shell, so on Windows this raised EINVAL and the
  suites reported Playwright as missing even when it was installed. Fixed by
  running that one lookup through a shell.

## Local start

From the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Do not test by double-clicking `index.html`; browser `file://` security prevents the JSON fetch.

## Safe-start procedure for a new session

1. Confirm repository and current branch.
2. Run `git status --short --branch`.
3. Run `git fetch --all --prune`.
4. Do not discard uncommitted changes.
5. Read all root Markdown files.
6. Inspect actual code and catalogue counts before trusting documentation.
7. Start the highest-ranked item in `PRIORITY.md`.
8. Keep the static, dependency-free architecture unless an approved decision changes it.

## Last session

- Date: 2026-07-28 (P6)
- Branch: `claude/quiz-expansion-persistence-olq1ow`
- Starting commit: `eef2348`
- Task: **P6 — Planet category hierarchy. Complete.**
- Files changed: `app.js`, `index.html`, `styles.css`, `celestial-bodies.json`,
  `tools/validate_catalogue.py`, `tools/search_checks.mjs`,
  `tools/quiz_checks.mjs`, and the control documents.
- Validation: 225 search checks, 121 quiz checks, catalogue validator clean at
  208 records.
- Catalogue change: exactly one field — `kepler-452b.type`, Planet to Exoplanet.
- Next priority: **P7 — Catalogue expansion and new object classes.**

Note for P7: `Candidate Dwarf Planet` and `Brown Dwarf` already have category,
validator and check support. Importing a record of either type lights its filter
up with no interface work, so P7 is a sourcing problem rather than a code one.
A candidate dwarf planet source must not simply treat every large TNO as a
candidate — that is the same error `select_names` exists to prevent for the
recognised dwarf planets.

## Previous session

- Date: 2026-07-28 (P5)
- Branch: `claude/quiz-expansion-persistence-olq1ow`
- Starting commit: `eef0794`
- Task: **P5 — Catalogue information enrichment. Complete.**
- Files changed: `celestial-bodies.json`, `app.js`, `quiz.js`, `index.html`,
  `styles.css`, `tools/enrich_catalogue.py` (new),
  `tools/fetch_common_names.py` (new), `tools/common-names.json` (new),
  `tools/validate_catalogue.py`, `tools/search_checks.mjs`,
  `tools/quiz_checks.mjs`, and the control documents.
- Validation: 151 search checks, 113 quiz checks, 14 validator negative cases,
  catalogue validator clean at 208 records with 0 warnings.
- Next priority: **P6 — Planet category hierarchy.**

### Unresolved probes, with exact steps

**Constellation.** No source UniMap queries publishes one, so it must be derived
from coordinates. The defensible method is the standard boundary lookup, and it
is not a one-liner — the boundary table is defined in B1875 coordinates, so
every J2000 position has to be precessed back before it can be tested:

```bash
# 1. Fetch the IAU constellation boundary table (Roman 1987, VizieR VI/42).
python3 tools/import_catalogue.py --source constellation-boundaries --probe --refresh
# 2. Confirm the real column names and units in the cached response before
#    writing any lookup. Do not assume the RA unit — VI/42 uses hours, not degrees.
```

Then implement: precess J2000 → B1875, find the first boundary row whose
declination floor is below the target and whose RA span contains it, and store
`constellation` plus the epoch assumption. Validate against a handful of known
positions (Betelgeuse → Orion, Vega → Lyra) before writing the catalogue. A
moving solar-system body must not be given a fixed constellation without an
explicit date, so restrict the first pass to the 192 records with catalogue
coordinates and exclude the dwarf planets.

**Exoplanet host stars.** None of the 60 hosts exists as a record, so related
objects cannot be linked. They are faint Kepler/KOI stars; importing them would
add ~60 records and needs its own curation decision under P7, not a quiet
side-effect of a linking feature.

**Notability.** No response carries it. The 11 records with no description at all
(`cygnus-x-1`, `m87-star`, `sagittarius-a-star`, `milky-way`, `psr-b1919-21`,
`psr-j0348-0432`, `earth`, `jupiter`, `kepler-452b`, `mars`, `sol`) are exactly
the 11 with no provenance — the original hand-authored records. Each needs
either an import that covers it or hand-written `summary` text with a cited
source and review date.

**Resolved in P6:** `kepler-452b` was typed `Planet` and is now `Exoplanet`, on
the NASA Exoplanet Archive's own listing of it as a confirmed planet in the
cached response here. See `DECISIONS.md` D22.

## Previous session

- Date: 2026-07-28
- Branch: `claude/quiz-expansion-persistence-olq1ow`
- Starting commit: `7361ca6` (the branch was 12 commits behind, sitting on the
  old `unimap-static-app` tip; it was **fast-forwarded** onto
  `origin/claude/search-intelligence-autocomplete-tzkv43`, of which it was a
  strict ancestor. Nothing was reset, discarded or force-pushed.)
- Task selected: **P4 — Quiz expansion and persistence**
- Status: **Complete**
- Files changed: `quiz.js`, `index.html`, `styles.css`, `celestial-bodies.json`,
  `tools/derive_quiz_fields.py` (new), `tools/quiz_checks.mjs` (new),
  `tools/import_catalogue.py`, `tools/validate_catalogue.py`, `tools/README.md`,
  `PRIORITY.md`, `ROADMAP.md`, `DECISIONS.md`, `README.md`, `HANDOFF.md`
- Catalogue changed: still 208 records, no value altered. Four structured fields
  were added from values already published in the same records, plus the
  editorial `wellKnown` flag.

What changed in the data:

- `hostName`, `discoveryYear`, `discoveryMethod` recovered onto the 60 exoplanets
  and `spectralType` onto 63 stars. Earlier imports fetched these columns and
  wrote them only into the generated `sourceSummary` sentence;
  `tools/derive_quiz_fields.py` reverses that exact template and requires the
  captured values to re-render the stored sentence byte for byte, refusing any
  record that does not. `hostName` is additionally corroborated against the
  `"<host> system"` alias. No new fact was created.
- `wellKnown` set on 85 records from the curated `select_identifiers` /
  `select_names` lists and `id_overrides` already in `tools/sources.json`.
- `tools/import_catalogue.py` now writes all four fields directly, so no future
  import needs the recovery step.

What changed in the application:

- Effortless mode at 20 seconds, selected by default, drawing only on the 34
  well-known records whose name is a common name rather than a catalogue
  designation, and asking only identity and type questions;
- difficulty became an ordered ladder of tiers per mode, falling back to simpler
  content while keeping its own timer, so a mode never serves a short game;
- three new question families (discovery year; spectral type in both directions;
  coordinates in both directions) and a structural giveaway rule that discards
  any question whose answer is visible in its prompt;
- explanations are led by the fact the question turned on, with host and method
  context on discovery answers, instead of a generic field dump;
- leaderboard storage became a versioned `{version, entries}` envelope with
  in-place migration, per-entry validation, quarantine of unreadable data under a
  `.corrupt` key, a visible device-only note, and JSON export/import that merges.

Validation performed:

- `python3 tools/validate_catalogue.py` — 208 records, **0 errors, 0 warnings**
- `python3 tools/derive_quiz_fields.py --dry-run` — idempotent on the committed
  catalogue, 0 refusals
- `node tools/quiz_checks.mjs` — **105/105 checks passed**, covering the five
  timers, ten-question games in 40 sampled games per mode, answer-set integrity
  across 2,000 generated questions, zero prompts containing their own answer,
  the Effortless content and pool rules, Hard/Impossible family separation at
  ≥80% preferred content, same-category distractors, fallback against a
  deliberately bare fixture catalogue, explanations, the storage schema,
  migration from the unversioned array, corruption quarantine, export/import
  round-trips, a full game played by mouse and keyboard, persistence across a
  reload, phone layout and touch, and console errors
- `node tools/search_checks.mjs` — **121/121 checks passed**, no regression from
  the catalogue's new fields

- Deployment performed: none
- Next priority: **P5 — Catalogue information enrichment**
- Uncommitted work: none
