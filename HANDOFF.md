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
- The detail view prefers hand-written `summary` over importer-generated `sourceSummary`.
- 197 records carry source metadata and generated descriptions; 192 carry coordinates.
- Structured quiz fields: `hostName`, `discoveryYear` and `discoveryMethod` on the 60 exoplanets, `spectralType` on 63 stars, and the editorial `wellKnown` flag on 85 records.
- Project-control documents define product scope, priorities, roadmap, decisions, deployment, and contributor instructions.

## Current functional behavior

The application currently provides:

- tiered search over names, aliases and catalogue ids, with punctuation-insensitive matching and spelling tolerance;
- an accessible autocomplete listbox with mouse, touch and keyboard selection;
- explicit `Did you mean …?` corrections that never rewrite the query;
- flat category filters;
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

### Current: P5 — Catalogue information enrichment

### Then

1. P6 — Group all planet types under one Planets hierarchy
2. P7 — Add candidate dwarf planets, brown dwarfs, galaxy clusters, and more sourced objects
3. P8 — Add per-object and catalogue-wide celestial maps
4. P9 — Add properly attributed local images
5. P10 — Expand lightweight validation automation

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
- Discovery data exists only for the 60 exoplanets, and its `discoveryMethod` is `Transit` for every one of them, so no discovery-method question can be asked.
- No record carries a discoverer or a constellation, so those question families cannot be built at all.
- Exoplanets are named after their host stars and the five informative aliases embed their object's name, so host and alias question families are withdrawn (`DECISIONS.md` D14a).
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
- The astronomy hosts remain blocked by the sandbox network policy (HTTP 403 at
  CONNECT), so no import can be re-run from this environment. This is why
  `tools/derive_quiz_fields.py` recovers fields from the committed catalogue
  instead of refetching them.

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
