# UniMap Roadmap

This roadmap describes outcomes, not deadlines. `PRIORITY.md` determines what should be worked on next.

## Product guardrail

UniMap must remain extremely lightweight:

- Static HTML, CSS, vanilla JavaScript, and JSON
- No framework, backend, database server, package manager, or build step
- No runtime dependencies unless a future need clearly justifies one
- Prefer small, independently testable improvements over broad rewrites
- New fields must be optional and must not break older records

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

Goal: ensure the original celestial-body catalogue is fully represented and consistently structured before enriching it.

Potential work:

- Audit the migrated JSON against the original supplied dataset
- Report record totals by category for both sources
- Restore any omitted valid records
- Identify renamed, duplicated, or materially altered records
- Confirm every record has a unique stable `id`
- Detect missing required fields and duplicate IDs
- Preserve the original source data before making scientific corrections
- Document all migration decisions and unresolved discrepancies

Exit criteria:

- The migration audit is documented with before-and-after counts
- All intended records are present
- IDs are unique
- Every record contains the required baseline fields
- Malformed records fail visibly during validation
- The static app is manually validated against the complete catalogue

### R2 — Educational object profiles

Goal: turn UniMap from a searchable fact table into a useful educational catalogue without adding infrastructure or dependencies.

This is the highest-value feature area after catalogue integrity is complete.

Potential work:

- Add a concise two-to-four-sentence `summary` for each object
- Explain what the object is, where it is, why it is notable, and what makes it interesting
- Add optional alternate names through an `aliases` array
- Replace ambiguous presentation of `size` with a clearly named measurement label where possible
- Distinguish radius, diameter, width, approximate extent, or event-horizon measurement
- Review whether `circumference` is meaningful for each object type and relabel or omit it where appropriate
- Add source name and source URL metadata
- Add a `lastReviewed` date
- Add optional related-object IDs using stable record IDs
- Add optional locally hosted images where licensing and attribution are clear
- Add image alt text and visible attribution

Suggested lightweight record shape:

```json
{
  "id": "betelgeuse",
  "name": "Betelgeuse",
  "type": "Star",
  "aliases": ["Alpha Orionis"],
  "summary": "Betelgeuse is a red supergiant in the constellation Orion. It is notable for its enormous size and reddish appearance.",
  "measurementLabel": "Approximate diameter",
  "measurementValue": "445 million km",
  "distance": "~548 ly",
  "sourceName": "NASA",
  "sourceUrl": "https://example.com",
  "lastReviewed": "2026-07-26",
  "relatedIds": ["orion-nebula"],
  "image": "images/betelgeuse.webp",
  "imageAlt": "Betelgeuse observed in visible light",
  "imageCredit": "Source attribution"
}
```

Exit criteria:

- Summaries are concise, readable, and supported by documented sources
- Measurement labels are understandable and not misleading
- Source and review metadata display clearly when present
- Optional images are local, optimized, attributed, and accessible
- Related-object links open the existing detail view without a routing framework
- Missing optional fields do not break search, results, or details

### R3 — Search and discovery refinements

Goal: improve object discovery using the existing dependency-free search and rendering model.

Potential work, in recommended value order:

1. Search alternate names and aliases
2. Add a lightweight random-object action
3. Preserve focus on the previously selected result when returning from details
4. Add simple alphabetical sorting
5. Add category sorting only if it remains useful after filtering
6. Improve empty-query guidance as the catalogue grows
7. Highlight matched name or alias text only if it can be implemented accessibly and simply

Do not add fuzzy-search libraries at this stage. Basic normalized matching across names and aliases should be sufficient.

Exit criteria:

- Name and alias searches are case-insensitive and partial-match capable
- Random Object opens a valid record and remains keyboard accessible
- Returning from details restores a useful focus location
- Sorting does not require structured scientific measurement conversion
- Changes remain dependency-free
- Search and filters remain keyboard accessible
- Existing behavior is manually regression-tested

### R4 — Lightweight visual enrichment

Goal: materially improve the perceived quality of UniMap without making it media-heavy or operationally complex.

Potential work:

- Add a small optional image to result cards only after detail-page images are proven useful
- Add simple category icons using inline SVG or CSS rather than an icon library
- Add a consistent fallback visual for objects without images
- Optimize local images to WebP or another browser-friendly format
- Lazy-load images
- Keep the interface fast on mobile connections

Exit criteria:

- The app remains fast and readable without images
- Missing or failed images degrade gracefully
- Image credits are visible
- Images do not introduce third-party runtime dependencies
- The initial page remains lightweight

### R5 — Lightweight quality automation

Goal: reduce regressions without turning the project into a toolchain-heavy application.

Potential work:

- Add a dependency-free dataset validation script if justified
- Validate unique IDs, required baseline fields, related IDs, source metadata, and local image paths
- Add a simple static-host smoke check
- Add a broken-link and missing-asset check if it can remain small
- Add GitHub Pages deployment only after the intended branch strategy is confirmed

Exit criteria:

- Automation is small, documented, and removable
- No application runtime dependencies are introduced
- Validation failures are clear and actionable
- Deployment remains a static-folder publish operation

## Recommended implementation order

The roadmap should normally progress in this order:

1. **R1 — Catalogue completeness and integrity**
2. **R2 — Educational object profiles**
3. **R3 — Search and discovery refinements**
4. **R4 — Lightweight visual enrichment**
5. **R5 — Lightweight quality automation**

Within R2, use this value order:

1. Short educational summaries
2. Alternate names and aliases
3. Clear measurement labels
4. Sources and last-reviewed dates
5. Related-object links
6. Local attributed images

This ordering maximizes usefulness and trust before investing in visual polish.

## Later ideas

These are not approved priorities:

- Favorites stored in `localStorage`
- Recently viewed objects
- Side-by-side comparison
- Unit conversion
- Guided astronomy collections
- Quiz mode
- Offline caching or a service worker
- Interactive sky maps
- Location-aware “Visible Tonight” features
- Live astronomy data
- User accounts
- Cloud synchronization
- An administrative content editor
- Analytics
- A framework migration

Move a later idea into the active roadmap only when a clear user need and a lightweight implementation are defined.

## Explicitly deferred complexity

Do not add the following merely to support roadmap items:

- React, Svelte, Vue, Next.js, or another frontend framework
- TypeScript
- npm or a package-management workflow
- A backend API
- PostgreSQL, SQLite, or another database
- Authentication
- A content-management system
- External search, image, or astronomy APIs used at page-view time

A future roadmap decision may change these constraints, but only after documenting the user need and tradeoffs in `DECISIONS.md`.

## Roadmap rules

- Finish or explicitly pause the current priority before starting another.
- `PRIORITY.md` remains authoritative for the next unit of work.
- Update this file when a roadmap item changes state or scope.
- Update `PRIORITY.md` whenever the next task changes.
- Record durable architectural choices in `DECISIONS.md`.
- Do not mark work complete until validation and documentation are complete.
- Do not bundle unrelated roadmap items merely because they touch the same file.
