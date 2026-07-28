# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P1 — Build quiz mode

Status: **Not started** — this is now the active task. See the Queue below.

## Completed

### P0 — Expand the celestial-body catalogue substantially

Status: **Complete** (2026-07-28)

The catalogue grew from 20 records to **129** across eight categories, all imported
through the `tools/` pipeline from sources that were actually retrieved.

Objective (met): reconcile the original dataset, identify authoritative import sources,
and expand UniMap into a much larger locally stored catalogue without making the
user-facing application dependent on live APIs.

#### Reconciliation finding (resolved 2026-07-26)

Items 1–3 below are **closed as not applicable**. No original prototype dataset exists in this repository. Verified by:

- `git log --all --diff-filter=A --name-only` — only 12 files have ever existed, none of them a prototype;
- the current catalogue was authored in the commit that created the app (`c55b9bb`), not migrated from a prior source;
- the remote has no other branches.

The earlier claim that "the current JSON appears smaller than the original supplied prototype dataset" was an assumption, not an observation, and has been corrected in `HANDOFF.md`. The 20 existing records are the baseline; there is nothing to restore.

#### Blocker — resolved 2026-07-28

The earlier HTTP 403 blocker was a property of the sandbox the work was done in, not
of the sources. On a networked machine all three sources respond normally, and the
SIMBAD TLS failure is fixed by the documented `--ca-bundle` flag. Nothing about the
pipeline needed to change to unblock it.

#### Final catalogue

| Type | Records | Source |
|---|---:|---|
| Exoplanet | 60 | NASA Exoplanet Archive |
| Star | 49 | 45 SIMBAD + 4 unsourced baseline |
| Dwarf Planet | 4 | NASA/JPL Small-Body Database |
| Galaxy | 4 | unsourced baseline |
| Planet | 4 | unsourced baseline |
| Black Hole | 3 | unsourced baseline |
| Nebula | 3 | unsourced baseline |
| Neutron Star | 2 | unsourced baseline |
| **Total** | **129** | **109 sourced, 20 baseline** |

Acceptance criteria — all met:

- ✅ The original migration is reconciled with documented counts (closed: no prototype existed).
- ✅ The catalogue is substantially larger than the baseline — 20 → 129, a 6.45× increase.
- ✅ Every imported record has a stable unique ID and source metadata (109/109).
- ✅ The app does not require an external astronomy service to browse the catalogue.
- ✅ The source/import method is documented and repeatable (`README.md`, D6).
- ✅ Search and filters remain responsive on mobile — 0.02 ms average at 129 records.
- ✅ Existing core behavior has no known blocking errors — 40 browser checks, 0 failures.

Carried forward, not blocking:

- The 20 baseline records still carry no provenance. They predate D7 and cannot be
  given attribution retroactively without refetching each value from a real source.
  Adding provenance to them belongs to **P2**, which already covers per-object
  sourced profiles.
- Three SIMBAD names are catalogue-style rather than recognisable proper names
  (`DS Tau B`, `T Cha C`, `TPHE G`). They are genuine SIMBAD `NAME` identifiers with
  real parallax-derived distances, so they are accurate but low-value. Tightening the
  filter further risks discarding legitimate names; revisit if P1 finds them poor
  quiz material.

## Queue

### P1 — Build quiz mode

Status: **Not started** — active priority as of 2026-07-28.

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
