# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P2 — Add educational object descriptions

Status: **Partially complete.** Sourced descriptions ship on 197 of 208 records;
the notability half is blocked on source data.

**Done.** Every imported record carries a `sourceSummary` assembled from values
its source actually returned (D12), and the detail view renders it. Between
them the descriptions answer three of the roadmap's four questions:

| Question | Status |
|---|---|
| What is it | Yes — type, classification gloss, spectral type, orbit class |
| Where is it | Yes — distance where published, J2000 coordinates |
| How was it discovered | Exoplanets and Ceres only |
| Why is it notable | **No — not present in any source** |

**Remaining work, in priority order:**

1. **"Why it is notable" needs a source or an author.** No cached response
   carries anything supporting it and it will not be written from recall (D7).
   Two routes: probe an authoritative descriptive source, or hand-write
   `summary` text for a curated subset. The schema and rendering are ready for
   hand-written text today — `summary` is preferred over `sourceSummary` and is
   never touched by an importer.
2. **11 records have no description at all**, all hand-authored originals with
   no provenance: `cygnus-x-1`, `m87-star`, `sagittarius-a-star`, `milky-way`,
   `psr-b1919-21`, `psr-j0348-0432`, `earth`, `jupiter`, `kepler-452b`, `mars`,
   `sol`. These are the natural first candidates for hand-written `summary`.
3. **Discovery data is missing for SIMBAD objects.** Only the exoplanet archive
   and the JPL single-object endpoint return it. A SIMBAD equivalent has not been
   identified.
4. **Most stars display Bayer designations** (`alf CMa`, not Sirius) because
   translating a designation into a common name would be fabrication. A sourced
   name mapping would fix this and is a natural fit here.

**Also outstanding, carried from P0:**

5. **Black holes cannot be imported.** `simbad-black-holes` is blocked: none of
   its 13 rows is typed as a black hole. Needs an authoritative catalogue of
   dynamically confirmed masses.
6. **Moons are deferred.** `sat_phys_par.api` returned HTTP 404. A replacement
   must be probed, and must settle the parent-planet distance semantic first.
7. **Alias search does not exist**, so aliases on 189 records are unsearchable.
   Queued as P5.
8. **Nebulae came in at 17**, below the 20-30 target, because nine requested
   objects are clusters.
9. **`attribution` and `terms` strings remain unverified** against each service's
   current terms page.

## Completed

### P0 — Expand the celestial-body catalogue substantially

Status: **Complete** (2026-07-26)

The catalogue went 20 -> 84 -> **208 records** across two expansions, every
imported record carrying provenance. All seven configured sources were probed
against the live services and their normalizers written from the cached
responses.

Final counts: Star 68, Exoplanet 60, Galaxy 28, Nebula 17, Pulsar 12,
Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3, Neutron Star 2.
197 of 208 records carry source metadata and 192 carry coordinates.

Two sources are deliberately blocked rather than imported unsafely, and one
target was missed rather than padded — see P2 above.

### P1 — Build quiz mode

Status: **Complete** (2026-07-26)

Four difficulties (Easy 15s, Medium 10s, Hard 7s, Impossible 5s), 10 questions
per game, four choices with exactly one correct answer, up to 100 points
decreasing continuously to zero across the question's time limit, zero for
incorrect or expired answers, and a separate top-10 `localStorage` leaderboard
per difficulty. Five question kinds are generated from validated fields only,
and the generator refuses anything ambiguous. Gameplay makes no network request.

## Queue

### P3 — Add images for each object

Status: **Not started**

Add a local optimized image or graceful fallback for every object. Record alt text, credit, source URL, usage note, and whether the image is a direct observation, illustration, or simulation. Prefer authoritative reusable sources such as the NASA Image and Video Library.

### P4 — Add a lightweight celestial map

Status: **Not started**

Build a simple two-dimensional map using locally stored right ascension and declination:

- pan, zoom, reset;
- category filters;
- selectable plotted objects;
- detail navigation;
- mouse, touch, and practical keyboard support;
- plain SVG or Canvas without a framework;
- no required live API.

Limit the first map to objects with stable catalogue coordinates. Do not present changing solar-system positions as fixed coordinates.

### P5 — Search and discovery refinements

Status: **Not started**

After the core product expansion:

- search aliases and catalogue identifiers;
- add Random Object;
- restore focus after detail navigation;
- add alphabetical sorting;
- improve empty-query guidance for the larger catalogue.

### P6 — Lightweight validation automation

Status: **Not started**

Add small validation for IDs, fields, aliases, sources, coordinates, images, related IDs, quiz eligibility, and answer-set integrity without adding application runtime dependencies.

## Selection rules

When asked to start the next feature or task:

1. Read `PRODUCT.md`, `PRIORITY.md`, `ROADMAP.md`, `HANDOFF.md`, `DECISIONS.md`, `DEPLOYMENT.md`, and `CLAUDE.md`.
2. Inspect the repository and verify the documentation against the code.
3. Select the highest-ranked item whose status is `Not started` or `In progress`.
4. Do not skip a higher priority because a lower item is easier.
5. If the current priority is blocked, document the blocker and select the next unblocked item.
6. Keep each implementation slice small enough to validate completely.
7. Do not make the static application depend on a third-party API unless a later documented architecture decision explicitly permits it.
8. Do not create a new priority merely because an idea appears in the roadmap.

## Status values

Use only:

- **Not started**
- **In progress**
- **Blocked**
- **Complete**
- **Paused**

## Completion protocol

Before marking an item complete:

- validate the relevant behavior;
- report files changed;
- record commands and checks performed;
- update roadmap status where applicable;
- update `HANDOFF.md`;
- identify the next priority;
- commit with a focused message when explicitly authorized.
