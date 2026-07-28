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
- Current working branch: `claude/catalogue-expansion-200-250-ygs28r`
- Repository default branch remains `claude/unimap-static-app-uj0ql5`
- Do not change branch strategy or deployment automation without first reconciling the default branch with the active branch

## Current implementation

- `index.html` contains the semantic page structure and Browse/Quiz navigation.
- `styles.css` contains responsive presentation.
- `app.js` loads the catalogue, manages browse state, filters results, renders details, and switches modes.
- `quiz.js` implements question generation, timing, scoring, and local leaderboards.
- `celestial-bodies.json` contains **208 records**.
- The detail view prefers hand-written `summary` over importer-generated `sourceSummary`.
- 197 records carry source metadata and generated descriptions; 192 carry coordinates.
- Project-control documents define product scope, priorities, roadmap, decisions, deployment, and contributor instructions.

## Current functional behavior

The application currently provides:

- case-insensitive partial-name search;
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

### Current: P3 — Search intelligence and autocomplete

Implement next:

- fuzzy matching and explicit spelling corrections;
- search across names, aliases, and catalogue identifiers;
- Google-style autocomplete suggestions;
- touch, mouse, keyboard, and screen-reader operation;
- remove the footer as part of this interface slice.

### Next: P4 — Quiz expansion and persistence

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

- Search currently checks names only; aliases and identifiers are not searchable.
- There is no fuzzy correction or autocomplete yet.
- The quiz has four modes; Effortless is not implemented.
- Existing leaderboards persist only in `localStorage` on the same browser/device.
- Discovery data is not available for every object.
- Why an object is notable is not available from current imported source responses for most records.
- Black-hole expansion remains blocked on a defensible authoritative classification source.
- The previously configured moon endpoint returned HTTP 404 and must not be reused without correction.
- The footer still exists and is queued for removal in P3.

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

## Latest documentation session

- Date: 2026-07-27
- Branch: `claude/catalogue-expansion-200-250-ygs28r`
- Task: record and prioritize the newly requested search, quiz, catalogue, hierarchy, map, image, and cleanup features
- Code changed: none
- Catalogue changed: none; remains 208 records
- New current priority: P3 — Search intelligence and autocomplete
- Documentation updated: `PRIORITY.md`, `ROADMAP.md`, `PRODUCT.md`, `HANDOFF.md`
- Next implementation slice: fuzzy search, correction suggestions, autocomplete, alias/identifier search, and footer removal
