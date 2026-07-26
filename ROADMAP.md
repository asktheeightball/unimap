# UniMap Roadmap

This roadmap describes outcomes, not deadlines. `PRIORITY.md` determines what should be worked on next.

## Product guardrail

UniMap should remain lightweight even as its catalogue and game modes grow:

- Static HTML, CSS, vanilla JavaScript, and JSON by default
- No frontend framework, package manager, or build step unless a documented need clearly justifies one
- Prefer local curated data over live API calls at page-view time
- External astronomy APIs may be used for research or controlled data-import workflows
- New fields must be optional and must not break older records
- Keep each feature independently testable and mobile-friendly

## Completed foundation

### R0 — Static application baseline

Status: **Complete**

- Static HTML, CSS, vanilla JavaScript, and JSON
- Responsive layout
- Accessible search and category controls
- Result count and no-results state
- Detail view with preserved browse state
- Clear load-error handling
- Basic local-run and deployment instructions

## Completed features

### R1 — Major catalogue expansion

Status: **Complete** (2026-07-26)

Goal: expand UniMap from a small demonstration catalogue into a much broader curated collection of celestial bodies.

**Result.** The catalogue holds **208 records**, grown
from a 20-record baseline through two reviewed expansions. All seven configured
sources were probed against the live services and every normalizer is written
from a cached real response.

Final counts: Star 68, Exoplanet 60, Galaxy 28, Nebula 17, Pulsar 12,
Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3, Neutron Star 2.
197 of 208 carry provenance, 192 carry coordinates.

Two findings from the real responses shaped the result, and both were resolved by
narrowing scope rather than by assuming values (see D10):

- The SIMBAD deep-sky queries carry **no distance column**, so `distance` became
  optional and 60 records have none.
- Classification comes from SIMBAD's `otype_txt`, not from the curated list. Nine
  requested "nebulae" are typed as clusters and were imported as Star Clusters,
  and `simbad-black-holes` is blocked outright because none of its rows is typed
  as a black hole.

Still open, carried into R3 and R5: black holes, moons, alias search, nebula
count, and unverified terms strings. See `PRIORITY.md`.

#### Source strategy

Research and test authoritative sources for controlled import into local JSON:

- **SIMBAD and VizieR** for stars, galaxies, nebulae, clusters, and other non-solar-system objects
- **NASA Exoplanet Archive TAP** for confirmed exoplanets and host-system data
- **NASA/JPL Small-Body Database and Horizons** for asteroids, comets, planets, moons, and solar-system data where appropriate
- **NASA Image and Video Library** for candidate imagery and attribution metadata
- **NASA APOD** only as a supplementary image and explanation source, not as the primary object catalogue

SIMBAD must not be treated as a bulk catalogue by itself. Use SIMBAD and VizieR as complementary research sources and preserve source attribution.

Do not make the user-facing static application depend on these services being online. Prefer an import or curation process that writes reviewed records into `celestial-bodies.json`.

#### Required work

- ~~Reconcile and restore the complete original prototype dataset~~ — closed 2026-07-26: no prototype dataset exists in this repository
- Define the target catalogue scope and practical record-count goal
- Add many more objects across all supported categories
- Expand or add categories where useful, including moons, dwarf planets, asteroids, comets, star clusters, and exoplanets
- Define a stable normalized record format
- Preserve source identifiers and aliases
- Validate unique IDs, required fields, categories, and duplicate objects
- Document import provenance and the date each record was reviewed
- Keep the shipped catalogue small enough to load quickly on mobile

#### Exit criteria

- The original dataset migration is reconciled and documented
- A substantially larger reviewed catalogue is available locally
- Every record has a unique stable ID and source metadata
- No live third-party API is required to browse or play the app
- Search and category filtering remain responsive on a mobile device
- The import/update approach is documented and repeatable

### R2 — Quiz mode

Status: **Complete** (2026-07-26)

Goal: turn the catalogue into a fast, replayable educational game.

Implemented in `quiz.js` (see D11). All four timed modes, 10 questions per game,
four choices with exactly one correct answer, continuous 100-to-0 scoring, and a
separate top-10 `localStorage` leaderboard per difficulty. Five question kinds are
generated from validated fields, and the generator discards anything ambiguous.

Two exit criteria are met with a documented narrowing: picture questions are not
generated (no images exist yet — that is R4), and "identify why an object is
notable" is not generated because no record carries a `summary` yet (that is R3).

#### Core game rules

- Each quiz contains questions about celestial bodies in the local catalogue
- Each question has exactly four multiple-choice answers
- One answer is correct
- Each correct answer starts at **100 points**
- Available points decrease continuously or in clear intervals until reaching **0** when time expires
- An unanswered question scores 0
- Incorrect answers score 0
- The scoring implementation must be deterministic and documented

Recommended scoring formula:

```text
score = round(100 × remaining milliseconds ÷ total milliseconds)
```

Clamp the result between 0 and 100.

#### Difficulty modes

| Mode | Time per question | Intended difficulty |
|---|---:|---|
| Easy | 15 seconds | Common objects and direct facts |
| Medium | 10 seconds | Broader catalogue and less obvious facts |
| Hard | 7 seconds | Detailed facts, aliases, locations, and comparisons |
| Impossible | 5 seconds | Full catalogue, obscure facts, and difficult distractors |

#### Question types

Initial question templates should be generated from validated structured data, including:

- Identify an object from its description
- Identify an object type
- Identify which object is at a stated location or distance
- Identify why an object is notable
- Identify an alternate name
- Identify the correct discovery or observation fact
- Identify a pictured object only when image rights and answer quality are reliable

Questions must not be generated from missing, ambiguous, or unverified fields.

#### Answer quality

- Distractors must be plausible but unambiguously wrong
- Do not place duplicate aliases for the same object among the four choices
- Avoid questions whose answer depends on inconsistent units or uncertain measurements
- Prevent immediate repetition within a game where practical
- Display the correct answer and a short explanation after each question

#### Leaderboards

Provide a separate leaderboard for each difficulty mode.

Lightweight first implementation:

- Store leaderboard entries in `localStorage`
- Keep separate rankings for Easy, Medium, Hard, and Impossible
- Record player name, score, date, and question count
- Limit each mode to a sensible number of top entries
- Allow the local leaderboard to be cleared deliberately

A shared online/global leaderboard would require a hosted write service, anti-cheat controls, and privacy decisions. Treat that as a later infrastructure decision rather than silently adding a backend.

#### Exit criteria

- All four modes work with the required timers
- Every question shows four choices and exactly one valid answer
- Scoring begins at 100 and reaches 0 at expiration
- Mode-specific local leaderboards persist across browser sessions
- Keyboard and touch input both work
- Quiz questions are generated only from validated catalogue fields
- A full quiz can be completed without console errors or blocked navigation

## Active roadmap

### R3 — Educational object profiles

Status: **Partially complete** (2026-07-26)

Goal: make every celestial-object page useful for learning, not merely a list of measurements.

**Done.** 197 of 208 records carry a `sourceSummary` assembled from values their
source actually returned (D12), rendered in the detail view above the measurement
list. Three of the four questions are answered:

| Question | Status |
|---|---|
| What is it | Yes — type, SIMBAD classification gloss, spectral type, JPL orbit class |
| Where is it | Yes — distance where published, J2000 coordinates |
| How was it discovered | Exoplanets (year and method) and Ceres (discoverer, date, site) |
| Why is it notable | **No** |

**Blocked: "why it is notable".** Nothing in any cached response supports it, and
it will not be written from recall (D7). It needs either a new authoritative
descriptive source or hand-written `summary` text. The schema and rendering are
already ready — `summary` is preferred over `sourceSummary` and no importer ever
touches it — so authoring can start whenever a decision is made.

The 11 records with no description are the hand-authored originals that have no
provenance to generate one from, and are the natural first candidates for
hand-written text.

### R4 — Images for objects

Goal: provide a useful, properly attributed visual for as many catalogue objects as practical.

#### Image strategy

- Prefer NASA, ESA, observatory, or other clearly reusable authoritative imagery
- Use the NASA Image and Video Library as a primary discovery source where relevant
- Store selected images locally rather than relying on third-party URLs during page views
- Record source, credit, license or usage note, and original URL
- Use optimized WebP or similarly efficient formats
- Lazy-load images
- Provide descriptive alt text
- Use a consistent fallback visual where no appropriate real image exists
- Clearly distinguish real observations from artist illustrations or simulations

Not every star or exoplanet has a direct resolved image. In those cases, use an explicitly labelled illustration, host-system image, or fallback rather than implying a direct photograph exists.

#### Exit criteria

- Every object either has a valid local image or a graceful fallback
- Credits and image type are visible
- Missing images do not break results or details
- Initial catalogue loading remains fast on mobile
- Image use complies with documented source terms

### R5 — Map

Goal: let users understand where catalogue objects are located without turning UniMap into a heavy planetarium application.

#### Initial lightweight map

Build a simple interactive two-dimensional celestial map using local catalogue coordinates:

- Plot objects using right ascension and declination when available
- Support pan, zoom, and reset
- Filter by object category
- Select a plotted object to open its details
- Show object name and type on hover or keyboard focus
- Use SVG or Canvas with plain JavaScript
- Remain usable without WebGL or a mapping framework
- Include a clear statement that the map is a simplified celestial projection

Solar-system bodies whose apparent positions change over time should not be shown as fixed sky coordinates unless the map clearly labels the date and data source. A first version may limit the map to objects with stable catalogue coordinates.

#### Later map extensions

Only after the simple map is useful and fast:

- Constellation outlines
- Search-to-map highlighting
- Related-object paths or systems
- Optional current-date positions for solar-system objects
- Location-aware “Visible Tonight” features

#### Exit criteria

- Objects with valid coordinates appear in the correct relative map region
- Filters and object selection work with mouse, touch, and keyboard where practical
- The map does not require a framework or live astronomy API
- Objects lacking coordinates are handled explicitly
- Performance remains acceptable on a mobile device

### R6 — Search and discovery refinements

Goal: improve discovery using the existing dependency-free search model.

Recommended value order:

1. Search alternate names and catalogue identifiers
2. Add a lightweight random-object action
3. Preserve focus on the previously selected result when returning from details
4. Add simple alphabetical sorting
5. Improve empty-query guidance as the catalogue grows
6. Highlight matched name or alias text only if it remains accessible and simple

Do not add a fuzzy-search dependency until normal name, alias, and identifier search proves inadequate.

### R7 — Lightweight quality automation

Goal: protect the larger catalogue and quiz system without creating a heavy toolchain.

Potential work:

- Validate JSON structure, unique IDs, aliases, categories, related IDs, coordinates, sources, quiz fields, and local image paths
- Detect duplicate questions and invalid answer sets
- Verify leaderboard storage migration and corruption handling
- Add a static-host smoke check
- Add broken-link and missing-asset checks
- Add GitHub Pages deployment after branch strategy is confirmed

No application runtime dependencies should be introduced merely for validation.

## Recommended implementation order

1. **R1 — Major catalogue expansion**
2. **R2 — Quiz mode**
3. **R3 — Educational object profiles**
4. **R4 — Images for objects**
5. **R5 — Map**
6. **R6 — Search and discovery refinements**
7. **R7 — Lightweight quality automation**

Catalogue expansion must establish enough structured, trustworthy data for quiz questions, descriptions, images, and map coordinates. Quiz mode follows immediately because it is the main interactive product feature.

## Later ideas requiring explicit approval

- Shared online/global leaderboards
- User accounts and cloud synchronization
- Multiplayer quiz sessions
- Teacher-created quiz sets
- Full three-dimensional sky rendering
- Location-aware “Visible Tonight” features
- Live solar-system positions
- Offline service worker
- Administrative content editor
- Analytics
- Framework migration

## Explicitly deferred complexity

Do not add the following merely to support roadmap items:

- React, Svelte, Vue, Next.js, or another frontend framework
- TypeScript
- npm or a package-management workflow
- A general-purpose backend API
- PostgreSQL or another database server
- Authentication
- A content-management system
- External search, image, or astronomy APIs used as a required page-view dependency

A future roadmap decision may change these constraints, especially for a shared global leaderboard, but only after documenting the need and tradeoffs in `DECISIONS.md`.

## Roadmap rules

- Finish or explicitly pause the current priority before starting another
- `PRIORITY.md` remains authoritative for the next unit of work
- Update this file when a roadmap item changes state or scope
- Update `PRIORITY.md` whenever the next task changes
- Record durable architectural choices in `DECISIONS.md`
- Do not mark work complete until validation and documentation are complete
- Do not bundle unrelated roadmap items merely because they touch the same file
