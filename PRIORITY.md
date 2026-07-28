# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P3 — Search intelligence and autocomplete

Status: **Not started**

Goal: make search forgiving, fast, and useful on desktop and mobile without adding a runtime dependency or external service.

#### P3.1 Fuzzy matching and spelling correction

- Search names, aliases, and catalogue identifiers.
- Tolerate common misspellings, missing letters, transposed letters, and partial names.
- Show an explicit correction such as `Did you mean Betelgeuse?` rather than silently changing the query.
- Prefer a small native edit-distance or similarity implementation.
- Keep all search local to the loaded catalogue.

#### P3.2 Autocomplete and suggestions

- Show 6–8 suggestions after one or two characters.
- Rank exact prefix matches first, then common-name, alias, identifier, and fuzzy matches.
- Support touch, mouse, Arrow Up, Arrow Down, Enter, Escape, and screen-reader announcements.
- Selecting a suggestion should open or filter directly to that object.
- Keep suggestions effectively instant with a larger catalogue.

#### P3.3 Small interface cleanup

- Remove the footer and any empty spacing it leaves behind.
- Preserve mobile layout, keyboard access, and no-horizontal-overflow behavior.

#### P3 exit criteria

- Misspelled searches produce useful corrections.
- Alias and identifier search works.
- Autocomplete works on desktop and mobile.
- Keyboard and touch behavior pass.
- No-results guidance remains clear.
- No runtime API or new framework is introduced.

## Next priorities

### P4 — Quiz expansion and persistence

Status: **Not started**

#### P4.1 Effortless mode

Add a new lowest difficulty:

| Mode | Time per question |
|---|---:|
| Effortless | 20 seconds |
| Easy | 15 seconds |
| Medium | 10 seconds |
| Hard | 7 seconds |
| Impossible | 5 seconds |

Effortless should use famous objects, basic type questions, clearly different answers, and common names where available.

#### P4.2 More question families

Add validated question types such as:

- who discovered an object;
- discovery year;
- exoplanet discovery method;
- host-star relationships;
- spectral type;
- constellation or sky region;
- alias or catalogue identifier;
- source classification;
- compatible measurements and coordinates.

Do not generate questions from missing, ambiguous, or unsupported fields.

#### P4.3 Hard and Impossible differentiation

Hard and Impossible must become more difficult through question content, not only shorter timers.

- Hard: discovery person/year, discovery method, host relationships, spectral type, close same-category distractors.
- Impossible: obscure aliases, precise discovery details, catalogue classifications, coordinates, and difficult but fair distractors.

#### P4.4 Persistent leaderboard

Current `localStorage` persistence is device- and browser-specific. Improve local persistence now:

- keep a separate leaderboard for all five modes;
- validate and version stored data;
- recover from corrupt storage;
- preserve scores across reloads and app updates;
- label scores as stored on this device;
- add export/import backup as JSON.

A shared cross-device leaderboard remains a later backend decision because it requires server-side storage, identity, privacy, and anti-cheat controls.

### P5 — Catalogue information enrichment

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

### P0 — Expand the celestial-body catalogue substantially

Status: **Complete** (2026-07-26)

The catalogue expanded from 20 to 84 to **208 records**, with provenance on every imported record. Final counts at completion: Star 68, Exoplanet 60, Galaxy 28, Nebula 17, Pulsar 12, Star Cluster 9, Dwarf Planet 5, Planet 4, Black Hole 3, Neutron Star 2.

### P1 — Build quiz mode

Status: **Complete** (2026-07-26)

Four difficulties, 10 questions per game, four choices, time-based scoring from 100 to 0, five validated question kinds, and separate top-10 local leaderboards are implemented. Desktop and mobile quiz navigation are verified.

### P2 — Add educational object descriptions

Status: **Partially complete / carried into P5**

Sourced descriptions ship on 197 of 208 records. The remaining notability and discovery gaps are now governed by P5 rather than blocking the higher-value search and quiz refinements.

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
