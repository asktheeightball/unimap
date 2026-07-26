# UniMap Handoff

Update this file at the end of every meaningful work session. It should describe the repository as it actually exists, not merely the intended state.

## Project summary

UniMap is a dependency-free static astronomy catalogue.

Technology:

- HTML
- CSS
- Vanilla JavaScript
- JSON

There is no framework, package manager, build command, backend, database, or authentication.

## Repository

- GitHub: `asktheeightball/unimap`
- Current documented working branch: `claude/unimap-static-app-uj0ql5`
- Important: this branch is currently configured as the repository default branch. Confirm the intended long-term branch strategy before changing deployment settings or creating automation.

## Current implementation

- `index.html` contains the semantic page structure.
- `styles.css` contains presentation and responsive styling.
- `app.js` loads data, manages state, filters results, and renders browse/detail views.
- `celestial-bodies.json` contains the catalogue.
- `README.md` explains local running and basic static deployment.
- Project-control documents define product scope, priorities, roadmap, decisions, deployment, and contributor instructions.

## Current functional behavior

The existing application is documented to provide:

- case-insensitive partial-name search;
- category filters;
- result counts and a no-results state;
- Clear Search;
- keyboard-accessible results;
- detail view and Back navigation;
- preserved query/category/results when returning;
- responsive phone, tablet, and desktop layout;
- a visible data-load error.

## Current priority

Read `PRIORITY.md`. At the time this handoff was created, the next task is:

**P0 — Verify the static baseline and full dataset migration.**

The current JSON appears smaller than the original supplied prototype dataset, so the first task is reconciliation and validation rather than adding new features.

## Local start

From the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Do not test by double-clicking `index.html`; browser `file://` security prevents the JSON fetch.

## Safe-start procedure for a new session

1. Confirm repository and current branch.
2. Run `git status --short --branch`.
3. Run `git fetch --all --prune`.
4. Do not discard uncommitted changes.
5. Read all root Markdown files.
6. Inspect the actual implementation before trusting status claims.
7. Start the highest-ranked item in `PRIORITY.md`.
8. Keep the static, dependency-free architecture unless an approved decision says otherwise.

## End-of-session update template

Replace or append this section after meaningful work:

### Last session

- Date:
- Branch:
- Starting commit:
- Ending commit:
- Task selected:
- Status:
- Files changed:
- Validation performed:
- Deployment performed:
- Known issues:
- Next priority:
- Uncommitted files:

## Known cautions

- The dataset values are educational source data and have not been comprehensively validated for scientific accuracy.
- `size` and `circumference` are not semantically consistent across all celestial-body types.
- Do not silently correct or normalize source values during unrelated work.
- Do not introduce dependencies for functionality that can be implemented clearly in a few lines of native browser code.
