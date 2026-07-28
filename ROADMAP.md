# UniMap Roadmap

This roadmap describes outcomes, not deadlines. `PRIORITY.md` determines what should be worked on next.

## Product guardrail

UniMap should remain lightweight even as its catalogue and game modes grow:

- Static HTML, CSS, vanilla JavaScript, and JSON by default
- No frontend framework, package manager, or build step unless a documented need clearly justifies one
- Prefer local curated data over live API calls at page-view time
- External astronomy APIs may be used for research or controlled data-import workflows
- New fields must be optional and must not break older records
- Keep each feature independently testable, accessible, and mobile-friendly
- Do not fabricate scientific facts, names, classifications, measurements, or provenance

## Completed foundation

### R0 — Static application baseline

Status: **Complete**

- Responsive static catalogue
- Accessible search and category controls
- Result count and no-results state
- Detail view with preserved browse state
- Clear load-error handling
- Static-host deployment instructions

### R1 — Major catalogue expansion

Status: **Complete** (2026-07-26)

The catalogue expanded from 20 to **208 records** through reviewed local imports. Final counts at completion: Star 68, Exoplanet 60, Galaxy 28, Nebula 17, Pulsar 12, Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3, Neutron Star 2. Imported records preserve provenance and most carry coordinates.

### R2 — Core quiz mode

Status: **Complete** (2026-07-26)

Implemented:

- Easy 15s, Medium 10s, Hard 7s, Impossible 5s
- 10 questions per game
- Four choices and exactly one correct answer
- Continuous scoring from 100 to 0
- Zero for incorrect or expired answers
- Five validated question families
- Separate top-10 `localStorage` leaderboard per difficulty
- Desktop, keyboard, touch, and mobile support

### R3 — Educational object profiles

Status: **Partially complete**

Sourced descriptions exist on 197 of 208 records and answer what an object is, where it is, and in some cases how it was discovered. Remaining work is folded into R6 below.

### R4 — Search intelligence and autocomplete

Status: **Complete** (2026-07-28)

Goal: make catalogue discovery forgiving and fast without a runtime service.

Delivered:

- names, aliases and the `id` slug are indexed once after load, normalized to a
  comparable form and a space-free variant, without mutating any record;
- matches are ranked in seven tiers — exact name, name prefix, exact
  alias/identifier, alias/identifier prefix, name substring, alias/identifier
  substring, fuzzy — so a fuzzy match can never outrank a literal one;
- fuzzy matching is bounded Damerau-Levenshtein with a budget that scales with
  query length and is zero below four characters;
- an explicit `Did you mean …?` correction appears whenever the best match was
  only reached by edit distance, and the query is never rewritten without a
  click;
- an ARIA 1.2 combobox offers up to eight suggestions with mouse, touch,
  Arrow Up/Down, Enter and Escape support and a polite count announcement;
- the footer was removed.

Measured at 1.7 ms per query on the 208-record catalogue and 2.6 ms on a
1,000-record fixture, worst case. No request of any kind is made while typing.

Exit criteria met, verified by 121 browser checks (`node tools/search_checks.mjs`).

## Active roadmap

### R5 — Quiz expansion and persistent local scores

Status: **Complete** (2026-07-28)

Delivered:

| Mode | Time per question | Content it actually asks |
|---|---:|---|
| Effortless | 20 seconds | identity and type, on well-known common-named records |
| Easy | 15 seconds | identity, type, catalogued distance and size |
| Medium | 10 seconds | source classification, distance and size, whole catalogue |
| Hard | 7 seconds | discovery year, spectral type, source classification |
| Impossible | 5 seconds | exact spectral type and coordinates, same-category choices |

Difficulty is a content ladder, not only a clock. Each mode has ordered tiers and
falls back to simpler content — keeping its own timer — rather than serving a
short game. Fallback is recorded in diagnostics and asserted in the checks.

Question families added: discovery year, spectral type in both directions, and
coordinates in both directions, alongside the existing type, membership,
distance, size and source-classification families.

Four candidate families were **rejected on evidence** rather than implemented:
discovery method (one distinct value across all 60 exoplanets), discoverer and
constellation (no record carries either), host-star relationships (the archive
names a planet after its host, so the prompt gives the answer away), and aliases
(the five informative ones all embed the object's name). Reverse source
classification is rejected permanently — nine objects share a gloss. See
`DECISIONS.md` D14a.

Leaderboards: five modes, a versioned `{version, entries}` envelope, in-place
migration from the old unversioned array, per-entry validation, quarantine of
unreadable data instead of deletion, a visible device-only note, and JSON
export/import that merges rather than replaces.

Supporting work: `tools/derive_quiz_fields.py` recovered `hostName`,
`discoveryYear`, `discoveryMethod` and `spectralType` — values earlier imports
fetched but wrote only into generated prose — by reversing the importer's own
template and requiring the reversal to re-render the stored sentence exactly. It
also sets the editorial `wellKnown` flag from the curated identifier lists in
`tools/sources.json`. `tools/import_catalogue.py` now writes all four fields
directly, so no future import needs the recovery step.

Validation: 105 quiz checks, 121 search checks, catalogue validator clean.

A shared cross-device leaderboard remains a future backend decision requiring identity, privacy, server-side validation, and anti-cheat controls.

### R6 — Catalogue information enrichment

Status: **Partially complete**

Goal: make each detail page useful for learning and support richer quiz questions.

Add verified fields where available:

- why the object is notable;
- discovery date and discoverer;
- discovery or observation method;
- constellation, host, parent, or region;
- spectral type or source classification;
- mass, radius, orbital, or type-appropriate measurements;
- aliases and catalogue identifiers;
- visible source attribution and review date.

Hand-written `summary` remains separate from importer-generated `sourceSummary`, takes precedence, and must never be overwritten by imports. Missing facts must render gracefully rather than be invented.

### R7 — Planet category hierarchy

Status: **Not started**

Group planet-related categories into one navigable hierarchy:

- Planets
  - All Planets
  - Solar System Planets
  - Exoplanets
  - Dwarf Planets
  - Candidate Dwarf Planets

`All Planets` includes Planet, Exoplanet, Dwarf Planet, and Candidate Dwarf Planet. Moons and brown dwarfs remain separate. The pattern must work on desktop, mobile, keyboard, and screen readers.

### R8 — Catalogue expansion and new object classes

Status: **Not started**

Add more curated, sourced records and introduce:

- Candidate Dwarf Planet;
- Brown Dwarf in a separate category/tab;
- Galaxy Cluster, distinct from Star Cluster;
- additional well-supported bodies across existing categories.

Potential later classes include Comet, Asteroid, Quasar, Supernova Remnant, Globular Cluster, and Open Cluster.

Every new class requires an authoritative source, confirmed response shape, explicit classification rules, provenance, coordinates where available, validator support, interface support, and quiz-eligibility rules. Do not pad counts with weak records.

### R9 — Object location map

Status: **Not started**

#### Per-object location

Add `View on map` for every object with reliable coordinates. Show:

- right ascension and declination;
- selected object marker;
- object category;
- nearby catalogue objects;
- return navigation to details.

#### Catalogue-wide map

Build a lightweight SVG or Canvas map using local coordinates:

- pan, zoom, and reset;
- category and hierarchy filters;
- search integration;
- selectable objects and detail navigation;
- mouse, touch, and practical keyboard support;
- no framework or required live API.

Do not show changing solar-system positions as fixed coordinates unless the date, epoch, source, and meaning are explicit.

### R10 — Images for objects

Status: **Not started**

Add a local optimized image or intentional fallback for every object. Record alt text, credit, source URL, usage note, and whether the visual is a direct observation, illustration, or simulation. Lazy-load images and preserve mobile performance.

### R11 — Lightweight quality automation

Status: **Not started**

Add focused validation for IDs, fields, aliases, sources, coordinates, images, related IDs, quiz eligibility, answer-set integrity, leaderboard migrations, static-host smoke checks, and broken assets without adding application runtime dependencies.

## Recommended implementation order

1. **R6 — Catalogue information enrichment**
2. **R7 — Planet category hierarchy**
3. **R8 — Catalogue expansion and new object classes**
4. **R9 — Object location map**
5. **R10 — Images for objects**
6. **R11 — Lightweight quality automation**

R4 — Search intelligence and autocomplete and R5 — Quiz expansion and persistent
local scores are complete.

R6 now carries a debt from R5: four quiz question families are implemented in
spirit but unsupportable on the current data. A discoverer field, a non-transit
discovery method, a constellation, or object names independent of their host
would each bring one back.

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

- Finish or explicitly pause the current priority before starting another.
- `PRIORITY.md` remains authoritative for the next unit of work.
- Update this file when a roadmap item changes state or scope.
- Record durable architectural choices in `DECISIONS.md`.
- Do not mark work complete until validation and documentation are complete.
- Do not bundle unrelated roadmap items merely because they touch the same file.
