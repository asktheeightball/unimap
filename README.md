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
├── tools/                 # maintainer scripts (never needed to run the site)
│   ├── sources.json          # source endpoints, queries, attribution
│   ├── import_catalogue.py   # fetch -> cache -> normalize -> stage
│   ├── promote_staging.py    # validate, then update the catalogue
│   ├── validate_catalogue.py # standalone catalogue validation
│   ├── cache/                # raw API responses (git-ignored)
│   └── staging/              # generated staging JSON (git-ignored)
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

## Maintaining the catalogue

`tools/` holds development scripts. They use only the Python standard library, and
**the site never needs them** — UniMap stays a static folder of HTML, CSS,
JavaScript and JSON with no runtime dependencies. External astronomy services are
contacted only here, at import time, never from the browser. See `DECISIONS.md`
D6 and D7.

### The pipeline

```text
authoritative source  ->  tools/cache/     raw response, kept for audit
                      ->  tools/staging/   normalized records, validated
                      ->  celestial-bodies.json   (only via promote_staging.py)
```

`import_catalogue.py` never writes the production catalogue. Promotion is a
separate, deliberate step that validates the merged result first and backs up the
previous catalogue.

### Validate

```bash
python3 tools/validate_catalogue.py
```

Checks JSON syntax, unique lowercase ids, required fields, category values the
interface can actually reach, duplicate names, alias collisions and local image
references, then prints totals by category. Exits non-zero on any error.

### Import

```bash
python3 tools/import_catalogue.py --list
python3 tools/import_catalogue.py --source exoplanet-archive --probe
python3 tools/import_catalogue.py --source exoplanet-archive --limit 50
python3 tools/import_catalogue.py --all --limit 40
```

Sources are declared in `tools/sources.json` — endpoint, query, attribution and
which normalizer converts its rows. `--probe` fetches a source and reports the
real response shape without importing; run it first against any new or changed
source. Responses are cached, so reruns do not refetch unless you pass
`--refresh`.

### Promote

```bash
python3 tools/promote_staging.py --dry-run
python3 tools/promote_staging.py
```

Promotion refuses to write unless the merged catalogue validates. It preserves
hand-curated fields and records, refuses to overwrite a record owned by a
different source, produces deterministic output, and backs the previous
catalogue up to `celestial-bodies.json.bak`.

### Record schema

Required on every record: `id` (stable, lowercase, hyphenated), `name`, `type`,
`distance`.

Optional: `size`, `circumference`, `aliases`, `summary`, `measurementLabel`,
`measurementValue`, `sourceName`, `sourceUrl`, `lastReviewed`, `rightAscension`,
`declination`, `image`, `imageAlt`, `imageCredit`.

`size` and `circumference` are deliberately optional — many real objects have no
published diameter, and the detail view hides a row rather than showing a blank
or an invented value.

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
