# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P0 — Expand the celestial-body catalogue substantially

Status: **In progress** — import pipeline built and validated; bulk import blocked on network access.

Objective: reconcile the original dataset, identify authoritative import sources, and expand UniMap into a much larger locally stored catalogue without making the user-facing application dependent on live APIs.

#### Reconciliation finding (resolved 2026-07-26)

Items 1–3 below are **closed as not applicable**. No original prototype dataset exists in this repository. Verified by:

- `git log --all --diff-filter=A --name-only` — only 12 files have ever existed, none of them a prototype;
- the current catalogue was authored in the commit that created the app (`c55b9bb`), not migrated from a prior source;
- the remote has no other branches.

The earlier claim that "the current JSON appears smaller than the original supplied prototype dataset" was an assumption, not an observation, and has been corrected in `HANDOFF.md`. The 20 existing records are the baseline; there is nothing to restore.

#### Blocker

Bulk import cannot proceed in the current environment. Every astronomy host is refused by the sandbox network policy at the CONNECT stage (HTTP 403), including `exoplanetarchive.ipac.caltech.edu`, `simbad.cds.unistra.fr`, `vizier.cds.unistra.fr`, `ssd-api.jpl.nasa.gov`, `images-api.nasa.gov`, and `api.nasa.gov`. Documentation sites for those services are blocked too, so their terms could not be read first-hand.

Records must not be authored from model recall and labelled with source URLs that were never fetched — that would fabricate provenance and violate the "do not invent values" rule. Expansion resumes when a maintainer either runs the importer from a networked machine or grants the sandbox access to those hosts.

The import and validation workflow is built and tested; only the network-dependent
step remains. See `README.md` for the commands and `HANDOFF.md` for the full
limitation notes.

Remaining work:

4. Define the target categories and practical first expansion size.
5. Test authoritative source options:
   - SIMBAD and VizieR for non-solar-system objects;
   - NASA Exoplanet Archive TAP for exoplanets;
   - NASA/JPL Small-Body Database and Horizons for solar-system objects;
   - NASA Image and Video Library for candidate imagery and attribution.
6. Define a controlled import or curation workflow that writes reviewed records into local JSON. **Done** — `tools/import_catalogue.py` + `tools/promote_staging.py`, see D6.
7. Do not add live API calls as a required page-view dependency. **Held** — the site still fetches only local JSON.
8. Add many more objects across existing and approved new categories.
9. Preserve source identifiers, aliases, coordinates where available, source attribution, and review dates. **Schema ready** — validated optional fields exist; the importer populates them.
10. Verify unique IDs, required fields, category consistency, duplicate detection, and mobile search performance. **Done** — `tools/validate_catalogue.py`.
11. Run the application through a local static server and validate all existing core behavior. **Done** — 64/64 behavioural checks plus 19 catalogue-growth checks.
12. Update `HANDOFF.md`, `ROADMAP.md`, and this file with counts, source decisions, and the next task. **Done**.

Acceptance criteria:

- The original migration is reconciled with documented counts.
- The catalogue is substantially larger than the current baseline.
- Every imported record has a stable unique ID and source metadata.
- The app does not require an external astronomy service to browse the catalogue.
- The source/import method is documented and repeatable.
- Search and filters remain responsive on mobile.
- Existing core behavior has no known blocking errors.

## Queue

### P1 — Build quiz mode

Status: **Not started**

Build four quiz modes using validated local catalogue data:

- Easy: 15 seconds per question
- Medium: 10 seconds per question
- Hard: 7 seconds per question
- Impossible: 5 seconds per question

Requirements:

- Four multiple-choice answers per question
- Exactly one correct answer
- Correct answers begin at 100 available points
- Points decrease to 0 over the mode's time limit
- Incorrect or expired answers score 0
- Show the correct answer and a short explanation
- Use plausible, unambiguous distractors
- Separate local leaderboard for each mode using `localStorage`
- Store player name, score, date, and question count
- Keyboard- and touch-friendly gameplay
- Questions generated only from validated fields

A shared global leaderboard is not part of this priority because it requires hosted writes, anti-cheat controls, and privacy decisions.

### P2 — Add educational object descriptions

Status: **Not started**

Add a concise sourced profile for each object explaining:

- what it is;
- why it is notable;
- where it is located; and
- how it was discovered or observed.

Also add aliases, source metadata, review dates, clearly named measurements, and related-object IDs where supported.

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
