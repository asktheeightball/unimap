# UniMap

UniMap is a small static web app for browsing a catalogue of 208 celestial bodies —
stars, planets, exoplanets, dwarf planets, nebulae, galaxies, star clusters, black
holes, neutron stars and pulsars. Search by name, filter by category, and open any
result to see its type, distance, size and circumference. A timed quiz mode with five difficulties builds
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
│   ├── derive_quiz_fields.py # recover structured quiz fields; set wellKnown
│   ├── fetch_common_names.py # SIMBAD common names -> common-names.json
│   ├── common-names.json     # curated common-name mapping, with provenance
│   ├── enrich_catalogue.py   # apply names; recover classification, mass, orbit
│   ├── search_checks.mjs     # browser checks for search, autocomplete, layout
│   ├── quiz_checks.mjs       # browser checks for quiz content and leaderboards
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

- Search across object names, aliases and catalogue ids, tolerant of
  punctuation, spacing and spelling — see **Searching** below
- Autocomplete suggestions as you type, usable by mouse, touch and keyboard
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
- A sourced description on each object's detail view, where one is available
- A user-facing error message (and a console log) if the dataset cannot be loaded

## Searching

Search runs entirely against the catalogue already loaded in the page. Nothing
is requested while you type, and no search service is involved.

**What is searched.** Each record's `name`, its `commonName`, every entry in its
`aliases` and `catalogueIdentifiers`, and its `id` slug. Punctuation and spacing
are normalized on both sides, so `alf tau` finds `* alf Tau`, `kepler200c` finds
`Kepler-200 c`, and `crabnebula` finds `Crab Nebula`. Descriptions are not
searched — they are long generated prose and matching inside them would return
nearly everything.

**Names and designations.** Many records carry two names: the formal designation
their source uses (`* 51 Peg`) and the recognisable name it publishes alongside
it (`Helvetios`). The common name is what you see; the designation is shown
beside it and both find the object. A common name is ranked as a **name**, not
as an identifier — typing `Sirius` means the object, so it lands in tier 1
rather than tier 3. Alternate names the source also lists are searchable but not
displayed, which is why `Proxima` still finds Proxima Centauri.

**Ranking.** Results are ordered by how well they matched, best first:

1. exact primary name
2. primary-name prefix
3. exact alias or catalogue id
4. alias or catalogue id prefix
5. primary-name substring
6. alias or catalogue id substring
7. fuzzy (spelling-tolerant)

A fuzzy match can never outrank a literal one. With no query the catalogue keeps
its original order. Search always respects the active category filter.

**Spelling tolerance.** Misspellings are matched by edit distance, counting a
swapped pair of letters as a single mistake — so `Betelguese` finds
`Betelgeuse`, `Andromida` finds `Andromeda`, and `Proxima Centari` finds
`Proxima Centauri`. The allowance grows with the length of what you typed and is
switched off entirely below four characters, where almost any short string is a
near-miss for something. When a result was only reached this way, UniMap says
`Did you mean …?` above the results; it never rewrites what you typed on its
own. `DECISIONS.md` D13 records the exact thresholds.

**Suggestions.** After two characters, up to eight suggestions appear under the
input, showing each object's name with its type and, where relevant, the alias
that matched. Arrow Up and Arrow Down move through the list, Enter opens the
highlighted object, Escape closes the list, and Enter with nothing highlighted
runs the search as usual. Clicking or tapping a suggestion opens that object;
the search box keeps its name, so Back returns to a result list containing it.

**When nothing matches**, the page shows what was searched for, a correction if
there is a sensible one — computed without the category filter, since a filter
is often the reason a spelling matched nothing — a few close names, and a Clear
search button.

## Quiz mode

Switch to **Quiz** in the header. Five difficulties set the time allowed per
question:

| Mode | Seconds per question |
|---|---:|
| Effortless | 20 |
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
record's own fields, led by the fact the question actually turned on.

### Difficulty changes the questions, not only the clock

| Mode | What it asks | Drawn from |
|---|---|---|
| Effortless | what an object is, and which object is of a given kind | well-known records with a common name (34) |
| Easy | the same, plus catalogued distance and size | well-known records (85) |
| Medium | how the source classifies an object, plus distance and size | the whole catalogue |
| Hard | discovery year, spectral type, source classification | the whole catalogue |
| Impossible | exact spectral type, exact coordinates — with all four choices from one category | the whole catalogue |

"Well-known" is not a judgement made in `quiz.js`. It is the `wellKnown` flag on
the record, set by `tools/derive_quiz_fields.py` from the curated identifier
lists a maintainer already wrote in `tools/sources.json` — the brightest
naked-eye stars, the Messier and NGC selections, the IAU dwarf planets. Effortless
narrows that further to records whose name is a common name rather than a bare
catalogue designation, so it asks about Betelgeuse rather than NGC 1300.

If a difficulty cannot fill a game from its preferred questions it falls back to
simpler ones **and keeps its own timer** — you never get a short game, and
Impossible never becomes slower. Fallback is recorded in the diagnostics that
`tools/quiz_checks.mjs` asserts against.

### What the generator refuses to ask

Questions come only from structured fields a record actually carries, never from
prose, and anything ambiguous is discarded:

- value questions (distance, size) compare only within one type, because
  `distance` means light years for a galaxy and mean orbital distance in AU for a
  dwarf planet;
- overlapping types are never used as distractors for each other, since a pulsar
  is a neutron star and an exoplanet is a planet;
- a question whose answer is visible in its own prompt is thrown away — "What
  kind of object is the Sombrero Galaxy?" is not a question;
- reverse-classification questions are not asked at all, because nine catalogued
  objects are planetary nebulae and the question would have nine right answers;
- each object supplies at most one question per game, and no prompt repeats.

Two candidate families were implemented, tested and **withdrawn** because this
catalogue cannot support them fairly. Host-star questions ("which star does
Kepler-1176 b orbit?") give the answer away, since the archive names a planet
after its host. Alias questions do the same: the only informative aliases left
are minor-planet designations like "136472 Makemake (2005 FY9)", which embed the
name. Both return when the catalogue carries names that are independent of each
other.

### Leaderboards are stored on your device

Each difficulty keeps its own top-10 leaderboard in `localStorage` under
`unimap.leaderboard.<difficulty>`:

```json
{
  "version": 1,
  "entries": [
    {
      "name": "Player",
      "score": 850,
      "difficulty": "hard",
      "questions": 10,
      "maximumScore": 1000,
      "date": "2026-07-27",
      "completedAt": "2026-07-27T20:15:00.000Z",
      "durationMs": 54213
    }
  ]
}
```

Nothing is uploaded and there is no shared leaderboard. Scores live in one
browser on one device, and clearing browser data removes them — so the quiz
offers **Export backup** and **Import backup**. Export writes every mode's
scores to a single JSON file; import *merges* it into what is already stored
rather than replacing it, and importing the same file twice adds nothing.

Scores written by an earlier version of UniMap were a bare array with no version
and no timestamps. They are migrated in place on first read and are not lost. If
stored data is unreadable, it is moved aside under
`unimap.leaderboard.<difficulty>.corrupt` rather than deleted, the leaderboard
says so, and the game stays playable.

Gameplay makes no network request at all — `app.js` hands the already-loaded
catalogue to `quiz.js`. Answer with a click, a tap, the keyboard, or the number
keys 1–4.

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

### Browser checks

```bash
node tools/search_checks.mjs
```

121 checks driving real Chromium against the real `index.html` over HTTP:
matching and ranking, alias and identifier lookup, spelling correction,
suggestion behaviour, keyboard, mouse and touchscreen interaction, the combobox
ARIA attributes, three phone widths, horizontal overflow, the browse, detail and
quiz regressions, and search performance on both the shipped catalogue and a
synthetic 1,000-record fixture. Exits non-zero on any failure.

```bash
node tools/quiz_checks.mjs
```

105 further checks covering quiz mode: the five timers, that every difficulty
fills a ten-question game, answer-set integrity over 2,000 generated questions,
that no prompt gives away its own answer, the Effortless content rules, that Hard
and Impossible really do draw on different families, same-category distractors,
fallback on a deliberately bare catalogue, explanations, the versioned
leaderboard schema, migration from the old unversioned shape, corruption
recovery, export/import round-trips, a full game played by mouse and keyboard,
persistence across a reload, and the phone layout.

This is optional maintainer tooling. It needs Node and a Playwright install
(`npm install -g playwright`), found wherever it happens to live — the
repository has no `package.json` and no lockfile, and **the site itself still
has no dependencies at all**. Python is used the same way for the importers.

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
`sourceSummary`, `measurementLabel`, `measurementValue`, `sourceName`,
`sourceUrl`, `lastReviewed`, `rightAscension`, `declination`, `image`,
`imageAlt`, `imageCredit`.

Structured quiz fields: `hostName`, `discoveryYear`, `discoveryMethod`,
`spectralType`, and the editorial `wellKnown` flag.

Enrichment fields, each recovered from a response a source actually returned
(`DECISIONS.md` D17), with current coverage of 208 records:

| Field | Type | Meaning | Records |
|---|---|---|---:|
| `classification` | string | SIMBAD's own object-type gloss, distinct from `type` | 132 |
| `commonName` | string | The recognisable name; `name` stays the designation | 91 |
| `massEarth` | string | Best mass estimate in Earth masses (exoplanets) | 59 |
| `catalogueIdentifiers` | string[] | Alternate published names, searchable | 36 |
| `orbitClass` | string | JPL *orbital* class — where a body orbits, not what it is | 5 |
| `discoverer` | string | Who the source credits | 1 |
| `discoveryDate` | string | `YYYY` or `YYYY-MM-DD`, at the source's precision | 1 |
| `discoverySite` | string | Where the source says it was found | 1 |

`classification` and `type` are deliberately separate: SIMBAD calls M 31 an
"active galaxy nucleus" while UniMap files it under Galaxy, which is the
category the filters use. `orbitClass` is never a claim about an object's type.
`massEarth` is named for its unit so it can never be compared against a radius.

### Descriptions

Two fields hold prose, and they are never merged:

- **`summary`** — editorial text a person wrote. **No importer ever touches it**,
  so a rerun cannot overwrite it.
- **`sourceSummary`** — assembled by an importer from values the source actually
  returned. Importer-owned, so a rerun refreshes it.

The detail view prefers `summary` and falls back to `sourceSummary`; a record
with neither shows no paragraph. 197 of 208 records currently carry a
`sourceSummary` and none carries a hand-written `summary`.

A description states what an object is, where it is, and — for exoplanets and
Ceres, the only sources that publish it — how it was discovered. **Why an object
is notable is deliberately absent**: no source supplies it, and it is not
written from recall (`DECISIONS.md` D7 and D12). Adding hand-written `summary`
text is the intended route.

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
