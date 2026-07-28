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

## Active roadmap

### R4 — Search intelligence and autocomplete

Status: **Not started**

Goal: make catalogue discovery forgiving and fast without a runtime service.

#### Fuzzy matching and correction

- Search names, aliases, and catalogue identifiers.
- Tolerate common spelling errors, missing letters, transpositions, and partial names.
- Offer visible corrections such as `Did you mean Betelgeuse?`.
- Never silently replace the user query.
- Use a small native similarity implementation rather than a framework or service.

#### Autocomplete and suggestions

- Show 6–8 ranked suggestions after one or two characters.
- Rank exact prefix, common-name, alias, identifier, then fuzzy matches.
- Support mouse, touch, Arrow Up, Arrow Down, Enter, Escape, and screen readers.
- Allow selection to open or filter directly to an object.
- Remain effectively instant at larger catalogue sizes.

#### Interface cleanup

- Remove the footer and any empty spacing it leaves.

#### Exit criteria

- Misspelled queries produce useful corrections.
- Alias and identifier search works.
- Autocomplete works on desktop and mobile.
- Touch, keyboard, and screen-reader behavior pass.
- No network request occurs while typing.

### R5 — Quiz expansion and persistent local scores

Status: **Not started**

#### Effortless mode

Add a fifth mode:

| Mode | Time per question | Intended content |
|---|---:|---|
| Effortless | 20 seconds | Famous objects, basic types, clearly different choices |
| Easy | 15 seconds | Common objects and direct facts |
| Medium | 10 seconds | Broader catalogue and less obvious facts |
| Hard | 7 seconds | Discovery, relationships, classifications, close distractors |
| Impossible | 5 seconds | Obscure but fair facts and highly plausible distractors |

#### More question families

Add questions from verified fields only:

- discoverer;
- discovery year;
- exoplanet discovery method;
- host-star relationship;
- spectral type;
- constellation or sky region;
- alias or catalogue identifier;
- source classification;
- compatible measurements and coordinates.

Hard and Impossible must differ through question content, not only timers. Do not create questions from missing, ambiguous, unsupported, or incompatible data.

#### Persistent leaderboard

Improve local persistence:

- separate leaderboard for all five modes;
- version and validate saved data;
- recover from corrupt storage;
- preserve scores across reloads and app updates;
- label scores as stored on this device;
- export/import leaderboard backup as JSON.

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

1. **R4 — Search intelligence and autocomplete**
2. **R5 — Quiz expansion and persistent local scores**
3. **R6 — Catalogue information enrichment**
4. **R7 — Planet category hierarchy**
5. **R8 — Catalogue expansion and new object classes**
6. **R9 — Object location map**
7. **R10 — Images for objects**
8. **R11 — Lightweight quality automation**

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
