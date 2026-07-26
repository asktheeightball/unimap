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
- Current working branch: `claude/catalogue-expansion-200-250-ygs28r`
- Previous branch: `claude/unimap-static-app-uj0ql5`, which is configured as the repository default branch. Confirm the intended long-term branch strategy before changing deployment settings or creating automation.

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

Read `PRIORITY.md`. The active task is **P0 — Expand the celestial-body catalogue substantially**, *In progress* and blocked on network access for the bulk import.

The first expansion is committed and pushed: `celestial-bodies.json` holds **84 records**, 64 of them carrying source metadata. The second expansion (target 200–250) is prepared but could not import anything — see the last-session notes below.

Correction: an earlier version of this file stated that "the current JSON appears smaller than the original supplied prototype dataset." That was an assumption and it is false. No prototype dataset exists in this repository — the full history contains only 12 files and never included one. The original 20 records were authored in commit `c55b9bb`. There is nothing to reconcile or restore.

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

### Last session — second catalogue expansion (2026-07-26)

- Branch: `claude/catalogue-expansion-200-250-ygs28r`
- Starting commit: `10998fa` (working tree clean, in sync with origin)
- Task selected: P0 — second catalogue expansion, target 200–250 records
- Status: **In progress / blocked.** Preparation complete; no record imported.

**Baseline verified.** 84 records, all ids unique, catalogue valid with 0
warnings, 64/84 carrying source metadata. Counts: Exoplanet 60, Dwarf Planet 4,
Galaxy 4, Planet 4, Star 4, Black Hole 3, Nebula 3, Neutron Star 2. The 84-record
promotion is committed and pushed. 58/58 browser checks passed against it.

**Blocked on the same network policy as the first expansion.** Every astronomy
host is still refused at the proxy CONNECT stage, and so are the mirrors tried
this session (`simbad.u-strasbg.fr`, `cdsarc.cds.unistra.fr`,
`ned.ipac.caltech.edu`, `ssd.jpl.nasa.gov`). The SIMBAD probe, the Ceres probe,
and the star, deep-sky and moon imports all need a real response and could not be
run. Nothing was authored from recall (D7), so the catalogue is unchanged.

**Done anyway, none of it network-dependent:**

- Seven new source definitions in `tools/sources.json` with curated object lists —
  68 notable stars, 28 galaxies, 28 nebulae, 15 pulsars, 14 black-hole
  candidates, 21 moons, and Ceres as its own object-specific JPL source.
- `{identifiers}` query substitution, so a curated source asks a service only for
  the objects it wants. ADQL apostrophe escaping included (`Barnard's star`).
- Probe-before-import gate (D8): an `"unprobed": true` source can only be probed,
  never imported. `--probe` now runs before the normalizer is resolved, so a
  source may carry `"normalizer": null` until it has been seen.
- `Moon`, `Pulsar` and `Star Cluster` registered in `CATEGORY_TYPES` and
  `KNOWN_TYPES` (D9). Pulsars are reached through the `Neutron Stars` filter.
- `tools/README.md` documenting the pipeline, the probe rule, curation
  mechanisms, TLS handling, per-source limitations and distance semantics.

**Validation:** 58/58 browser checks on the production 84-record catalogue;
64/64 on a throwaway 250-record fixture exercising the three new categories,
absent optional fields, and every filter. Load 41 ms at 250 records, mean
re-render 0.15 ms, no horizontal overflow at 320 px, no console errors. Offline
tests of URL building, identifier quoting and the unprobed guard.

**Known gaps carried forward:**

1. **Alias search does not exist.** `matchesQuery` searches `name` only, so the
   aliases on 64 records are unsearchable. It is queued as P5 and was left there
   rather than pulled forward into this slice.
2. **Deep-sky distance is unsolved.** SIMBAD's `basic` table has no distance
   column and galaxies have no useful parallax. The field, units and semantics
   must be read off a real probe before galaxies or nebulae can be imported.
3. **Black holes may not be importable as a category** — SIMBAD types them by
   what is observed, not as black holes. Do not force the category.
4. **Moons may not have a usable distance** in the physical-parameters endpoint.
5. Descriptions/summaries were not added. The schema already supports `summary`;
   no trustworthy automated source for them exists yet.

- Files changed: `tools/sources.json`, `tools/import_catalogue.py`,
  `tools/validate_catalogue.py`, `tools/README.md` (new), `app.js`, `index.html`,
  `PRIORITY.md`, `DECISIONS.md`, `HANDOFF.md`, `ROADMAP.md`, `README.md`
- Catalogue changed: **no.** `celestial-bodies.json` is untouched.
- Deployment performed: none
- Next priority: unblock the imports (probe commands in `tools/README.md`), finish
  P0, then start P1 quiz mode

### Earlier session — import pipeline

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

### Catalogue state (2026-07-26, after the first expansion)

| Type | Records | Target for the 200–250 slice |
|---|---:|---|
| Exoplanet | 60 | keep 60 |
| Dwarf Planet | 4 | 5 (add Ceres) |
| Galaxy | 4 | 20–30 |
| Planet | 4 | 4 |
| Star | 4 | 40–60 |
| Black Hole | 3 | 10–15 |
| Nebula | 3 | 20–30 |
| Neutron Star | 2 | 10–15 with pulsars |
| Moon | 0 | 15–25 if source-ready |
| Star Cluster | 0 | optional |
| **Total** | **84** | **200–250** |

Records carrying source metadata: 64 of 84. The 20 original records predate D7
and have no provenance; adding it is part of finishing P0.

## Known cautions

- The dataset values are educational source data and have not been comprehensively validated for scientific accuracy.
- `size` and `circumference` are not semantically consistent across all celestial-body types.
- Do not silently correct or normalize source values during unrelated work.
- Do not introduce dependencies for functionality that can be implemented clearly in a few lines of native browser code.
