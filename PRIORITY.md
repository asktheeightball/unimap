# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P7 — Catalogue expansion and new object classes

Status: **Not started** — this is now the active task. Full scope below.

## Completed

### P6 — Planet category hierarchy

Status: **Complete** (2026-07-28)

Categories are now a declared model with stable ids (`DECISIONS.md` D19), and the
planet filters are a disclosure group (D20):

| Category | id | Types | Records |
|---|---|---|---:|
| All Planets | `all-planets` | Planet, Exoplanet, Dwarf Planet, Candidate Dwarf Planet | 69 |
| Solar System Planets | `solar-system-planets` | Planet | 3 |
| Exoplanets | `exoplanets` | Exoplanet | 61 |
| Dwarf Planets | `dwarf-planets` | Dwarf Planet | 5 |
| Candidate Dwarf Planets | `candidate-dwarf-planets` | Candidate Dwarf Planet | 0 |

Moons and Brown Dwarfs are top-level categories and are deliberately not members
of All Planets. Both, and Candidate Dwarf Planets, are declared, validated and
tested but hidden until a record exists (D21) — which makes P7 a data-only
change for all three.

`kepler-452b` was corrected from `Planet` to `Exoplanet` on the NASA Exoplanet
Archive's own listing of it as a confirmed planet, cached in this repository
(D22). Only the type changed; counts moved to Planet 3 / Exoplanet 61.

Validation: 225 search checks, 121 quiz checks, catalogue validator clean at 208
records.

### P5 — Catalogue information enrichment

Status: **Complete** (2026-07-28)

326 values were added across nine fields, every one recovered from a source
response that had already been fetched. No record was added, removed, renamed or
reordered and no existing value changed.

| Field | Records | Where it came from |
|---|---:|---|
| `classification` | 132 | SIMBAD object-type gloss |
| `commonName` | 91 | SIMBAD `NAME` identifiers |
| `massEarth` | 59 | Exoplanet archive `pl_bmasse`, from cache |
| `catalogueIdentifiers` | 36 | Alternate SIMBAD names |
| `orbitClass` | 5 | JPL orbit class |
| `discoverer` / `discoveryDate` / `discoverySite` | 1 each | JPL discovery block |

Delivered:

- 91 records that displayed a bare designation now lead with a recognisable
  name, keeping the designation visible and searchable (`DECISIONS.md` D16);
- the detail view is grouped into Overview, Location, Discovery, Physical and
  orbital, Names and identifiers, and Source, hiding empty rows and sections;
- search indexes common names in the name tiers and alternates in the identifier
  tiers, with the seven existing tiers unchanged;
- the quiz classification family doubled its pool from 66 to 132, the Effortless
  pool grew from 34 to 60, and one new family was enabled.

**Not done, with evidence:**

- **Notability.** No source response carries anything supporting "why this
  object matters", and the 11 records with no description are exactly the 11
  with no provenance. Writing editorial text for them is real work with real
  sourcing requirements and is carried into P9 rather than guessed at now.
- **Constellation.** No source field exists. The defensible route is deriving it
  from coordinates against the IAU boundary table, which needs precession to
  B1875 — see the probe steps in `HANDOFF.md`.
- **Related objects.** All 60 exoplanet host stars were checked against the
  catalogue and **none is present**, so no host link can be created without
  first importing them. Creating one anyway would point at a record that does
  not exist.

## Next priorities

### P7 — Catalogue expansion and new object classes (active)

Status: **Not started**

The interface work is already done. `Candidate Dwarf Planet` and `Brown Dwarf`
are declared in the category model, accepted by the validator and covered by the
checks; both filters appear automatically as soon as a record exists, so this
priority is a data-only change for them. What it needs is sources, not code:

- an authoritative list for candidate dwarf planets that does **not** simply
  treat every large TNO as a candidate;
- a source that types brown dwarfs as such;
- a galaxy-cluster source distinct from star clusters.

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
