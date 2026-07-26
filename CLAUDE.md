# Claude Code Instructions for UniMap

## Mission

Maintain and improve UniMap as a very small, understandable static web application.

## Required reading order

Before changing code, read:

1. `PRODUCT.md`
2. `PRIORITY.md`
3. `ROADMAP.md`
4. `HANDOFF.md`
5. `DECISIONS.md`
6. `DEPLOYMENT.md`
7. `README.md`
8. The implementation files relevant to the task

Documentation is guidance, not proof. Verify claims against the repository before acting.

## Safe start

At the beginning of every coding session:

```bash
git status --short --branch
git remote -v
git fetch --all --prune
git log -5 --oneline --decorate
```

Then:

- identify the current branch and its upstream;
- preserve all uncommitted work;
- do not reset, clean, checkout, delete, or overwrite files unless explicitly authorized;
- confirm the highest-ranked active task in `PRIORITY.md`;
- report any conflict between code and documentation before implementation.

## Architecture constraints

The approved stack is:

- HTML
- CSS
- Vanilla JavaScript
- JSON

Do not introduce any of the following unless the user explicitly approves a documented architecture change:

- React, Vue, Svelte, Angular, Astro, Next.js, or another framework
- TypeScript
- npm or another package manager
- runtime dependencies
- a bundler or build step
- a backend
- a database
- authentication
- a hosted search service
- a component or CSS library

Prefer native browser APIs and small named functions.

## Coding standards

- Keep semantic page structure in `index.html`.
- Keep presentation in `styles.css`.
- Keep catalogue records in `celestial-bodies.json`.
- Keep behavior and state in `app.js`.
- Avoid inline styles and inline event handlers.
- Use accessible native controls.
- Preserve visible focus states.
- Escape or assign user/data text with `textContent`, not unsafe HTML.
- Handle missing or malformed optional values without crashing.
- Keep functions focused and names descriptive.
- Do not create abstractions until repeated code or complexity justifies them.
- Do not rewrite unrelated code while implementing a small feature.

## Data rules

- Every celestial-body record must have a unique stable lowercase `id`.
- Preserve supplied values during structural work.
- Do not silently correct scientific values.
- Do not assume `size` has the same meaning across object types.
- Report duplicates, omissions, and questionable data before changing them.
- Keep JSON valid and human-readable.

## Priority protocol

When asked to do the next task:

1. Select the highest-ranked unblocked item in `PRIORITY.md`.
2. State which item was selected and why.
3. Inspect the relevant code and data.
4. Implement the smallest complete solution.
5. Validate it fully.
6. Update `PRIORITY.md`, `ROADMAP.md`, and `HANDOFF.md` as needed.
7. Record durable architecture changes in `DECISIONS.md`.

Do not invent a new priority when an active one exists.

## Validation

Run the site through a static HTTP server:

```bash
python -m http.server 8000
```

Do not validate by opening `index.html` via `file://`.

For changes affecting the application, check as applicable:

- JSON parses successfully;
- page loads without console errors;
- initial catalogue renders;
- exact and partial search work;
- empty search behavior matches documentation;
- each category filter works;
- no-results state is clear;
- Clear Search works;
- detail view works;
- Back preserves browse state;
- keyboard interaction works;
- focus is visible and logical;
- narrow mobile layout remains usable;
- data-load failure produces a visible error.

Use existing browser automation if available. Do not add a testing framework solely for a small change.

## Git and GitHub rules

- Keep commits focused.
- Do not commit, push, merge, deploy, rename branches, or change the default branch unless explicitly instructed.
- Never force-push without explicit authorization.
- Never commit secrets, local server files, editor state, or generated clutter.
- Before committing, report changed files and validation results.
- Suggested commit format: imperative and specific, for example `Validate catalogue migration`.

## Documentation completion

At the end of meaningful work, update `HANDOFF.md` with:

- branch and commits;
- task and status;
- files changed;
- validation performed;
- deployment status;
- known issues;
- next priority;
- uncommitted work.

Documentation changes are part of task completion, not optional cleanup.

## Final response format

Report:

1. selected priority;
2. what changed;
3. files changed;
4. validation performed and results;
5. known limitations;
6. repository status;
7. next priority;
8. suggested commit message when not already committed.
