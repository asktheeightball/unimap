# UniMap Roadmap

This roadmap describes outcomes, not deadlines. `PRIORITY.md` determines what should be worked on next.

## Completed foundation

### R0 — Static application baseline

Status: **Complete**

- Static HTML, CSS, vanilla JavaScript, and JSON
- No framework, backend, package manager, or build step
- Responsive layout
- Accessible search and category controls
- Result count and no-results state
- Detail view with preserved browse state
- Clear load-error handling
- Basic local-run and deployment instructions

## Near-term roadmap

### R1 — Catalogue completeness and integrity

Goal: ensure the original celestial-body catalogue is fully represented and consistently structured.

Potential work:

- Audit the migrated JSON against the original supplied dataset
- Restore any omitted valid records
- Confirm every record has a unique stable `id`
- Detect missing required fields and duplicate records
- Document whether `size` means radius, diameter, or approximate extent
- Preserve source data before making scientific corrections

Exit criteria:

- The migration audit is documented
- All intended records are present
- IDs are unique
- Malformed records fail visibly during validation

### R2 — Search and browse refinements

Goal: improve discovery without adding dependencies.

Potential work:

- Search alternate names or aliases
- Add simple sorting by name and category
- Improve empty-query instructions
- Preserve focused result when returning from details
- Add a lightweight random-object action

Exit criteria:

- Changes remain dependency-free
- Search and filters remain keyboard accessible
- Existing behavior is regression-tested manually

### R3 — Better educational detail

Goal: make detail pages more informative while keeping data trustworthy.

Potential work:

- Add a short description field
- Add clearly named measurements rather than a generic `size` field
- Add source and last-reviewed metadata
- Add related-object links using stable IDs
- Add locally hosted, properly attributed images only where licensing is clear

Exit criteria:

- New fields are optional and render safely
- Sources are visible and attributable
- Missing fields do not break the application

### R4 — Lightweight quality automation

Goal: reduce regressions without turning the project into a toolchain-heavy application.

Potential work:

- Add a dependency-free validation script if justified
- Add a simple static-host smoke check
- Add GitHub Pages deployment only after the intended branch strategy is confirmed

Exit criteria:

- Automation is small, documented, and removable
- No application runtime dependencies are introduced

## Later ideas

These are not approved priorities:

- Favorites stored in `localStorage`
- Side-by-side comparison
- Unit conversion
- Guided astronomy collections
- Offline caching
- Interactive sky maps
- Live astronomy data

Move a later idea into the active roadmap only when a user need and a lightweight implementation are defined.

## Roadmap rules

- Finish or explicitly pause the current priority before starting another.
- Update this file when a roadmap item changes state or scope.
- Update `PRIORITY.md` whenever the next task changes.
- Record durable architectural choices in `DECISIONS.md`.
- Do not mark work complete until validation and documentation are complete.
