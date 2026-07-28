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
- Current working branch: `claude/search-intelligence-autocomplete-tzkv43`
- Previous working branch: `claude/catalogue-expansion-200-250-ygs28r` (this branch continues it)
- Repository default branch remains `claude/unimap-static-app-uj0ql5`
- Do not change branch strategy or deployment automation without first reconciling the default branch with the active branch

## Current implementation

- `index.html` contains the semantic page structure and Browse/Quiz navigation.
- `styles.css` contains responsive presentation.
- `app.js` loads the catalogue, builds the search index, ranks and filters results, renders details, drives the autocomplete combobox, and switches modes.
- `quiz.js` implements question generation, timing, scoring, and local leaderboards.
- `celestial-bodies.json` contains **208 records**.
- The detail view prefers hand-written `summary` over importer-generated `sourceSummary`.
- 197 records carry source metadata and generated descriptions; 192 carry coordinates.
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
- quiz mode with Easy, Medium, Hard, and Impossible;
- 10 questions per game;
- four choices and exactly one correct answer;
- time-based scoring from 100 to 0;
- separate top-10 `localStorage` leaderboards;
- verified desktop and mobile Quiz navigation.

## Newly approved feature priorities

The user approved and requested these features be written into GitHub.

### Complete: P3 — Search intelligence and autocomplete

Delivered 2026-07-28. See `DECISIONS.md` D13 and the "Searching" section of
`README.md`.

### Current: P4 — Quiz expansion and persistence

- Add Effortless mode at 20 seconds.
- Add more question families.
- Make Hard and Impossible use discovery, discoverer, year, method, host, spectral type, alias, classification, coordinate, and other verified details.
- Strengthen local leaderboard persistence with schema versioning, corruption recovery, on-device labelling, and JSON export/import.
- A cross-device/global leaderboard remains a future backend decision.

### Then

1. P5 — More verified information on celestial bodies
2. P6 — Group all planet types under one Planets hierarchy
3. P7 — Add candidate dwarf planets, brown dwarfs, galaxy clusters, and more sourced objects
4. P8 — Add per-object and catalogue-wide celestial maps
5. P9 — Add properly attributed local images
6. P10 — Expand lightweight validation automation

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

- The quiz has four modes; Effortless is not implemented.
- Existing leaderboards persist only in `localStorage` on the same browser/device.
- Discovery data is not available for every object.
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
- `tools/search_checks.mjs` needs a Playwright install; it is optional maintainer
  tooling and the site itself still has no dependencies.

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
- Branch: `claude/search-intelligence-autocomplete-tzkv43`
- Starting commit: `8e8556a` (the branch was 12 commits behind and was
  fast-forwarded onto it; nothing was reset or discarded)
- Task selected: **P3 — Search intelligence and autocomplete**
- Status: **Complete**
- Files changed: `app.js`, `index.html`, `styles.css`, `tools/search_checks.mjs`
  (new), `PRIORITY.md`, `ROADMAP.md`, `DECISIONS.md`, `README.md`, `HANDOFF.md`
- Catalogue changed: none; remains 208 records and validates with 0 warnings

What changed in the application:

- a normalized search index is built once after load over `name`, `aliases` and
  the `id` slug — no record is mutated;
- matches rank in seven tiers, exact name through fuzzy;
- fuzzy matching is bounded Damerau-Levenshtein, budget scaled by query length,
  off below four characters, gated behind the literal passes;
- an ARIA 1.2 combobox shows up to eight suggestions;
- `Did you mean …?` appears when only a fuzzy match was found, and a fuller
  panel when nothing matched at all;
- the footer and its CSS were removed.

Validation performed:

- `python3 tools/validate_catalogue.py` — 208 records, 0 warnings
- `node tools/search_checks.mjs` — **121/121 checks passed**, covering matching
  and ranking, alias and identifier lookup, one-character and transposed typos,
  the short-query threshold, unrelated queries, category filtering under fuzzy
  search, suggestion count and de-duplication, mouse click, real touchscreen
  tap, Arrow Up/Down, Enter, Escape, the combobox ARIA attributes, list closure
  on clear, both correction states, desktop and 320/375/390-wide mobile layout,
  horizontal overflow, browse/detail/Back, quiz navigation and question
  generation, console errors, and footer removal
- Search performance: 1.66 ms per query worst case on the 208-record catalogue,
  2.60 ms on a synthetic 1,000-record fixture. No debounce was needed.

- Deployment performed: none
- Next priority: **P4 — Quiz expansion and persistence**
- Uncommitted work: none
