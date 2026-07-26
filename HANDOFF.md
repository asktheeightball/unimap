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

Read `PRIORITY.md`. The active task is **P0 — Expand the celestial-body catalogue substantially**, now *In progress* and blocked on network access for the bulk import.

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

- Date: 2026-07-26
- Branch: `claude/unimap-static-app-uj0ql5`
- Starting commit: `a3f6036`
- Ending commit: uncommitted at time of writing
- Task selected: P0 — Expand the celestial-body catalogue substantially
- Status: **In progress / blocked.** Reconciliation closed, import and validation pipeline built and tested, bulk import blocked on sandbox network policy.
- Files changed: `tools/sources.json`, `tools/import_catalogue.py`, `tools/promote_staging.py`, `tools/validate_catalogue.py`, `.gitignore` (all new), `app.js`, `index.html`, `styles.css`, `PRIORITY.md`, `DECISIONS.md`, `HANDOFF.md`, `ROADMAP.md`, `README.md`
- Validation performed: 46 importer unit checks (response shapes, normalizers, URL/cache); 9 pipeline safety checks against a local fixture server (staging, promotion, idempotency, invalid-data refusal, cross-source collision refusal, cache, unreachable source); 11-case validator negative test; 64/64 baseline browser checks; 19/19 category-growth checks; 24/24 checks against a promoted 27-record catalogue. 162 checks, 0 failures.
- Deployment performed: none
- Known issues: catalogue is still at its 20-record baseline. See the external network limitation below.
- Next priority: run the import locally (commands in `README.md`), return the outputs, then finish P0
- Uncommitted files: none — tooling and documentation committed; catalogue unchanged

### External network limitation (2026-07-26)

The environment this work was done in denies outbound access to every astronomy
service. Each returns HTTP 403 at the proxy CONNECT stage:

| Host | Purpose |
|---|---|
| `exoplanetarchive.ipac.caltech.edu` | NASA Exoplanet Archive TAP |
| `simbad.cds.unistra.fr` | SIMBAD TAP |
| `vizier.cds.unistra.fr` | VizieR |
| `ssd-api.jpl.nasa.gov` | JPL Small-Body Database |
| `images-api.nasa.gov` | NASA Image and Video Library |
| `api.nasa.gov` | NASA APIs generally |

Consequences to carry into the next session:

1. **No record was imported.** The catalogue is unchanged at 20 records.
2. **The HTTP path of the importer is the one untested part.** Everything after
   the response — parsing, normalizing, staging, validating, promoting — is
   tested against fixtures in all three response shapes these services use.
3. ~~The normalizers are unconfirmed.~~ **Resolved 2026-07-26** by probe output
   returned from a networked machine. Findings:
   - **NASA Exoplanet Archive** — confirmed working. Array of objects, all nine
     columns as expected, 6,248 rows available. No change needed.
   - **NASA/JPL SBDB** — confirmed shape, but revealed a **data-correctness
     bug**: `sb-class=TNO` returns every trans-Neptunian object, most of them
     small bodies, and the normalizer would have labelled all of them
     `Dwarf Planet`. Fixed with the `select_names` curation filter. Also
     confirmed that `H`/`a` arrive as strings, `diameter` is frequently null,
     and `full_name` carries a leading space and a parenthetical designation —
     all now handled and tested.
   - **SIMBAD** — not yet reached. The request failed with
     `CERTIFICATE_VERIFY_FAILED`, a local trust-store problem on the operator's
     machine rather than a fault in the query. `--ca-bundle` was added so
     verification stays on. **SIMBAD's response shape remains unconfirmed.**
4. **The `attribution` and `terms` strings in `tools/sources.json` are
   unverified** and must be checked against each service's current terms page
   before a catalogue built from them is published.

### Catalogue baseline (2026-07-26)

| Type | Records |
|---|---:|
| Galaxy | 4 |
| Planet | 4 |
| Star | 4 |
| Black Hole | 3 |
| Nebula | 3 |
| Neutron Star | 2 |
| **Total** | **20** |

Records carrying source metadata: 0 of 20. The baseline predates D7 and has no provenance; adding it is part of finishing P0.

## Known cautions

- The dataset values are educational source data and have not been comprehensively validated for scientific accuracy.
- `size` and `circumference` are not semantically consistent across all celestial-body types.
- Do not silently correct or normalize source values during unrelated work.
- Do not introduce dependencies for functionality that can be implemented clearly in a few lines of native browser code.
