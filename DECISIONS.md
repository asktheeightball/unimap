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

## D6 — Use external astronomy APIs at import time only, via `tools/`

Status: **Accepted**

Decision:

Catalogue growth happens through maintainer-run import scripts in `tools/` that write reviewed records into `celestial-bodies.json`. The browser application continues to fetch nothing but its own local JSON.

Sources are declared in `tools/sources.json`; `tools/import_catalogue.py` fetches and stages them, and `tools/promote_staging.py` is the only script that writes the catalogue.

Three sources are configured:

| Source | Produces | Why |
|---|---|---|
| NASA Exoplanet Archive TAP | Exoplanet | No key, documented ADQL endpoint, one row per confirmed planet in `pscomppars`, carries distance and radius directly |
| SIMBAD TAP | Star | Authoritative identifiers and coordinates; restricted to objects with a measured parallax so distance is derived from a published value |
| NASA/JPL Small-Body Database | Dwarf Planet | Public JSON query API covering solar-system bodies with measured diameters |

VizieR was evaluated and deferred: it is a catalogue-of-catalogues, so each table needs its own column mapping and curation decision, which is more valuable once the simpler sources are flowing. The NASA Image and Video Library belongs to R4 (images), not to this priority.

Scripts must use only the Python standard library. Python is a development tool, never an application runtime dependency; the site remains deployable as a static folder.

Rationale:

- Page views stay fast, offline-capable, and free of third-party availability risk.
- Provenance is captured once, at review time, instead of being re-derived per visit.
- A rerunnable script keeps the catalogue refreshable without a build system.

Consequences:

- Imports require network access that the current sandbox denies (see P0 blocker).
- Each importer owns a declared set of fields and must preserve curated ones.
- Importers validate their output before replacing the catalogue.
- Adding a source means adding a script, not a runtime dependency.

## D6a — `size` and `circumference` are optional

Status: **Accepted** (refines D6)

Decision:

A record requires only `id`, `name`, `type` and `distance`. `size` and `circumference` are optional, and the detail view hides a row whose value is absent.

Rationale:

- SIMBAD's basic table has no radius; requiring `size` would mean inventing one, which D7 forbids.
- Many small bodies have no measured diameter.
- A hidden row reads as "not measured"; a blank row reads as a bug.

Consequences:

- The validator no longer requires those two fields.
- `[hidden] { display: none !important; }` is needed in `styles.css` because an explicit `display` otherwise beats the UA stylesheet.
- Existing records are unaffected — they keep both fields.

## D7 — Never fabricate catalogue values or provenance

Status: **Accepted**

Decision:

A record's values and its `sourceName`/`sourceUrl` must come from a source that was actually retrieved. Records are not authored from model recall, and attribution is never attached to a value that did not come from the cited source. Derived numbers (unit conversions, a circumference computed from a radius) are permitted, must be arithmetic on a published value, and must be labelled as approximate.

Rationale:

- UniMap is educational; a plausible-looking wrong number is worse than a missing one.
- False attribution is unfixable later because it looks verified.
- Quiz mode (R2) will generate questions from these fields, multiplying any error.

Consequences:

- Catalogue growth is gated on real source access, not on effort available.
- A field with no supporting source is left absent rather than estimated.
- Where a source is missing, the record carries no provenance and the validator warns.

## D8 — A source must be probed before it may be imported

Status: **Accepted** (refines D6 and D7)

Decision:

Every entry in `tools/sources.json` carries either `"probe_confirmed": "<date>"`
or `"unprobed": true`. The importer refuses to import from an unprobed source
and permits only `--probe`. A source may carry `"normalizer": null` until it has
been probed, and `--probe` runs before the normalizer is resolved.

Rationale:

A normalizer written from assumed column names does not fail loudly. Missing
columns normalize into records that look finished and carry a real service's
`sourceName` and `sourceUrl` — fabricated provenance, which D7 forbids and which
is unfixable later because it looks verified. The 2026-07-26 JPL probe already
proved the risk is real: `sb-class=TNO` would have labelled hundreds of small
bodies "Dwarf Planet".

The gate converts that risk into a refusal at the one point where a human is
present.

Consequences:

- Adding a source is a two-step job: define and probe, then normalize and
  import. The definition can be written and reviewed before network access
  exists.
- `--all` reports unprobed sources as failures. That is intended.
- Removing `"unprobed"` is the reviewable moment where someone asserts they read
  the real response.

## D9 — Category filters may ship ahead of their data

Status: **Accepted**

Decision:

`app.js` may map a category filter to record types the catalogue does not yet
contain. `hideEmptyCategories()` hides any chip no record can match, so an
unpopulated category is invisible rather than a dead control. `Moon`, `Pulsar`
and `Star Cluster` are registered in `CATEGORY_TYPES` and in the validator's
`KNOWN_TYPES` ahead of the data.

A pulsar is a neutron star, so both types are reached through the single
`Neutron Stars` filter rather than splitting the interface. Records keep
whichever of the two types their source reports; the filter does not rewrite a
classification.

Rationale:

- The validator rejects a type no filter can reach, so an import would otherwise
  fail at promotion time on a category the interface simply had not been told
  about yet.
- Registering the categories first lets a catalogue slice be imported and
  promoted without an interface change in the same step.
- The type still comes from the source. The filter is a view over types, not an
  assertion about an object.

Consequences:

- A category with no records shows no chip; the filter appears when data does.
- Adding a type means updating `CATEGORY_TYPES` and `KNOWN_TYPES` together.

## D10 — `distance` is optional, and classification comes only from the source

Status: **Accepted** (refines D5, D6a and D7)

Decision:

`distance` is no longer a required field. A record requires only `id`, `name` and
`type`.

An imported record's `type` is derived from the source's own classification, never
from the curated list that selected it. For SIMBAD that means `otype_txt` mapped
through an explicit allow-list of codes observed in a real response
(`OTYPE_TO_TYPE` in `tools/import_catalogue.py`); an unmapped or refused code
skips the row.

Rationale:

The 2026-07-26 probes settled both questions with evidence:

- The SIMBAD deep-sky queries return `main_id`, `ra`, `dec` and `otype_txt` and
  **no distance column at all**. SIMBAD's `basic` table has none, and galaxies
  and nebulae have no useful parallax. Requiring `distance` would have forced
  either an invented value (forbidden by D7) or the loss of every deep-sky
  record. 60 of 208 records now legitimately have no distance.
- The curated nebula list asked for 28 famous objects and SIMBAD typed nine of
  them as clusters (`OpC`, `Cl*`) — M 8, M 16, M 20, NGC 7000 among them. Had
  the source's `produces` field decided the type, the catalogue would assert
  that four open clusters are nebulae.

Consequences:

- The detail view hides an absent distance row; a result row shows the type
  alone rather than `undefined`.
- A source may produce more than one type, and `simbad-nebulae` does.
- Quiz mode compares a field only within one type, because `distance` is light
  years for deep-sky objects and mean orbital distance in AU for dwarf planets.
- Adding an otype code is a reviewable edit backed by a cached response, not a
  convenience. In particular, `simbad-black-holes` must not be unblocked by
  widening the map: its rows are typed `HXB`, `AGN`, `Sy2`, `BLL` and `X`, and
  none of those is a black-hole classification.

## D11 — Quiz mode lives in `quiz.js` and generates questions from validated fields

Status: **Accepted**

Decision:

Quiz behaviour lives in `quiz.js`, a second plain script beside `app.js`. It
receives the catalogue from `app.js` through a `unimap:data` DOM event and makes
no request of its own. `app.js` owns which top-level section is visible and
announces changes with `unimap:mode`; `quiz.js` owns everything inside the quiz
panel.

Questions are generated only from fields a record actually carries, and a
question is discarded unless exactly one option can be correct:

- Value questions (`distance`, `size`) compare within a single type only.
- Overlapping types are never used as distractors for each other, because a
  pulsar *is* a neutron star and an exoplanet *is* a planet.
- One question per object per game.

Rationale:

- A separate file keeps browse logic readable; it is still vanilla JavaScript
  with no build step, framework or package manager, so D1 holds.
- Handing the already-loaded catalogue over keeps gameplay free of network
  dependency (D6) and avoids fetching the JSON twice.
- Generated questions multiply any data defect, so the generator refuses
  anything ambiguous rather than producing a question with two right answers.

Consequences:

- Classic scripts share one global scope, so `quiz.js` must not redeclare
  `app.js` top-level names. It uses `ui` and `attachQuizHandlers` for that
  reason.
- Leaving the quiz cancels the running timer, or it would keep counting down and
  auto-reveal an answer while the browse view is on screen.
- Leaderboards are per-difficulty `localStorage` keys
  (`unimap.leaderboard.<difficulty>`), top 10 each. Storage failure degrades to
  "no scores" rather than breaking the game.
- A shared global leaderboard is still out of scope: it needs hosted writes,
  anti-cheat and privacy decisions.

## D12 — Descriptions are assembled from source values; "why it is notable" is not

Status: **Accepted** (refines D7)

Decision:

Records carry two separate description fields, and an importer owns only one of
them:

- **`summary`** — editorial prose a person wrote. An importer never reads,
  writes, merges or overwrites it. It is absent from `MANAGED_FIELDS`.
- **`sourceSummary`** — assembled by an importer from values the source actually
  returned, via `describe()`, which joins sentence fragments and drops any whose
  value is missing. It is importer-owned, so a rerun refreshes it.

The detail view prefers `summary` and falls back to `sourceSummary`. A record
with neither renders no paragraph at all.

**"Why an object is notable" is deliberately not generated.** No cached response
carries anything supporting it.

Rationale:

- The roadmap's four questions are not equally answerable. "What is it", "where
  is it" and "how was it discovered" are all in the retrieved data; "why is it
  notable" is a judgement no field encodes.
- Assembling retrieved values into prose is rendering, the same as formatting a
  parallax into a distance string. Writing that an object is *famous* or
  *important* would be authoring a claim, which D7 forbids.
- Two fields rather than one because the promoter's guarantee that hand-written
  text survives a rerun is worth keeping. Putting generated prose in `summary`
  would have silently broken it the first time someone wrote a real description.

Consequences:

- 197 of 208 records carry a `sourceSummary`. The 11 without are hand-authored
  originals with no provenance to generate one from.
- Filling the notability gap needs either a new authoritative source or
  hand-written `summary` text. The schema and the rendering are already ready for
  it; nothing further has to change to start writing them.
- A source that begins returning a new field can extend its description by adding
  one fragment, because `describe()` drops fragments whose value is absent.

## D13 — Search ranks in tiers over a local index; fuzzy matching is a last resort

Status: **Accepted**

Decision:

Search is a tiered ranking over an in-memory index built once from the loaded
catalogue. No search service, index format, or dependency is introduced, and no
request is made while typing.

**Indexed fields.** Per record: `name`, every entry in `aliases`, and the `id`
slug. This catalogue has no `sourceRecordId` field — `id` and `aliases` are the
identifier fields the schema actually defines, so those are what search covers.
Descriptions (`summary`, `sourceSummary`) are deliberately *not* indexed: they
are long generated prose, and matching inside them would make almost every
query return almost every record.

**Normalization.** Each indexed string is stored twice — a spaced form and a
space-free form — after Unicode decomposition, dropping combining marks,
flattening Unicode dashes and quotes to ASCII, lowercasing, and reducing every
remaining non-alphanumeric run to a single space. This is what makes `* alf Tau`
reachable as `alf tau`, `Kepler-200 c` reachable as `kepler200c`, and
`136199 Eris (2003 UB313)` reachable as typed. Records are never mutated; the
index holds references, and every displayed value still comes from the record.

**Ranking tiers**, best first:

| Tier | Match |
|---:|---|
| 0 | exact primary name |
| 1 | primary-name prefix |
| 2 | exact alias or identifier |
| 3 | alias or identifier prefix |
| 4 | primary-name substring |
| 5 | alias or identifier substring |
| 6 | fuzzy |

Ties break on edit distance, then shorter name, then catalogue position, so
ordering is deterministic. With no query the catalogue keeps its original order.

**Fuzzy algorithm.** Bounded Damerau-Levenshtein (optimal string alignment) with
three rolling rows and an early exit as soon as a whole row exceeds the budget.
Transpositions cost one edit, so `Betelguese` is one step from `Betelgeuse`.
A query is compared against the whole name, each word of the name over two
characters, and each identifier.

**Thresholds.** Budget by normalized query length: under 4 characters none at
all, 4–5 one edit, 6–9 two, 10 or more three. A candidate must also satisfy
`distance / max(length) <= 0.34`. The fuzzy pass runs only when the literal
passes fall short of what the caller needs — one match for the results list,
eight for the suggestion list — and contributes at most 12 records.

Rationale:

- The zero budget under four characters exists because at three characters most
  of the catalogue is within one edit; tolerance there produces noise, not
  corrections.
- The ratio test exists because a three-edit budget alone lets a long query
  reach unrelated short names.
- Gating the fuzzy pass on the literal result count is what keeps typing fast:
  an ordinary prefix query computes no edit distance at all. Measured worst case
  is 1.7 ms per query at 208 records and 2.6 ms at 1,000, so no debounce is
  used — suggestions appear on the keystroke.

**Correction, not rewriting.** When the best match was only reached by edit
distance, `Did you mean X?` appears above the results. When nothing matched at
all, a fuller panel repeats the searched text, offers a correction computed
*without* the category filter (a filter is often the reason a spelling matched
nothing), lists at most three other close names, and offers Clear search. The
query is never rewritten without a click.

**Autocomplete.** An ARIA 1.2 combobox: the input carries `role="combobox"`,
`aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is a
`listbox` of `option` elements — not buttons, which a listbox may not contain.
Suggestions open at two normalized characters, cap at eight, respect the active
category, and show the object's name with its type and the matched alias as
secondary text. **Selecting a suggestion opens that object's detail view**, and
also sets the search box to the object's name and re-runs the search, so Back
returns to a result list containing it. Enter with no highlighted suggestion
submits the search as it always did. The suggestion count is announced only when
it changes, to keep a screen reader from reciting a number on every keystroke.

Consequences:

- Adding a searchable field means adding a term in `buildIndexEntry`, not a new
  system.
- The tier table is the contract: a change to it changes result ordering and
  should be reflected in `tools/search_checks.mjs`.
- Aliases are indexed as the source wrote them, including classification-style
  entries such as `Spectral type K5+III`. Those are searchable, which is useful,
  but they are not names and must not be presented as such.
- Escape inside the search field falls through to the browser's native
  "clear the search input" behaviour whenever the suggestion list is already
  closed. That is deliberate; the app only intercepts Escape to dismiss its own
  list.

## D14 — Quiz difficulty is a content ladder with a fallback, not just a timer

Status: **Accepted** (refines D11)

Decision:

Each of the five difficulties owns an ordered list of tiers. A tier names a
subject pool and a set of question families. Tiers are consumed in order until a
game is full, so a difficulty that cannot fill ten questions from its preferred
content degrades into simpler content rather than into a shorter game — and it
keeps its own timer while doing so.

| Mode | Seconds | Preferred content |
|---|---:|---|
| Effortless | 20 | identity and type, on well-known records with a common name |
| Easy | 15 | identity, type, catalogued distance and size, on well-known records |
| Medium | 10 | source classification, distance and size, whole catalogue |
| Hard | 7 | discovery year, spectral type, source classification |
| Impossible | 5 | exact spectral type and exact coordinates, same-category choices |

Effortless eligibility is the record's `wellKnown` flag, narrowed to names that
are not bare catalogue designations. `wellKnown` is editorial and is derived, by
`tools/derive_quiz_fields.py`, from the curated `select_identifiers` and
`select_names` lists in `tools/sources.json`. Those lists are the notability
judgement a maintainer already made and reviewed when choosing what to import;
reusing them avoids inventing a second, unreviewed "famous objects" list in
application code.

A question is discarded when the player could answer it without knowing
anything — when the prompt contains the answer, or when the answer contains the
subject the prompt named while the distractors do not.

Rationale:

- Shortening the clock alone makes a mode faster, not harder. Impossible should
  ask something a knowledgeable player finds hard, not the same question in five
  seconds.
- A silent short game is a defect the player cannot diagnose; falling back is
  visible in diagnostics and keeps the scoring denominator at 1000.
- Astronomical naming leaks answers constantly ("Sombrero Galaxy" is a Galaxy),
  so the giveaway rule has to be structural rather than a per-family patch.

Consequences:

- `quiz.js` exposes `window.unimapQuiz` with the generator and a `diagnostics`
  object. It is read only by `tools/quiz_checks.mjs`; no gameplay depends on it.
- Fallback usage is asserted in the checks against a deliberately bare fixture
  catalogue, so a future data change cannot silently make a mode fall back.
- Adding a question family means adding an eligibility predicate and placing it
  in a tier, not editing the game loop.

## D14a — Two question families were rejected as unsupportable

Status: **Accepted** (refines D14)

Decision:

Host-star questions and alias questions were implemented, measured against the
real 208-record catalogue, and withdrawn. They are not in the shipped tiers.

Evidence:

- **Host star.** The NASA Exoplanet Archive names a planet after its host —
  KOI-1599.02 orbits KOI-1599, Kepler-1176 b orbits Kepler-1176. All 60
  catalogued exoplanets follow it, in both directions, so the prompt always
  spells out its own answer. 52 of 52 generated instances were rejected by the
  giveaway rule.
- **Aliases.** After discarding decorated spellings of an object's own name
  ("* 51 Peg" for 51 Peg), the spectral-type and host-system values the importer
  parks in `aliases`, and one classification annotation, exactly **five**
  informative aliases remain — all minor-planet designations, all embedding the
  object's name ("136472 Makemake (2005 FY9)"). Five records could not carry a
  difficulty tier even if the naming were independent.

Two further families were rejected before implementation:

- **Discovery method.** Present and structured on all 60 exoplanets, but every
  value is `Transit`. One distinct value cannot make four choices.
- **Discoverer, and constellation or sky region.** No catalogue record carries
  either field. Deriving them would mean inventing provenance, which D7 forbids.

Reverse-classification ("which object is a planetary nebula?") is rejected
permanently rather than pending data: nine catalogued objects share that gloss,
so the question has nine correct answers. Only the forward direction is asked.

Rationale:

An educational quiz that rewards pattern-matching on a naming convention teaches
the convention, not the astronomy. Refusing a family is cheaper to reverse than
shipping questions that look right and are not.

Consequences:

- All four return automatically when the catalogue supports them: the rejection
  is data-driven, and P7's new object classes may supply independent names,
  non-transit discovery methods, or discoverer fields.
- `hostName`, `discoveryMethod` and `aliases` remain stored and validated. They
  are not dead data — `hostName` and `discoveryMethod` give discovery answers
  their context in the explanation, and aliases still drive search.

## D15 — Leaderboard storage is versioned, recoverable and exportable; it stays local

Status: **Accepted** (refines D11)

Decision:

Each difficulty's `localStorage` value is an envelope, not a bare array:

```json
{ "version": 1, "entries": [ { "name": "Player", "score": 850,
  "difficulty": "hard", "questions": 10, "maximumScore": 1000,
  "date": "2026-07-27", "completedAt": "2026-07-27T20:15:00.000Z",
  "durationMs": 54213 } ] }
```

Reading migrates the previous unversioned array in place and rewrites it.
Individual malformed entries are dropped while valid ones survive. A value that
cannot be parsed at all is moved to `unimap.leaderboard.<difficulty>.corrupt`
rather than deleted, and the interface says some scores were set aside.

The quiz exports every mode's scores as one JSON file and imports one back.
Import **merges**: it adds entries that are not already present, identified by
name, score and completion time, so re-importing the same file is a no-op and a
backup from another device never deletes what is on this one.

A shared cross-device leaderboard remains out of scope. It needs hosted writes,
identity, privacy decisions and anti-cheat, none of which a static site has.

Rationale:

- Without a version field there is no safe way to change the shape later, and no
  way to tell corrupt data from an empty leaderboard.
- Destroying a player's scores because one byte was bad is the worst available
  outcome; quarantining costs one key and keeps the data recoverable.
- Export/import is the honest answer to "my scores are only on this device": it
  gives the player the portability a backend would, without a backend.
- Merge-not-replace is what makes import safe to try.

Consequences:

- The interface states plainly that scores are stored on this device only.
- `maximumScore` is stored rather than assumed, so changing the question count
  later cannot silently rescale historical scores.
- Migration and corruption paths are covered by `tools/quiz_checks.mjs`, since
  they are exactly the code that is otherwise never exercised until it matters.

## D16 — A common name is display and search only; the formal designation stays the record's name

Status: **Accepted**

Decision:

`name` continues to hold the designation an import produced (`* 51 Peg`, `M 1`).
A new optional `commonName` holds the recognisable name the same source
publishes for that object (`Helvetios`, `Crab`). The interface prefers the
common name in headings, result rows, suggestions and quiz prompts, and shows
the designation beside it. Both are indexed for search, in the same ranking
tiers. 91 of 208 records carry one.

Values come from SIMBAD's `ident` table via `tools/fetch_common_names.py`, which
writes the reviewable mapping `tools/common-names.json` carrying a source name,
source URL and review date. Nothing is authored from recall.

Where an object has several `NAME` entries the shortest wins and ties break
alphabetically. Every other name is kept in `catalogueIdentifiers`, so search
still matches what the source published even though only one name is displayed.

A common name replaces a **designation**, never another common name. When
SIMBAD's own `main_id` is already a `NAME`, the record is left alone: the
shortest-name rule would otherwise have demoted `Proxima Centauri` to `Proxima`
and the `Vela Pulsar` to `Vel A`. Those five records keep their names and gain
the alternates as searchable identifiers instead.

Rationale:

- 102 records displayed a designation. A catalogue a reader cannot recognise is
  a catalogue they cannot use, and Effortless quiz mode was limited to 34
  records for exactly this reason.
- Renaming `name` would break every stored reference, every alias the importer
  wrote, and the guarantee that a record shows what its source called it.
- Choosing among several published names is editorial, so it is done by a fixed
  documented rule in a reviewable file rather than case by case.

Consequences:

- The validator rejects a `commonName` that duplicates or collides with any
  record's `name`, and rejects two records sharing one.
- A future import that adds objects does not need to re-derive names; rerunning
  the fetch tool refreshes the mapping and the enrichment applies it.
- Two records genuinely sharing a common name would be a hard error, not a
  silent pick. None currently do.

## D17 — Enrichment recovers values already fetched, in a fixed order of preference

Status: **Accepted** (applies D7 and extends D12)

Decision:

Fields are added from what a source already returned, never from general
knowledge, and `tools/enrich_catalogue.py` tries three routes in this order:

1. **A cached source response.** `massEarth` comes from the exoplanet archive's
   own `pl_bmasse` column, keyed by planet name.
2. **A structured value the importer already stored.** `orbitClass` is lifted
   out of the `"<x> (JPL orbit class)"` alias.
3. **Reversal of our own generated sentence.** `sourceSummary` is emitted from a
   fixed template in this repository, so reversing it is not prose parsing. Each
   reversal is verified by re-rendering the whole sentence from the captured
   values and requiring an exact match; a record that does not round-trip is
   reported and left untouched.

Recovered this way: `classification` (132), `massEarth` (59), `orbitClass` (5),
and `discoverer`, `discoveryDate`, `discoverySite` (1 each, from JPL's discovery
block, which the bulk query does not return).

Rationale:

- The values were real when fetched; serialising them into a sentence was a
  storage mistake, not a provenance one, and the same evidence supports them.
- A cached response is better evidence than a sentence, and a stored field is
  better than either, so the order is by strength of evidence.
- Requiring an exact re-render is what separates this from parsing prose: a
  changed template fails loudly instead of silently capturing the wrong span.

Consequences:

- The tool is idempotent and exits non-zero if any record is refused.
- `import_catalogue.py` should write new fields directly, so a future import
  does not need this step.
- Enrichment never touches `id`, `name`, `type`, coordinates, measurements,
  provenance, `summary` or `sourceSummary`. This is asserted field by field
  before the catalogue is written.

## D18 — Classification is a field, not a measurement

Status: **Accepted** (corrects a semantic in D10)

Decision:

SIMBAD's object-type gloss now lives in `classification`. It was previously
written into `measurementLabel`/`measurementValue` as
`"SIMBAD classification": "supernova remnant"`.

Rationale:

- A classification is not a measurement. Storing it in the measurement slot made
  the pair mean two different things depending on the record, and there is only
  one slot — so a star, whose slot holds a parallax, had nowhere to put its
  classification at all.
- That is why the quiz's classification family reached only 66 of the 132
  records that actually have a gloss. Reading a field doubles it.
- `type` remains UniMap's own category, which the filters use. The two are
  deliberately separate: SIMBAD types M 31 an "active galaxy nucleus" while
  UniMap files it under Galaxy.

Consequences:

- The measurement pair is left in place on the records that carry it, so nothing
  is broken and no existing value changes; the quiz reads the field and falls
  back to the measurement.
- Measurement comparisons stay type-safe: a family may only compare values
  sharing a `measurementLabel`, and a classification is no longer among them.

## D19 — Categories are a declared model with stable ids, not a label-to-type map

Status: **Accepted**

Decision:

`CATEGORY_GROUPS` in `app.js` declares every filter once: a stable `id`, a
visible `label`, and either the exact `type` values it accepts or a list of
`children`. State stores the id. The markup's `data-category` attributes carry
ids, and `countCategories` derives every count from the same declaration.

Matching is an exact comparison against the declared list. It previously
depended on that list carrying two spellings — `["galaxy", "galaxies"]` — so a
pluralised label would still match a singular type. That coupled the label
wording to the matching rule, and a label reworded to "Galaxy" would silently
have matched nothing.

Rationale:

- One declaration means a new category is one entry plus one button, not an edit
  in four places that can drift apart.
- Ids survive rewording. Labels are user-facing text and will change.
- Exact matching fails loudly when a type is misspelled, instead of quietly
  returning an empty list.

Consequences:

- `data-category` values changed from labels to ids, which is a breaking change
  for anything selecting on them. The two check suites were updated.
- An unknown id falls back to matching everything, so a stale stored value shows
  the catalogue rather than an empty page.
- Adding Candidate Dwarf Planet or Brown Dwarf records in P7 needs no interface
  work at all: both are already declared and both appear automatically.

## D20 — Planets is a disclosure group; Moons and Brown Dwarfs stay outside it

Status: **Accepted**

Decision:

Planets is a group containing All Planets, Solar System Planets, Exoplanets,
Dwarf Planets and Candidate Dwarf Planets. All Planets is the composite of all
four planet types. Moons and Brown Dwarfs are top-level categories and are
deliberately **not** members of All Planets.

The group control is a disclosure, not a filter. Opening it selects All Planets,
so activating it always produces results rather than only revealing more
controls; closing it returns to All. Selecting any other top-level category
collapses it. Children render in a second row rather than nested in the parent
row. Re-opening always returns to All Planets rather than restoring the last
child, so the control has one predictable outcome.

Rationale:

- A moon orbits a planet rather than being one, and a brown dwarf is neither a
  planet nor a star. Filing either under Planets would assert a classification
  no source makes.
- A second row keeps the parent row from reflowing as it opens, and wraps
  predictably on a phone. Below 30rem each child takes a full line, because
  "Candidate Dwarf Planets (0)" is wider than a 320px screen allows beside
  anything else.
- The group carries `aria-expanded` and `aria-controls` but deliberately no
  `aria-pressed`: the selected filter is one of its children, and two controls
  must not both be announced as chosen.

Consequences:

- While collapsed the child row is `hidden`, so its buttons leave the tab order
  and cannot be reached by a keyboard user who cannot see them.
- All controls are native buttons, so Enter and Space work with no key handling.
- Counts appear in the child labels only. The parent row stays uncluttered, and
  the counts are where the hierarchy actually needs disambiguating.

## D21 — An empty category is hidden, and that is the rule for every category

Status: **Accepted** (generalises existing behaviour)

Decision:

A category whose count is zero is hidden, with no exception for a category that
is expected to fill later. Moons, Brown Dwarfs and Candidate Dwarf Planets are
all declared in the model and all currently hidden. A group hides only when
every one of its children is empty.

Rationale:

- The alternative — a disabled control showing `(0)` — is a dead control, and
  the interface would carry three of them today.
- Declaring a category before its data is what makes P7 a data-only change: the
  filter, the validator type and the checks are already in place, and importing
  one record lights the control up with no interface work.
- One rule for every category means no special case to keep in step.

Consequences:

- Candidate Dwarf Planets is invisible until P7 imports a candidate. It is not
  "missing"; it is declared, tested and waiting.
- A maintainer cannot see a planned category in the running application. The
  model in `app.js` and this decision are where that is documented.

## D22 — kepler-452b is an exoplanet, on the archive's own evidence

Status: **Accepted**

Decision:

`kepler-452b` was typed `Planet` and is now typed `Exoplanet`. Only the type
changed.

Evidence:

- Kepler-452 b appears in the NASA Exoplanet Archive's `pscomppars` table — the
  archive's table of *confirmed exoplanets* — in the response cached in this
  repository. The classification is the source's, not ours.
- That row gives `sy_dist` 551.727 pc, which is 1,799.6 light years, matching
  the record's own `~1,800 ly`. The two describe the same object.
- The record is one of the 20 original hand-authored entries from `c55b9bb`. It
  has never carried provenance and its type was hand-assigned.
- In this catalogue `Planet` means a solar-system planet: the others are Earth,
  Mars and Jupiter, and Solar System Planets is defined as exactly that set.

Rationale:

- The name looking like an exoplanet is not evidence. The archive listing it as
  a confirmed planet is.
- Left uncorrected, the Solar System Planets filter would return an object
  1,800 light years away, which is the filter promising something false.

Consequences:

- Counts move from Planet 4 / Exoplanet 60 to Planet 3 / Exoplanet 61. The
  record count is unchanged at 208 and no other field moved.
- No identity collision: no other record carries that id or that name.
- Provenance was **not** added. The record's values were hand-authored, and
  attaching a source name to them would claim they came from that source.
  Importing it properly belongs to P7.

## Decision template

### D# — Title

Status: **Proposed | Accepted | Superseded**

Decision:

Describe the choice.

Rationale:

Explain the user, technical, and operational reasons.

Consequences:

Describe tradeoffs, constraints, and follow-up work.
