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
| `derive_quiz_fields.py` | recover structured quiz fields from importer prose; set `wellKnown` |
| `search_checks.mjs` | browser checks for search, autocomplete and layout (Node + Playwright) |
| `quiz_checks.mjs` | browser checks for quiz content and leaderboards (Node + Playwright) |

## Structured quiz fields

`derive_quiz_fields.py` exists because an earlier revision of `import_catalogue.py`
fetched `hostname`, `disc_year`, `discoverymethod` and `sp_type` and then wrote
them only into the generated `sourceSummary` sentence. The values were real —
retrieved from a real source, so D7 is satisfied — but they were serialised into
prose instead of into fields, and quiz mode generates questions only from fields.

Re-running the import would have been the natural fix; every astronomy host is
refused by the sandbox network policy, so the values were recovered from what was
already committed. This is **not** prose parsing:

- `sourceSummary` is emitted by our own importer from a fixed template in this
  repository, not written by a human;
- the tool reverses that exact template and then re-renders the whole sentence
  from the captured values, requiring it to equal the stored string byte for
  byte;
- a record that does not reproduce exactly is reported and left untouched —
  nothing is guessed, inferred or rounded;
- `hostName` is additionally corroborated against the `"<host> system"` alias the
  importer stored separately;
- `spectralType` needs no reversal at all: the importer already stored it as a
  structured `"Spectral type G2IV"` alias.

`import_catalogue.py` now writes all four fields directly, so a future import
does not need this tool. It stays because it documents how the committed values
were recovered, and re-running it verifies them.

The same tool sets `wellKnown`, the only editorial flag in the catalogue. It is
not a fact about the sky — it marks a record a maintainer already chose by name
in a `select_identifiers` or `select_names` list here, or through that list's
`id_overrides`, plus the solar-system planets and the Sun. Quiz mode's Effortless
difficulty draws from it. 85 of 208 records qualify.

```bash
python3 tools/derive_quiz_fields.py --dry-run   # report, write nothing
python3 tools/derive_quiz_fields.py             # write the catalogue
```

Both are idempotent and exit non-zero if any record is refused.

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

| Source id | Produces | Records | Status |
|---|---|---:|---|
| `exoplanet-archive` | Exoplanet | 60 | Confirmed 2026-07-26 |
| `simbad-notable-stars` | Star | 67 | Confirmed 2026-07-26 |
| `simbad-galaxies` | Galaxy | 27 | Confirmed 2026-07-26 |
| `simbad-nebulae` | Nebula, Star Cluster | 26 | Confirmed 2026-07-26 |
| `simbad-pulsars` | Pulsar | 14 | Confirmed 2026-07-26 |
| `jpl-sbdb-dwarf-planets` | Dwarf Planet | 4 | Confirmed 2026-07-26 |
| `jpl-sbdb-ceres` | Dwarf Planet | 1 | Confirmed 2026-07-26 |
| `simbad-stars` | Star | — | **Probe first** (superseded by `simbad-notable-stars`) |
| `simbad-black-holes` | Black Hole | — | **BLOCKED** — probed and rejected |
| `jpl-satellites` | Moon | — | **BLOCKED** — endpoint returned HTTP 404 |

### Confirmed response shapes

**SIMBAD TAP** returns `{"metadata": [...], "data": [[...]]}`. `metadata` gives
each column's `name`, `datatype` and `unit`. Confirmed columns:

| Column | Type | Unit |
|---|---|---|
| `main_id` | CHAR | — |
| `ra` | DOUBLE | deg |
| `dec` | DOUBLE | deg |
| `otype_txt` | CHAR | — |
| `plx_value` (star query only) | DOUBLE | mas |
| `sp_type` (star query only) | CHAR | — |

There is **no distance column**. Star distance is derived as `1000 / plx_value`
parsecs; everything else carries no distance.

`main_id` is space-padded (`"M  31"`, `"*  51 Peg"`) and may carry a leading
kind marker (`NAME `, `V* `, `** `, `* `). The importer collapses the whitespace,
strips the marker for display, and keeps the full identifier as an alias. It
never translates a designation into a common name — `* alf CMa` becomes
`alf CMa`, never `Sirius`.

**JPL `sbdb.api`** returns a nested document with top-level keys `discovery`,
`object`, `orbit`, `phys_par` and `signature` — not a row table. Sources using it
set `"response": "object"` and the whole payload goes to the normalizer. Values
used for Ceres: `object.fullname`, the `orbit.elements` entry named `a`
(2.77, units `au`), and the `phys_par` entry named `diameter` (939.4, units
`km`). Units are read from the response; a value in an unexpected unit is
skipped, not reinterpreted.

**JPL `sbdb_query.api`** returns `{"fields": [...], "data": [[...]]}`.

### Classification mapping

A curated list decides which objects to ask for. **Only the source decides what
they are.** `OTYPE_TO_TYPE` in `import_catalogue.py` maps SIMBAD `otype_txt`
codes onto UniMap types, and every code in it was observed in a cached response.
An unmapped code skips the row.

`OTYPE_REFUSED` records codes seen in a real response that are deliberately not
mapped, with the reason: `BLL`, `ISM`, `sh`, `HXB`, `X`.

This mapping is why nine objects requested from the nebula list — M 8, M 16,
M 20, IC 1396, NGC 2264, NGC 6618, NGC 2024, NGC 2237, NGC 7000 — are imported as
Star Clusters. SIMBAD types them `OpC` or `Cl*`.

### Generated descriptions

Importers assemble a `sourceSummary` from values the source returned, using
`describe()`, which joins sentence fragments and silently drops any whose value
is missing. A source that starts returning a new field extends its description by
adding one fragment.

| Source | Description covers |
|---|---|
| Exoplanet archive | Host star, system distance, radius, best mass estimate, discovery year and method |
| SIMBAD stars | Classification gloss, spectral type, parallax-derived distance, J2000 coordinates |
| SIMBAD deep-sky | Classification gloss, J2000 coordinates, and a plain statement that no distance is published |
| JPL bulk | Mean orbital distance, orbit class, diameter (or that none is measured) |
| JPL single object | The above plus the discovery sentence, used verbatim |

`sourceSummary` is importer-owned and listed in `MANAGED_FIELDS`, so a rerun
refreshes it. `summary` is **not** managed: it holds hand-written prose that an
importer must never overwrite. See `DECISIONS.md` D12.

**"Why an object is notable" is not generated.** No response carries anything
supporting it. Do not add a fragment that asserts significance — that is
authoring a claim, not rendering a value.

### Editorial overrides

`id_overrides` maps a SIMBAD `main_id` onto a record UniMap already carries, so
an import refreshes that record instead of adding a duplicate under a catalogue
designation. It supplies only an id and the existing record's own name — never a
value. Eight are configured, e.g. `M 31` → `andromeda`, `* alf CMa` →
`sirius-a`.

### Known source limitations

- **Black holes cannot be imported from SIMBAD.** `simbad-black-holes` was
  probed and rejected. Of its 13 rows, 9 are `HXB` (high-mass X-ray binary) and
  the rest are `BLL` (3C 273), `AGN` (M 87), `Sy2` (M 106) and `X` (Sgr A*).
  Not one is typed as a black hole, because SIMBAD types these objects by what
  is *observed* — the black hole is an inference from the system's dynamics.
  Importing them as `Black Hole` would assert a classification the source does
  not make. **Do not unblock this by widening `OTYPE_TO_TYPE`.** It needs an
  authoritative catalogue of dynamically confirmed masses, or a curated list
  carrying its own documented per-object evidence.
- **Moons are deferred.** `sat_phys_par.api` returned HTTP 404 and is not a
  current JPL API. A replacement must be probed, and must settle the distance
  question first: a moon's orbital distance is measured from its *parent
  planet*, a third semantic alongside light years and AU, and must be labelled
  with the parent body or it is misleading.
- **Deep-sky objects have no distance**, and this is a property of the source,
  not a gap to be filled in. 60 of 208 records carry none.
- **Nebulae came in at 17**, below the 20-30 target, because nine requested
  objects are clusters. Closing that gap needs more curated objects, not a
  looser mapping.
- **`simbad-stars` is superseded.** The parallax-sweep query was never probed;
  `simbad-notable-stars` supplies stars by curated identifier instead.
- **`attribution` and `terms` strings are unverified** — the documentation sites
  were unreachable. Confirm them against each service's current terms page
  before publishing a catalogue built from these sources.

## Distance semantics

`distance` is a display string, and the quantity behind it is **not** the same
across types. Each record says which it is:

| Type | Quantity |
|---|---|
| Star | Distance from Earth in light years, derived from parallax |
| Galaxy, nebula, cluster, pulsar | **No distance** — the source supplies none |
| Dwarf planet | Mean orbital distance from the Sun in AU |
| Moon | Orbital distance from its parent planet |

Do not compare them numerically, and do not generate quiz questions that assume
they are comparable.
