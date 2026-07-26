# UniMap

UniMap is a small static web app for browsing a catalogue of 208 celestial bodies —
stars, planets, exoplanets, dwarf planets, nebulae, galaxies, star clusters, black
holes, neutron stars and pulsars. Search by name, filter by category, and open any
result to see its type, distance, size and circumference. A timed quiz mode builds
questions from the same catalogue.

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
├── quiz.js                # quiz mode: questions, timing, scoring, leaderboards
├── celestial-bodies.json  # the dataset
├── tools/                 # maintainer scripts (never needed to run the site)
│   ├── README.md             # pipeline, probe rule, source limitations
│   ├── sources.json          # source endpoints, queries, curation, attribution
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
- Category filters: All, Stars, Planets, Exoplanets, Dwarf Planets, Moons,
  Nebulae, Black Holes, Neutron Stars, Galaxies, Star Clusters — matching
  tolerates singular and plural type values, pulsars are reached through Neutron
  Stars, and a filter no record can match is hidden rather than left dead
- Result count and a clear no-results message, announced via an ARIA live region
- Clear Search button that resets both the query and the category
- Detail view with name, type, distance, size and circumference, plus a Back button
  that preserves the query, category and result list
- Responsive centered layout for phones, tablets and desktops
- Keyboard-accessible controls with visible focus states
- A user-facing error message (and a console log) if the dataset cannot be loaded

## Quiz mode

Switch to **Quiz** in the header. Four difficulties set the time allowed per
question:

| Mode | Seconds per question |
|---|---:|
| Easy | 15 |
| Medium | 10 |
| Hard | 7 |
| Impossible | 5 |

Each game is 10 questions with four choices and exactly one correct answer. A
correct answer is worth up to 100 points, decreasing continuously to zero as the
timer runs:

```text
points = round(100 × remaining milliseconds ÷ total milliseconds)
```

Incorrect and expired answers score zero, so a game is out of 1000. After each
question the correct answer is shown with a short explanation assembled from the
record's own fields.

Questions are generated only from validated fields that a record actually
carries, and the generator discards anything ambiguous:

- value questions (distance, size) compare only within one type, because
  `distance` means light years for a galaxy and mean orbital distance in AU for a
  dwarf planet;
- overlapping types are never used as distractors for each other, since a pulsar
  is a neutron star and an exoplanet is a planet;
- each object supplies at most one question per game.

Each difficulty keeps its own top-10 leaderboard in `localStorage` under
`unimap.leaderboard.<difficulty>`, recording player name, score, question count
and date. Nothing is uploaded and there is no shared leaderboard. Gameplay makes
no network request at all — `app.js` hands the already-loaded catalogue to
`quiz.js`. Answer with a click, a tap, the keyboard, or the number keys 1–4.

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

**A source must be probed before it may be imported** (`DECISIONS.md` D8). Each
entry carries either `"probe_confirmed": "<date>"` or `"unprobed": true`, and the
importer refuses to import from an unprobed one. Probe it, read the real columns,
write or correct the normalizer against the cached response, then drop the flag.

Curation uses two mechanisms, both editorial decisions recorded in
`sources.json`. Neither invents a value — a name the source does not resolve
simply produces no record:

- `select_identifiers` is substituted into a query's `{identifiers}` placeholder,
  so the service is asked only for the objects UniMap wants.
- `select_names` is an allow-list applied after normalization, for sources that
  cannot be queried by name. It exists because a broad class filter is not a
  claim about an object's type: `sb-class=TNO` returns every trans-Neptunian
  object and only a few are dwarf planets.

Both suppress `--limit`, which could only truncate a curated set.

See `tools/README.md` for per-source limitations and distance semantics.

If TLS verification fails locally (`CERTIFICATE_VERIFY_FAILED`), point the
importer at a CA bundle rather than disabling verification:

```bash
python -m pip install certifi
python -c "import certifi; print(certifi.where())"
python tools/import_catalogue.py --ca-bundle <that path> --source simbad-stars --probe
```

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

Required on every record: `id` (stable, lowercase, hyphenated), `name`, `type`.

Optional: `distance`, `size`, `circumference`, `aliases`, `summary`,
`measurementLabel`, `measurementValue`, `sourceName`, `sourceUrl`,
`lastReviewed`, `rightAscension`, `declination`, `image`, `imageAlt`,
`imageCredit`.

`distance`, `size` and `circumference` are deliberately optional. Many real
objects have no published diameter, and SIMBAD's `basic` table has no distance
column at all — so its galaxies, nebulae, clusters and pulsars carry coordinates
and a classification but no distance. The detail view hides a row rather than
showing a blank or an invented value. See `DECISIONS.md` D10.

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
