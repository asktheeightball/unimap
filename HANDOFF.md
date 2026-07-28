# UniMap Handoff

Update this file at the end of every meaningful work session. It should describe the repository as it actually exists, not merely the intended state.

## Project summary

UniMap is a dependency-free static astronomy catalogue.

Technology:

- HTML
- CSS
- Vanilla JavaScript
- JSON

There is no framework, package manager, build command, backend, database, or authentication.

## Repository

- GitHub: `asktheeightball/unimap`
- Current documented working branch: `claude/unimap-static-app-uj0ql5`
- Important: this branch is currently configured as the repository default branch. Confirm the intended long-term branch strategy before changing deployment settings or creating automation.

## Current implementation

- `index.html` contains the semantic page structure.
- `styles.css` contains presentation and responsive styling.
- `app.js` loads data, manages state, filters results, and renders browse/detail views.
- `celestial-bodies.json` contains the catalogue.
- `README.md` explains local running and basic static deployment.
- Project-control documents define product scope, priorities, roadmap, decisions, deployment, and contributor instructions.

## Current functional behavior

The existing application is documented to provide:

- case-insensitive partial-name search;
- category filters;
- result counts and a no-results state;
- Clear Search;
- keyboard-accessible results;
- detail view and Back navigation;
- preserved query/category/results when returning;
- responsive phone, tablet, and desktop layout;
- a visible data-load error.

## Current priority

Read `PRIORITY.md`. **P0 and P1 are complete** as of 2026-07-28; the active task is
now **P2 — Add educational object descriptions**.

Correction: an earlier version of this file stated that "the current JSON appears smaller than the original supplied prototype dataset." That was an assumption and it is false. No prototype dataset exists in this repository — the full history contains only 12 files and never included one. The 20 records in `celestial-bodies.json` were authored in commit `c55b9bb` and are the baseline. There is nothing to reconcile or restore.

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
6. Inspect the actual implementation before trusting status claims.
7. Start the highest-ranked item in `PRIORITY.md`.
8. Keep the static, dependency-free architecture unless an approved decision says otherwise.

## End-of-session update template

Replace or append this section after meaningful work:

### Last session

- Date: 2026-07-28 (second session)
- Branch: `claude/unimap-static-app-uj0ql5`
- Starting commit: `4036368`
- Ending commit: uncommitted at time of writing
- Task selected: P1 — Build quiz mode
- Status: **Complete.**
- Files changed: `quiz.js` (new), `index.html`, `styles.css`, `PRIORITY.md`, `ROADMAP.md`, `DECISIONS.md`, `README.md`, `HANDOFF.md`
- `app.js` and `celestial-bodies.json` were deliberately not touched.
- Deployment performed: none
- Next priority: **P2 — Add educational object descriptions**
- Uncommitted files: all of the above — nothing committed or pushed (not authorized)

Quiz mode is four timed modes (15/10/7/5 seconds) of ten questions, generated from
six families over stored catalogue fields, with per-mode `localStorage`
leaderboards. Recorded as D9 (why `quiz.js` is a separate file) and D10 (how
questions are generated and kept unambiguous).

**One bug found and fixed during validation.** The countdown was first written on
`requestAnimationFrame`, which stops entirely when the page is not compositing — a
background tab or a hidden window. Scoring stayed correct because it reads
`performance.now()`, but the displayed points froze at 100 while real time ran out,
and a question would not expire until the tab was looked at again. The timer now
runs on a 50 ms interval, which a background tab throttles but does not stop.
Elapsed time still comes from `performance.now()`, never from counting ticks, so a
delayed interval cannot inflate a score.

**Opportunity for P2/R3, found while auditing.** `tools/import_catalogue.py`
already requests `disc_year` and `discoverymethod` from the NASA Exoplanet Archive
and then discards both. Storing them would enable discovery-based questions — "How
was this planet found?" — for 60 records with no new source and no new API call.
That is better quiz material than the parallax questions the catalogue supports
today.

### Question-family eligibility (2026-07-28)

| Family | Requires | Eligible |
|---|---|---:|
| `object-type` | `name`, `type` | 129 |
| `which-is-type` | `name`, `type` | 129 |
| `distance-order` | Earth-referenced `distance` | 123 |
| `distance-value` | Earth-referenced `distance` | 123 |
| `designation` | catalogue-designation alias | 49 |
| `measurement` | `measurementLabel` + `measurementValue` | 105 |

All 129 records can serve as a question subject. The four dwarf planets are
excluded from both distance families because their `distance` is a mean orbital
distance from the Sun, not a distance from Earth, and from `measurement` because
their semi-major axes sit too close together to separate.

### Previous session

- Date: 2026-07-28 (first session)
- Starting commit: `10998fa`
- Ending commit: uncommitted at time of writing
- Task selected: P0 — Expand the celestial-body catalogue substantially
- Status: **Complete.** SIMBAD star import run and promoted; source terms verified; P0 closed.
- Files changed: `celestial-bodies.json`, `tools/sources.json`, `tools/import_catalogue.py`, `PRIORITY.md`, `ROADMAP.md`, `DECISIONS.md`, `README.md`, `HANDOFF.md`
- Deployment performed: none
- Next priority: **P1 — Build quiz mode**
- Uncommitted files: all of the above — nothing committed or pushed (not authorized)

What happened this session:

1. **Reconciled the documentation against commit `10998fa`.** The handoff, priority
   and roadmap documents all claimed the catalogue was at its 20-record baseline and
   that expansion was blocked. `10998fa` had already promoted 64 sourced records; it
   changed data only and updated no documentation. Verified state was 84 records.
2. **Found the network blocker was environment-specific, not real.** All three
   sources respond normally from this machine. SIMBAD needed only the already-
   documented `--ca-bundle` flag, which resolved the last unconfirmed normalizer.
3. **Verified the source terms** that `sources.json` flagged as unchecked. The
   Exoplanet Archive and SIMBAD acknowledgement strings were correct (SIMBAD's also
   wants the Wenger et al. 2000 citation, now added). JPL's prescribed citation
   differed and was corrected. JPL's Fair Use Policy forbids embedding its API in a
   website — UniMap complies by design under D6.
4. **Fixed the SIMBAD query before running it.** As configured it would have imported
   Gaia/UCAC4/2MASS designations. Now joins `ident` for proper-named stars. See D8.
5. **Imported and promoted 45 stars**, taking the catalogue to 129 records.

### Catalogue (2026-07-28)

| Type | Records | Sourced |
|---|---:|---|
| Exoplanet | 60 | 60 — NASA Exoplanet Archive |
| Star | 49 | 45 — SIMBAD (4 baseline unsourced) |
| Dwarf Planet | 4 | 4 — NASA/JPL SBDB |
| Galaxy | 4 | 0 |
| Planet | 4 | 0 |
| Black Hole | 3 | 0 |
| Nebula | 3 | 0 |
| Neutron Star | 2 | 0 |
| **Total** | **129** | **109 of 129** |

The 20 baseline records predate D7 and carry no provenance. They cannot be given
attribution retroactively without refetching each value from a real source, so that
work belongs to P2 (sourced object profiles), not to P0.

### Quiz validation performed (2026-07-28)

Served with `py -m http.server 8000`; never tested through `file://`.

| Check | Result |
|---|---|
| 7,000 generated questions: 4 options, exactly 1 correct, no duplicate labels | pass |
| 4,000 questions re-verified against source records for semantic correctness | pass |
| All 6 families exercised | pass |
| Distractor separation (2× distance, 1.25× order and measurement) | pass |
| No orbital-distance record in an Earth-distance question | pass |
| No measurement question mixing units | pass |
| Mode timers: Easy 15s, Medium 10s, Hard 7s, Impossible 5s | pass |
| Scoring formula, clamping, and zero-total guard | pass |
| Points decay monotonically and track real elapsed time | pass |
| No zero-point render flash — 100 painted before first tick | pass |
| Correct answer scores remaining points (±3 of displayed) | pass |
| Incorrect answer scores 0 | pass |
| Timeout at ~5s scores 0, reveals answer, no wrong-marker | pass |
| Points freeze after answering | pass |
| Explanation shown on correct, wrong and expired | pass |
| Next-question flow, final-question label, final score | pass |
| Keyboard: number keys 1–4 answer, Enter advances | pass |
| Leaderboards separate by mode, sorted, capped at 10 | pass |
| Persistence across a real page reload | pass |
| 11 malformed-storage payloads — never throws, always clean boards | pass |
| Blocked `localStorage` — still playable, warns score unsaved | pass |
| Mobile 375×812: no overflow, ≥44px answer and mode targets, 16px input | pass |
| Desktop 1280×800: no overflow | pass |
| Catalogue regression: 9 filters, search, no-results, clear, detail, Back | pass |
| Browse state survives a round trip through the quiz | pass |
| Leaving mid-question stops the timer | pass |
| Console errors | none |

162 quiz and regression checks this session, 0 failures.

### Catalogue validation performed (2026-07-28, first session)

Served with `py -m http.server 8000`; never tested through `file://`.

| Check | Result |
|---|---|
| `tools/validate_catalogue.py` | 129 records, 0 errors, 0 warnings |
| Console errors | none |
| Category filters (all 9) | exact expected counts, `aria-pressed` correct |
| Search: exact, partial, case-insensitive, whitespace-trimmed | pass |
| No-results state and message | pass |
| Clear Search resets query, category and focus | pass |
| Detail view: legacy, exoplanet, dwarf planet, SIMBAD star | pass |
| D6a hidden rows for absent size/circumference | pass |
| Back preserves query, results and focus | pass |
| Keyboard focus and native buttons | pass |
| Celeno/Celaeno dedupe (one record, not two) | pass |
| Mobile 375×812: no overflow, ≥40px targets, 16px input | pass |
| Desktop 1280×800: no overflow, content constrained | pass |
| Search + render at 129 records | 0.02 ms average |
| Data-load failure shows visible `role="alert"` error | pass |

40 browser checks this session, 0 failures, plus the validator.

## Known cautions

- The dataset values are educational source data and have not been comprehensively validated for scientific accuracy.
- `size` and `circumference` are not semantically consistent across all celestial-body types.
- Do not silently correct or normalize source values during unrelated work.
- Do not introduce dependencies for functionality that can be implemented clearly in a few lines of native browser code.
