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
- `app.js` loads data, manages state, filters results, renders browse/detail views, and switches between Browse and Quiz.
- `quiz.js` implements quiz mode: question generation, timing, scoring and leaderboards.
- The detail view renders a description, preferring hand-written `summary` over generated `sourceSummary`.
- `celestial-bodies.json` contains the catalogue (208 records).
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
- a visible data-load error;
- quiz mode with four timed difficulties and per-difficulty local leaderboards.

## Current priority

Read `PRIORITY.md`. **P0 (catalogue expansion) and P1 (quiz mode) are complete. P2 (descriptions) is partially complete** — sourced descriptions ship, the notability half is blocked on source data.

`celestial-bodies.json` holds **208 records**: 197 carry source metadata, 197 carry a generated `sourceSummary`, 192 carry coordinates, and none carries a hand-written `summary` yet. Quiz mode ships in `quiz.js`.

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

### Last session — object descriptions (2026-07-26)

- Branch: `claude/catalogue-expansion-200-250-ygs28r`
- Starting commit: `c68ae74`
- Commits: `2ee5395` detail-view rendering, `a4fdc7e` description promotion,
  plus the documentation commit
- Status: **P2 partially complete.**

**Descriptions ship on 197 of 208 records.** Every one is assembled from values
its source actually returned (D12). Examples:

> Ceres orbits the Sun at a mean distance of 2.77 AU. Its measured diameter is
> 939 km. NASA/JPL's Small-Body Database records its orbit class as Main-belt
> Asteroid. Discovered 1801-01-01 by Piazzi, G. at Palermo.

> 51 Peg is classified by SIMBAD as a high proper-motion star of spectral type
> G2IV. Its measured parallax of 64.4048 mas puts it about 50.6 light years from
> Earth. It lies at right ascension 344.36659°, declination 20.76883° (J2000).

**Two description fields, never merged.** `summary` is hand-written and no
importer touches it; `sourceSummary` is importer-owned and refreshed on a rerun.
The detail view prefers `summary`. A record with neither renders no paragraph.

**"Why it is notable" is not implemented and was not faked.** No cached response
carries anything supporting it. It needs a new authoritative source or
hand-written `summary` text; the schema and rendering are ready for the latter
today.

**Re-import was cache-only.** All seven confirmed sources were re-run and every
request was a cache hit — no network call. The blocked black-hole and moon
sources were not touched.

**Nothing but descriptions changed.** A field-level diff of all 208 records
before and after promotion reports zero changes to id, name, type, aliases,
coordinates, measurements, distance or size. Record count, ids and category
balance are identical. Promotion reported +0 new, 2 refused — the two pulsars
whose ids collide with curated Neutron Star records.

**11 records have no description**, all hand-authored originals with no
provenance: `cygnus-x-1`, `m87-star`, `sagittarius-a-star`, `milky-way`,
`psr-b1919-21`, `psr-j0348-0432`, `earth`, `jupiter`, `kepler-452b`, `mars`,
`sol`. They are the first candidates for hand-written `summary`.

**One defect found and fixed during verification:** the classification sentence
read "a active galaxy nucleus". `article()` now handles vowel-initial glosses
and "HII region".

**Validation:** catalogue valid with 0 warnings; 61/61 browse checks; 52/52 quiz
checks; 34/34 quiz requirements; description rendering verified for hand-written,
generated and absent cases, and across exoplanet, star, galaxy and dwarf-planet
records; 0px overflow at 320px; no console errors.

- Files changed: `celestial-bodies.json`, `app.js`, `index.html`, `styles.css`,
  `tools/import_catalogue.py`, `tools/promote_staging.py`,
  `tools/validate_catalogue.py`, `tools/README.md`, and root documentation
- Next priority: finish P2 — decide between a new descriptive source and
  hand-written `summary` text for notability

### Last session — expansion promoted, quiz mode shipped (2026-07-26)

- Branch: `claude/catalogue-expansion-200-250-ygs28r`
- Starting commit: `dd6124c`
- Commits: `09aebb1` (catalogue promotion), plus the quiz-mode commit
- Status: **P0 complete, P1 complete.**

**All seven probes were run on a networked machine and the cache returned.** The
sandbox itself still has no access to any astronomy host; every normalizer in
this session was written against `tools/cache/*.json`, not against a live call.

**Catalogue: 84 -> 208 records.** Star 68, Exoplanet 60, Galaxy 28, Nebula 17,
Pulsar 12, Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3,
Neutron Star 2. Dry run reported +124 new, 9 refreshed, 2 refused.

Three findings from the real responses changed the design, all resolved by
narrowing rather than assuming (D10):

1. **The SIMBAD deep-sky queries return no distance column.** `distance` is now
   optional; 60 records legitimately have none. The result row shows the type
   alone and the detail row hides.
2. **Classification comes from `otype_txt`, not from the curated list.** Nine
   requested "nebulae" are typed `OpC`/`Cl*` and were imported as Star Clusters.
3. **`simbad-black-holes` is blocked, not imported.** None of its 13 rows is
   typed as a black hole (9 `HXB`, plus `BLL`, `AGN`, `Sy2`, `X`). Black holes
   remain the 3 original hand-authored records.

**Ceres** was staged from its own object endpoint (`sbdb.api`, nested response,
`response: "object"`), using `orbit.elements` `a`=2.77 au and `phys_par`
`diameter`=939.4 km with units read from the response. JPL's orbit class
"Main-belt Asteroid" is preserved as an alias.

**Moons deferred:** `sat_phys_par.api` returned HTTP 404.

**Rejected during curation:** Centaurus A (`BLL`), NGC 6960 (`ISM`), NGC 6992
(`sh`), one duplicate `alf Cen A` row, and two pulsars whose ids collide with
curated Neutron Star records (promotion correctly refuses to retype them).

**Quiz mode** (`quiz.js`, D11): four difficulties (15/10/7/5s), 10 questions,
four choices, 100-to-0 continuous scoring, per-difficulty top-10 `localStorage`
leaderboards, keyboard and touch input, no network calls during gameplay. Five
question kinds; the generator refuses ambiguous pairings (pulsar/neutron star,
planet/exoplanet) and compares values only within one type.

**Validation:** 61/61 browse checks, 52/52 quiz checks, an audit of 400
generated questions across 40 games with 0 ambiguity or duplicate-option
problems, catalogue valid with 0 warnings, all ids and names unique, no
duplicate aliases, 44 ms load at 208 records, no console errors, no horizontal
overflow at 320 px.

**Known gaps:** black holes, moons, alias search (P5), nebulae at 17 vs the
20-30 target, no `summary` on any record yet (that is P2), and unverified
`attribution`/`terms` strings.

- Files changed: `celestial-bodies.json`, `quiz.js` (new), `app.js`,
  `index.html`, `styles.css`, `tools/sources.json`,
  `tools/import_catalogue.py`, `tools/validate_catalogue.py`, `tools/README.md`,
  and all root documentation
- Next priority: **P2 — educational object descriptions**

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

### Catalogue state (2026-07-26, after the second expansion)

| Type | Records | Target for the 200–250 slice |
|---|---:|---|
| Star | 68 | 40–60 (over) |
| Exoplanet | 60 | keep 60 ✓ |
| Galaxy | 28 | 20–30 ✓ |
| Nebula | 17 | 20–30 (under) |
| Pulsar | 12 | 10–15 with neutron stars ✓ |
| Star Cluster | 9 | optional ✓ |
| Dwarf Planet | 5 | 5 including Ceres ✓ |
| Planet | 4 | 4 ✓ |
| Black Hole | 3 | 10–15 (blocked) |
| Neutron Star | 2 | counted with pulsars |
| Moon | 0 | 15–25 (deferred, endpoint 404) |
| **Total** | **208** | **200–250** ✓ |

197 of 208 records carry source metadata and 192 carry coordinates. The 11
without provenance are the surviving hand-authored originals, which predate D7.
60 records legitimately carry no distance — SIMBAD supplies none for deep-sky
objects (D10).

## Known cautions

- The dataset values are educational source data and have not been comprehensively validated for scientific accuracy.
- `size` and `circumference` are not semantically consistent across all celestial-body types.
- Do not silently correct or normalize source values during unrelated work.
- Do not introduce dependencies for functionality that can be implemented clearly in a few lines of native browser code.
