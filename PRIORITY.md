# UniMap Priority

This is the authoritative source for selecting the next unit of work.

## Current priority

### P0 — Verify the static baseline and full dataset migration

Status: **Not started**

Objective: prove that the current static application works as documented and determine whether the complete original celestial-body dataset was migrated into `celestial-bodies.json`.

Required work:

1. Compare the current JSON catalogue with the original supplied prototype dataset.
2. Report record totals by category for both sources.
3. Identify omitted, renamed, duplicated, or materially altered records.
4. Restore missing records only when the original source supports them.
5. Verify unique IDs and required fields.
6. Run the app through a local static server.
7. Validate search, every category filter, details, Back, Clear Search, no-results, load failure, keyboard use, and a narrow mobile viewport.
8. Update `HANDOFF.md`, `ROADMAP.md`, and this file with the outcome.

Acceptance criteria:

- The dataset reconciliation is documented with counts.
- Every intended record has a unique ID.
- The application has no known blocking console or load errors.
- Core behavior has been manually validated.
- Documentation reflects the actual repository state.

## Queue

### P1 — Clarify and validate measurement semantics

Document what each measurement represents, especially the generic `size` and `circumference` values. Do not silently rewrite scientific data.

### P2 — Improve empty-search guidance

Decide whether an empty search should show all records or an instructional state, then make the behavior and README consistent.

### P3 — Add alternate-name search

Add a simple optional `aliases` array to records and search it without introducing a library.

## Selection rules

When asked to start the next feature or task:

1. Read `PRODUCT.md`, `PRIORITY.md`, `ROADMAP.md`, `HANDOFF.md`, `DECISIONS.md`, `DEPLOYMENT.md`, and `CLAUDE.md`.
2. Inspect the repository and verify the documentation against the code.
3. Select the highest-ranked item whose status is `Not started` or `In progress`.
4. Do not skip a higher priority because a lower item is easier.
5. If the current priority is blocked, document the blocker and select the next unblocked item.
6. Keep each task small enough to validate completely.
7. Do not create a new priority merely because an idea appears in the roadmap.

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
