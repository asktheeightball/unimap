# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P5 — Catalogue information enrichment

Status: **Partially complete** — see "Next priorities" below for the full scope.

P4 raised its own reason to continue P5: four candidate quiz families were
rejected for want of data, not for want of code (`DECISIONS.md` D14a). A
discoverer field, a non-transit discovery method, a constellation, or object
names that are independent of their host would each bring one back.

## Next priorities

### P5 — Catalogue information enrichment (continued)

Status: **Partially complete**

Sourced descriptions currently answer what an object is, where it is, and in some cases how it was discovered. Continue by adding more verified fields where available:

- why it is notable;
- discovery date and discoverer;
- discovery or observation method;
- constellation, host, parent, or region;
- spectral type or source classification;
- mass, radius, orbital, or other type-appropriate measurements;
- aliases and catalogue identifiers;
- visible source attribution and review date.

Hand-written `summary` remains separate from importer-generated `sourceSummary` and always takes precedence. Never invent missing facts.

### P6 — Planet category hierarchy

Status: **Not started**

Group planet-related filters into one hierarchy:

- Planets
  - All Planets
  - Solar System Planets
  - Exoplanets
  - Dwarf Planets
  - Candidate Dwarf Planets

`All Planets` should include Planet, Exoplanet, Dwarf Planet, and Candidate Dwarf Planet. Moons and brown dwarfs must remain separate categories. The hierarchy must work on desktop, mobile, keyboard, and screen readers.

### P7 — Catalogue expansion and new object classes

Status: **Not started**

Add more curated, sourced objects, prioritizing:

- Candidate Dwarf Planet;
- Brown Dwarf as its own category/tab;
- Galaxy Cluster, separate from Star Cluster;
- additional well-supported celestial bodies across existing categories.

Potential later classes include Comet, Asteroid, Quasar, Supernova Remnant, Globular Cluster, and Open Cluster.

Every new category requires an authoritative source, confirmed response shape, explicit classification rules, provenance, coordinates where available, validator support, interface support, and quiz-eligibility rules. Do not pad totals with weak or fabricated records.

### P8 — Object location map

Status: **Not started**

#### P8.1 Per-object map

Add a `View on map` action for every object with reliable coordinates. Show the object marker, right ascension, declination, category, nearby catalogue objects, and a return path to details.

#### P8.2 Catalogue-wide map

Build a lightweight SVG or Canvas celestial map using local right ascension and declination:

- pan, zoom, and reset;
- category and hierarchy filters;
- search integration;
- selectable plotted objects;
- detail navigation;
- mouse, touch, and practical keyboard support;
- no framework and no required live API.

Do not present changing solar-system positions as fixed coordinates unless the map clearly states the date, epoch, and meaning.

### P9 — Images for objects

Status: **Not started**

Add a local optimized image or intentional fallback for every object. Store alt text, credit, source URL, usage note, and whether the visual is a direct observation, illustration, or simulation. Lazy-load images and preserve mobile performance.

### P10 — Lightweight validation automation

Status: **Not started**

Add focused validation for IDs, fields, aliases, sources, coordinates, images, related IDs, quiz eligibility, answer-set integrity, leaderboard migrations, static-host smoke checks, and broken assets without adding runtime dependencies.

## Completed

### P4 — Quiz expansion and persistence

Status: **Complete** (2026-07-28)

#### P4.1 Effortless mode — done

Added at 20 seconds, ahead of Easy and selected by default. It draws only on
records flagged `wellKnown` whose name is a common name rather than a bare
catalogue designation (34 of 208), and asks only identity and type questions —
no discovery facts, no coordinates, no aliases, no close measurements. Game
length is unchanged at 10 questions.

The eligibility rule is not a hard-coded list of famous objects. `wellKnown` is
derived by `tools/derive_quiz_fields.py` from the curated `select_identifiers`
and `select_names` lists already in `tools/sources.json`, plus the solar-system
planets and the Sun. 85 of 208 records qualify.

#### P4.2 More question families — done, with four rejections

Added: discovery year, spectral type (both directions), and coordinates (both
directions). Retained: object type, membership, distance, size, source
classification.

**Rejected, with evidence** (`DECISIONS.md` D14a):

| Family | Why |
|---|---|
| Discovery method | Structured on all 60 exoplanets, but every value is `Transit`. One distinct value cannot make four choices. |
| Who discovered this object | No record carries a discoverer. Inventing one violates D7. |
| Constellation or sky region | No record carries it. |
| Host-star relationships (both directions) | The archive names a planet after its host, so the prompt spells out its answer. 52 of 52 instances were rejected by the giveaway rule. |
| Alias or catalogue identifier (both directions) | Only five informative aliases exist and every one embeds the object's name. |
| Reverse source classification | Nine catalogued objects are planetary nebulae; the question has nine correct answers. Permanently rejected. |

The structured fields the new families need did not exist: earlier imports
fetched `hostname`, `disc_year`, `discoverymethod` and `sp_type` but wrote them
only into generated prose. `tools/derive_quiz_fields.py` recovered them by
reversing the importer's own template and proving the reversal round-trips
exactly, and `tools/import_catalogue.py` now writes all four as fields.

#### P4.3 Hard and Impossible differentiation — done

Hard asks discovery year, spectral type and source classification. Impossible
asks exact spectral type and exact coordinates with all four object choices
drawn from one category. Neither relies on the timer alone, and both are
measured: over 40 sampled games each, at least 80% of questions come from the
mode's own preferred families.

#### P4.4 Persistent leaderboard — done

Five separate leaderboards, a versioned envelope (`{version, entries}`), in-place
migration from the previous unversioned array, per-entry validation that drops
bad rows without discarding good ones, quarantine of unparseable data under a
`.corrupt` key instead of deletion, a visible "stored on this device only" note,
and JSON export/import where import merges rather than replaces.

#### Validation

- `python3 tools/validate_catalogue.py` — 208 records, 0 errors, 0 warnings.
- `node tools/quiz_checks.mjs` — 105/105.
- `node tools/search_checks.mjs` — 121/121, no regression.
- `python3 tools/derive_quiz_fields.py --dry-run` — idempotent, 0 refusals.

### P0 — Expand the celestial-body catalogue substantially

Status: **Complete** (2026-07-26)

The catalogue expanded from 20 to 84 to **208 records**, with provenance on every imported record. Final counts at completion: Star 68, Exoplanet 60, Galaxy 28, Nebula 17, Pulsar 12, Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3, Neutron Star 2.

### P1 — Build quiz mode

Status: **Complete** (2026-07-26)

Four difficulties, 10 questions per game, four choices, time-based scoring from 100 to 0, five validated question kinds, and separate top-10 local leaderboards are implemented. Desktop and mobile quiz navigation are verified.

### P2 — Add educational object descriptions

Status: **Partially complete / carried into P5**

Sourced descriptions ship on 197 of 208 records. The remaining notability and discovery gaps are now governed by P5 rather than blocking the higher-value search and quiz refinements.

### P3 — Search intelligence and autocomplete

Status: **Complete** (2026-07-28)

Search now indexes names, aliases and the `id` slug, ranks matches in seven tiers, tolerates misspellings through bounded Damerau-Levenshtein, offers explicit `Did you mean …?` corrections, and provides an accessible autocomplete listbox. The footer was removed as the P3.3 interface slice. See `DECISIONS.md` D13 for the matching rules and thresholds, and `README.md` for the behaviour a visitor sees.

Validation: 121 browser checks against the real `index.html` over HTTP, all passing (`node tools/search_checks.mjs`).

## Selection rules

When asked to start the next feature or task:

1. Read `PRODUCT.md`, `PRIORITY.md`, `ROADMAP.md`, `HANDOFF.md`, `DECISIONS.md`, `DEPLOYMENT.md`, and `CLAUDE.md`.
2. Inspect the repository and verify documentation against code.
3. Select the highest-ranked item whose status is `Not started` or `In progress`.
4. Do not skip a higher priority because a lower item is easier.
5. If the current priority is blocked, document the blocker and select the next unblocked item.
6. Keep each implementation slice small enough to validate completely.
7. Keep the application static and dependency-free unless an approved decision explicitly changes that architecture.
8. Do not fabricate scientific facts, classifications, names, locations, or provenance.

## Status values

Use only:

- **Not started**
- **In progress**
- **Blocked**
- **Complete**
- **Paused**
- **Partially complete**

## Completion protocol

Before marking an item complete:

- validate the relevant behavior;
- report files changed;
- record commands and checks performed;
- update roadmap status where applicable;
- update `HANDOFF.md`;
- identify the next priority;
- commit with a focused message when explicitly authorized.
