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
- Current working branch: `claude/catalogue-information-enrichment-a5nlhs`
- Previous working branch: `claude/quiz-expansion-persistence-olq1ow` (this branch continues it)
- Repository default branch remains `claude/unimap-static-app-uj0ql5`
- Do not change branch strategy or deployment automation without first reconciling the default branch with the active branch

## Current implementation

- `index.html` contains the semantic page structure and Browse/Quiz navigation.
- `styles.css` contains responsive presentation.
- `app.js` loads the catalogue, builds the search index and an id lookup map, ranks and filters results, renders the sectioned detail view and related-object links, drives the autocomplete combobox, and switches modes.
- `quiz.js` implements question generation, difficulty tiers, timing, scoring, and versioned local leaderboards.
- `celestial-bodies.json` contains **208 records**.
- The detail view prefers hand-written `summary` over importer-generated `sourceSummary`, and groups fields into Overview, Location, Discovery, Physical details, Names and identifiers, Related objects and Source. Empty sections are never rendered.
- **All 208 records carry a description**: 197 generated, 11 hand-written.
- 197 records carry source metadata; 192 carry coordinates.
- Structured quiz fields: `hostName`, `discoveryYear` and `discoveryMethod` on the 60 exoplanets, `spectralType` on 66 stars, and the editorial `wellKnown` flag on 85 records.
- Enrichment fields: `classification` 132, `catalogueIdentifiers` 68, `parallaxMas` 66, `radiusEarth` 60, `constellation` 60, `massEarth` 59, `summary`/`notability` 11, `relatedObjectIds` 7, `semiMajorAxisAu` 5, `parentBody` 3, `discoverer` 2, `discoveryDate` 1.
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

### Complete: P5 — Catalogue information enrichment

Every record now carries a description. Fields were added only from values the
catalogue already published or from clearly marked editorial text; no new source
was probed, because every astronomy host is refused by the sandbox network
policy. The parts that need a probe are written out as exact commands under
"Blocked on network access" in `PRIORITY.md`.

### Current: P6 — Planet category hierarchy

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
- Discovery data exists for the 60 exoplanets plus Ceres and two editorial records. `discoveryMethod` is `Transit` on all 61 that carry it, so no discovery-method question can be asked.
- Only 2 records carry a `discoverer` (Ceres from JPL, PSR B1919+21 editorial), which is far short of the four distinct values a question needs.
- `constellation` is on 60 records but is unusable in the quiz: it is derived from the object's own designation, which is the displayed name, so 60 of 60 records name their own answer (`DECISIONS.md` D15e).
- No record carries a `commonName`. 54 stars therefore display a Bayer designation (`alf Ori`). The pairing cannot be recovered offline — see `PRIORITY.md`.
- Notability exists on only 11 records, and its provenance is "UniMap editorial" with no source URL, because none could be verified offline (`DECISIONS.md` D15b).
- No exoplanet is linked to its host star: none of the 60 `hostName` values names a catalogue record, because the archive query selects planets and not their stars.
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
- `tools/search_checks.mjs`, `tools/quiz_checks.mjs` and `tools/detail_checks.mjs` need a Playwright
  install; they are optional maintainer tooling and the site itself still has no
  dependencies.
- The astronomy hosts remain blocked by the sandbox network policy (HTTP 403 at
  CONNECT), so no import can be re-run from this environment. This is why
  `tools/derive_quiz_fields.py` and `tools/derive_enrichment.py` recover fields
  from the committed catalogue instead of refetching them.
- `tools/constellations.json` was transcribed without network access and has not
  been checked against the IAU's published list. Confirm it before treating it
  as authoritative, exactly as the attribution strings in `tools/sources.json`
  still need confirming.

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
- Branch: `claude/catalogue-information-enrichment-a5nlhs`
- Starting commit: `10998fa`. The branch was 16 commits behind, sitting on the
  old `unimap-static-app` tip, and its remote copy had been deleted. It was
  **fast-forwarded** onto `origin/claude/quiz-expansion-persistence-olq1ow`, of
  which it was a strict ancestor. Nothing was reset, discarded or force-pushed.
- Task selected: **P5 — Catalogue information enrichment**
- Status: **Complete**, except for the parts that require network access, which
  are documented as exact probes rather than approximated.
- Catalogue changed: still 208 records. **No existing field value was modified**
  — verified field by field against the pre-promotion catalogue, along with
  record count, record order, ids, types, names, coordinates, generated
  summaries and source metadata.

What changed in the data:

- Named measurements split out of the single generic `measurementLabel` /
  `measurementValue` slot, whose meaning changed from record to record:
  `radiusEarth` 60, `parallaxMas` 66, `semiMajorAxisAu` 5, `classification` 132.
  The slot is kept for records carrying a measurement UniMap has not named.
- `massEarth` on 59 exoplanets, recovered from the summary sentence the importer
  rendered `pl_bmasse` into but never stored as a field.
- `constellation` on 60 records, expanded from the Bayer, Flamsteed or
  variable-star designation that states it by construction. Never from
  coordinates, and never on a moving solar-system body.
- `catalogueIdentifiers` on 68 records: the subset of `aliases` that is a real
  designation, with the stored-fact pseudo-aliases removed. `aliases` itself is
  untouched, so search is unaffected.
- `discoverer` and `discoveryDate` for Ceres, recovered from the discovery block
  JPL returns and the importer appended to the summary verbatim.
- `spectralType` for 3 more stars that had no alias to read it from.
- Editorial `summary` and `notability` for the 11 records that had no
  description of any kind, plus `parentBody` and `relatedObjectIds` on 7
  records.

Every value recovered from generated prose is proved by re-rendering the whole
sentence from the importer's own template and requiring byte-for-byte equality.
Both derivation tools are idempotent and refuse rather than guess; across the
whole catalogue they reported **0 refusals**.

What changed in the application:

- the detail view became sectioned (Overview, Location, Discovery, Physical
  details, Names and identifiers, Related objects, Source), with empty sections
  suppressed and no raw field name, null or empty string able to reach the page;
- related objects render as buttons into the same detail view, resolved through
  a `state.byId` map built once at load — render time stays flat at 0.058ms over
  an 11-fold catalogue;
- editorial records show a "UniMap editorial" attribution and deliberately no
  source link;
- the heading prefers `commonName` and keeps the formal designation beneath it,
  and the search index covers `commonName`, so the application is ready for the
  data whenever a probe can supply it;
- quiz: the **mass** family was enabled (59 records, 56 distinct answers, no
  leak) and **classification** widened from 66 to 132 records with no answer
  changed. Four families stayed rejected on fresh measurements.

Validation performed:

- `python3 tools/validate_catalogue.py` — 208 records, 0 errors, 0 warnings
- `node tools/detail_checks.mjs` — 69/69 (new)
- `node tools/quiz_checks.mjs` — 105/105
- `node tools/search_checks.mjs` — 121/121, no regression
- `python3 tools/derive_enrichment.py --dry-run` — idempotent, 0 refusals
- `python3 tools/apply_editorial.py --dry-run` — idempotent, 0 refusals
- `python3 tools/derive_quiz_fields.py --dry-run` — idempotent, 0 refusals
- 300 sampled games: 3,000 questions, every game exactly 10, zero answer leaks,
  zero duplicate option sets
- screenshots at 900px and at 375x667 reviewed by eye

Deployment status: not deployed by this session.

Uncommitted work: none.

Next priority: **P6 — Planet category hierarchy**.
