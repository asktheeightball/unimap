# UniMap Decisions

This file records durable product and architecture decisions. Add a new entry when a future contributor might reasonably revisit the same choice.

## D1 — Use a dependency-free static web architecture

Status: **Accepted**

Decision:

UniMap uses HTML, CSS, vanilla JavaScript, and JSON. It has no framework, package manager, build step, backend, database, or authentication.

Rationale:

- The current product is a small searchable catalogue.
- Native browser capabilities are sufficient.
- Static hosting is inexpensive and operationally simple.
- The code should remain easy to inspect and modify with Claude Code or by hand.

Consequences:

- Features must be evaluated against the lightweight architecture.
- A dependency requires explicit justification.
- Browser compatibility and accessible native controls matter.

## D2 — Keep catalogue data separate from application code

Status: **Accepted**

Decision:

Celestial-body records live in `celestial-bodies.json`, not inside `app.js`.

Rationale:

- Data can be reviewed independently from behavior.
- The application code remains small.
- Future validation and source metadata can be added without restructuring the interface.

Consequences:

- The site must be served over HTTP locally because browsers block JSON fetches from `file://` pages.
- Deployment must publish the JSON file beside the application files.

## D3 — Use semantic HTML and CSS classes rather than generating the whole interface in JavaScript

Status: **Accepted**

Decision:

`index.html` contains the main document structure, `styles.css` contains presentation, and JavaScript updates only dynamic content and state.

Rationale:

- Better accessibility
- Easier styling and maintenance
- Less fragile DOM code
- Clear separation of concerns without introducing a framework

## D4 — Use static hosting

Status: **Accepted**

Decision:

Deploy UniMap as a static site. GitHub Pages is the preferred initial option after the production branch is confirmed. Cloudflare Pages and Netlify are acceptable alternatives.

Rationale:

- No server is required.
- Deployment can publish the repository root directly.
- Rollback is commit-based.

## D5 — Do not silently normalize or correct scientific data

Status: **Accepted**

Decision:

Treat the supplied catalogue as source data. Scientific corrections, unit normalization, and changes to measurement meaning require a focused audit and documented evidence.

Rationale:

- Existing fields mix radius, diameter, and approximate extent.
- Some values are approximations.
- Unrelated refactors should not alter source meaning.

Consequences:

- Preserve original values during structural work.
- Document discrepancies before correcting them.
- Add sources and clearer field semantics as a planned data-quality feature.

## Decision template

### D# — Title

Status: **Proposed | Accepted | Superseded**

Decision:

Describe the choice.

Rationale:

Explain the user, technical, and operational reasons.

Consequences:

Describe tradeoffs, constraints, and follow-up work.
