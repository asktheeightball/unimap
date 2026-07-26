# UniMap maintainer tools

Development scripts only. **The site never needs them.** UniMap stays a static
folder of HTML, CSS, JavaScript and JSON with no runtime dependencies, and the
browser never contacts an astronomy service. External APIs are used here, at
import time, and nowhere else (`DECISIONS.md` D6 and D7).

Everything here uses only the Python standard library.

## Pipeline

```text
authoritative source  ->  tools/cache/            raw response, kept for audit
                      ->  tools/staging/          normalized records, validated
                      ->  celestial-bodies.json   (only via promote_staging.py)
```

`import_catalogue.py` never writes the production catalogue. Promotion is a
separate, deliberate step that validates the merged result and backs up the
previous catalogue.

## Scripts

| Script | Purpose |
|---|---|
| `sources.json` | Source endpoints, queries, curation lists, attribution |
| `import_catalogue.py` | fetch → cache → probe/normalize → stage |
| `promote_staging.py` | validate merged result, then write the catalogue |
| `validate_catalogue.py` | standalone catalogue validation |

## Probe before you import

A source's column names are not knowable in advance, and a wrong guess does not
fail loudly — it produces plausible records carrying a real source's name. That
is fabricated provenance, the one outcome this pipeline exists to prevent.

So every source carries one of two markers:

- `"probe_confirmed": "<date>"` — a real response has been inspected and the
  normalizer was written or corrected against it.
- `"unprobed": true` — nobody has ever seen a response. **The importer refuses
  to import from it and allows only `--probe`.**

The workflow for any new or changed source:

```bash
python3 tools/import_catalogue.py --source <id> --probe --refresh
```

Read the real columns in the probe output and in the cached response under
`tools/cache/`. Write or correct the normalizer against that file. Then remove
`"unprobed"` from `sources.json` and add `"probe_confirmed"`.

A source may legitimately carry `"normalizer": null` until it has been probed —
that is the point. `--probe` deliberately runs before the normalizer is
resolved.

## Curation

Two mechanisms restrict what a source contributes. Both are editorial decisions
recorded in `sources.json` and reviewable in a diff. Neither invents a value:
every field in the resulting record still comes from the source, and a name the
source does not resolve simply produces no record.

- **`select_identifiers`** — substituted into a query's `{identifiers}`
  placeholder as a quoted list, so the service is asked only for the objects
  UniMap wants. Preferred: it keeps curated imports small and is polite to a
  shared service. Suppresses `--limit`, which could only truncate the curated
  set.
- **`select_names`** — an allow-list applied *after* normalization, for sources
  that cannot be queried by name. This exists because a broad class filter is
  not a claim about an object's type: `sb-class=TNO` returns every
  trans-Neptunian object and only a few are dwarf planets. Also suppresses
  `--limit`.

## Commands

```bash
# what is configured, and what still needs probing
python3 tools/import_catalogue.py --list

# inspect a real response without importing
python3 tools/import_catalogue.py --source <id> --probe --refresh

# normalize without writing a staging file
python3 tools/import_catalogue.py --source <id> --dry-run

# stage a confirmed source
python3 tools/import_catalogue.py --source <id>

# validate
python3 tools/validate_catalogue.py
python3 tools/validate_catalogue.py tools/staging/<id>.staged.json

# promote
python3 tools/promote_staging.py --dry-run
python3 tools/promote_staging.py
```

## TLS

If TLS verification fails locally (`CERTIFICATE_VERIFY_FAILED`, common on
Windows where Python cannot find a system trust store), point the importer at a
real CA bundle. **Never disable verification.**

```bash
python -m pip install certifi
python -c "import certifi; print(certifi.where())"
python tools\import_catalogue.py --ca-bundle "<CERTIFI_PATH>" --source simbad-stars --probe --refresh
```

## Configured sources

| Source id | Produces | Status |
|---|---|---|
| `exoplanet-archive` | Exoplanet | Confirmed 2026-07-26 |
| `jpl-sbdb-dwarf-planets` | Dwarf Planet | Confirmed 2026-07-26 |
| `simbad-stars` | Star | **Probe first** |
| `simbad-notable-stars` | Star | **Probe first** |
| `simbad-galaxies` | Galaxy | **Probe first** |
| `simbad-nebulae` | Nebula | **Probe first** |
| `simbad-pulsars` | Neutron Star, Pulsar | **Probe first** |
| `simbad-black-holes` | Black Hole | **Probe first** |
| `jpl-sbdb-ceres` | Dwarf Planet | **Probe first**, no normalizer yet |
| `jpl-satellites` | Moon | **Probe first**, no normalizer yet |

### Known source limitations

- **SIMBAD has never returned a response to this project.** Every column name in
  the SIMBAD entries is an assumption from its documented `basic` table. The
  `ident`/`basic` join used by the curated sets is also unconfirmed.
- **`jpl-sbdb-ceres` uses a different endpoint**, not a different query.
  `sbdb.api` returns a nested `{object, orbit, phys_par}` document, not the
  `{fields, data}` table shape, so `rows_from_payload` cannot read it and
  `jpl_sbdb` cannot normalize it. It needs its own normalizer, written against a
  real probe.
- **Deep-sky distance is unsolved.** SIMBAD's `basic` table has no distance
  column. Star distance is derived from parallax (`1000/plx` parsecs), but
  galaxies and nebulae have no useful parallax. Their distance must come from a
  confirmed field whose units and semantics are read off a real probe.
- **Black holes may not be importable as a category.** SIMBAD types these
  objects by what is observed (`HighMassXBin`, `AGN`, `Seyfert`), not as black
  holes, because the black hole is an inference from the system's dynamics.
  Stamping every row `Black Hole` would assert a classification the source does
  not make. Decide after probing; do not force the category.
- **Moon distance semantics differ again.** A moon's orbital distance is from
  its *parent planet*, not from the Sun or Earth, and must be labelled with the
  parent body or it is misleading beside a galaxy's light-year distance. Confirm
  the physical-parameters endpoint even carries an orbital radius.
- **`attribution` and `terms` strings are unverified** — the documentation sites
  were unreachable too. Confirm them against each service's current terms page
  before publishing a catalogue built from these sources.

## Distance semantics

`distance` is a display string, and the quantity behind it is **not** the same
across types. Each record says which it is:

| Type | Quantity |
|---|---|
| Star, deep-sky | Distance from Earth in light years |
| Dwarf planet | Mean orbital distance from the Sun in AU |
| Moon | Orbital distance from its parent planet |

Do not compare them numerically, and do not generate quiz questions that assume
they are comparable.
