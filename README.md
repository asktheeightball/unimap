# UniMap

UniMap is a small static web app for browsing a catalogue of celestial bodies — stars,
planets, nebulae, black holes, neutron stars and galaxies. Search by name, filter by
category, and open any result to see its type, distance, size and circumference.

## Technology stack

- HTML
- CSS
- Vanilla JavaScript (ES modules not required — a single plain script)
- JSON for the dataset

No frameworks, no build step, no package manager, no backend.

## Running it locally

The app fetches `celestial-bodies.json` at startup. Browsers block `fetch` for
`file://` URLs, so opening `index.html` by double-clicking it will show an error
message instead of the catalogue. Serve the folder over any static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Python is only a convenient local server — it is not a dependency of the app. Any
static server works equally well (`npx serve`, `php -S localhost:8000`, a VS Code
live-server extension, etc.).

## Deploying

Because the app is entirely static, deployment is just "publish this folder":

- **GitHub Pages** — Settings → Pages → deploy from a branch, root (`/`) directory.
- **Cloudflare Pages** — connect the repo, leave the build command empty, set the
  output directory to `/`.
- **Netlify** — connect the repo (or drag the folder into the dashboard), leave the
  build command empty, set the publish directory to `/`.

See `DEPLOYMENT.md` for the complete pre-deployment, verification, and rollback runbook.

## File structure

```text
/
├── index.html             # semantic page structure
├── styles.css             # all presentation
├── app.js                 # data loading, state, search, filtering, rendering
├── celestial-bodies.json  # the dataset
├── README.md              # project overview and local setup
├── PRODUCT.md             # product purpose, scope, and architecture guardrails
├── ROADMAP.md             # planned product outcomes
├── PRIORITY.md            # authoritative next-work ordering
├── HANDOFF.md             # current state and session handoff
├── DEPLOYMENT.md          # deployment and rollback runbook
├── DECISIONS.md           # durable product and architecture decisions
└── CLAUDE.md              # Claude Code operating instructions
```

Each record in `celestial-bodies.json` has a stable lowercase `id` slug:

```json
{
  "id": "betelgeuse",
  "name": "Betelgeuse",
  "type": "Star",
  "distance": "~548 ly",
  "size": "445 million km",
  "circumference": "~2.8 billion km"
}
```

## Features

- Case-insensitive, partial-match search by name
- Search button and the Enter key behave identically
- An empty search shows the full catalogue rather than nothing
- Category filters: All, Stars, Planets, Nebulae, Black Holes, Neutron Stars,
  Galaxies — matching tolerates singular and plural type values
- Result count and a clear no-results message, announced via an ARIA live region
- Clear Search button that resets both the query and the category
- Detail view with name, type, distance, size and circumference, plus a Back button
  that preserves the query, category and result list
- Responsive centered layout for phones, tablets and desktops
- Keyboard-accessible controls with visible focus states
- A user-facing error message (and a console log) if the dataset cannot be loaded

## Project workflow

Before starting work, read the root documentation in this order:

1. `PRODUCT.md`
2. `PRIORITY.md`
3. `ROADMAP.md`
4. `HANDOFF.md`
5. `DECISIONS.md`
6. `DEPLOYMENT.md`
7. `CLAUDE.md`

`PRIORITY.md` is the authoritative source for what to work on next. Update
`HANDOFF.md` at the end of every meaningful work session.
