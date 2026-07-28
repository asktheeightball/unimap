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

## D15a — Enrichment adds named fields; the generic measurement slot stays for compatibility

Status: **Accepted** (refines D2, D5, D10)

Decision:

`measurementLabel`/`measurementValue` is one slot whose meaning changes per
record: on an exoplanet it is a radius in Earth radii, on a star a parallax in
milliarcseconds, on a dwarf planet a semi-major axis in AU, and on a deep-sky
object a text classification. Nothing may compare two records through it.

P5 gives each meaning a field that names itself — `radiusEarth`, `massEarth`,
`parallaxMas`, `semiMajorAxisAu`, `classification` — copied from the slot by
`tools/derive_enrichment.py`. The slot is **not** removed. The detail view shows
it only when its label has no named field of its own, so a record written before
these fields existed, or by a future importer with a measurement UniMap has not
named, still displays its value instead of silently losing it.

The named measurements are stored as strings, not numbers. The source's own
precision is part of the value: `"1.90"` and `"1.9"` say different things about
how well the radius is known, and reformatting through a float would discard
that. The validator requires them to parse as numbers without requiring them to
be stored as numbers.

Consequences:

- Two records may be compared only through a named field, never through the
  generic slot.
- No unit conversion is performed. A value is stored in the unit the source used
  and displayed with that unit spelled out.

## D15b — Editorial prose is a separate layer with its own attribution

Status: **Accepted** (refines D7, D12)

Decision:

D12 established that importers can say what an object is, where it is and how
big it is, but not why anyone cares, and left "why it is notable" open. P5
closes it for the 11 original records that carried no description at all, with
hand-written text kept in `tools/editorial.json` and applied by
`tools/apply_editorial.py`.

The editorial layer is deliberately separate from the importers:

- `summary` and `notability` are hand-written and always take precedence over
  the importer-generated `sourceSummary`. The two are never merged.
- Any record carrying either must also carry `summarySource` and
  `summaryReviewed`; the validator errors otherwise. Editorial prose without
  attribution is indistinguishable from importer output, which is exactly the
  confusion these fields exist to prevent.
- `tools/apply_editorial.py` may not set `sourceSummary`, `sourceName`,
  `sourceUrl` or any measurement. Those belong to whatever measured the object.
- It refuses to overwrite any committed value, including a previous edit of its
  own. Re-running changes nothing.

Editorial entries record **no source URL**. Every one was written in a
network-blocked environment, so no claim could be checked against an external
reference, and citing a page that was never opened is fabricated provenance —
worse than none (D7). The detail view therefore shows editorial records an
attribution line reading "UniMap editorial" and no link.

Consequences:

- Coverage is 11 of 208 and will stay there until a networked machine can review
  the text and record real references. That is a documented limit, not an
  oversight.
- `notability` must not restate a measurement the record already holds. "The
  largest planet" is a ranking across data UniMap does not have; "its gravity
  shapes the orbits of asteroids and comets" is not.

## D15c — Constellation is read from a designation, never from coordinates

Status: **Accepted** (refines D5, D7)

Decision:

`constellation` is derived only from an object's Bayer, Flamsteed or
variable-star designation, by expanding the trailing abbreviation through
`tools/constellations.json`. It is never derived from right ascension and
declination.

This is a lookup, not an inference. Those naming systems assign a Greek letter,
a number or a variable-star letter *within a named constellation*, so the "Ori"
in "* alf Ori" is not evidence about where the star is — it is the constellation
itself. An abbreviation the table does not list is refused rather than guessed.

Deriving constellation from coordinates was considered and rejected for now. It
requires the IAU boundary table (Delporte 1930, expressed in B1875 coordinates)
plus a precession step from the catalogue's J2000 positions. That dataset is not
in the repository and could not be fetched. Approximating boundaries, or reading
a constellation off a nearby object's name, would fabricate a value (D7). The
work is deferred rather than faked.

Moving solar-system bodies — Planet, Dwarf Planet, Moon — are excluded by rule
and by validator error. A constellation is a direction, not a place, and a body
that moves against the background stars does not have one in any fixed sense.

Consequences:

- Coverage is 60 of 208: 58 stars, one pulsar, and Cygnus X-1 (whose X-ray
  source designation names its constellation by the same convention).
- Galaxies, nebulae and clusters catalogued as "M 51" or "NGC 3372" get nothing,
  because a Messier or NGC number encodes no constellation.
- The field is useful on the detail page and unusable in the quiz — see D15e.

## D15d — Relations are declared, validated, and resolved through a lookup map

Status: **Accepted**

Decision:

`relatedObjectIds` lists ids of other catalogue records; `parentBody` names what
an object orbits or belongs to. Both are declared in `tools/editorial.json`
rather than inferred, and only where the relationship is direct and uncontested:
a planet to its star, a black hole to its host galaxy.

The validator rejects a relation naming a missing id, a record relating to
itself, and the same relation listed twice. The renderer independently skips all
three, so a hand-edited catalogue cannot produce a link that goes nowhere.

Exoplanet-to-host-star relations are **not** possible and this is a data fact,
not an omission: none of the 60 exoplanet `hostName` values names a record in
the catalogue. The archive query selects planets, not their stars, so every host
is a name with nothing behind it. `hostName` stays as a displayed field and as
quiz explanation context.

Relations resolve through a `state.byId` map built once at load rather than by
scanning the catalogue per render. Measured over an 11-fold catalogue (2,288
records), detail render time stays flat at 0.058ms.

Consequences:

- Coverage is 7 records: the three solar-system planets and Sol, the Milky Way
  and Sagittarius A*, and M87* to M 87.
- Importing host stars as records would unlock 60 relations at once and is the
  single highest-value item for a networked follow-up.

## D15e — P5 unlocked one quiz family; four stayed rejected on fresh evidence

Status: **Accepted** (refines D14a)

Decision:

Every family D14a rejected was re-measured against the enriched catalogue. One
became viable; the rest did not, and two of them failed for a *new* reason worth
recording.

**Enabled — mass.** 59 eligible records, 56 distinct answers, no leak in either
direction: an archive designation such as `KOI-1599.02` says nothing about the
planet's mass. Added to Hard and to Impossible's fallback tier.

**Widened — classification.** The family read SIMBAD's gloss out of the generic
measurement slot, which a star with a published parallax had already spent on
the parallax. Reading the new `classification` field instead takes the pool from
66 records to 132 without changing a single answer.

**Still rejected:**

| Family | Old reason | Measured now |
|---|---|---|
| Constellation | No record carried it | 60 records carry it, and **60 of 60 name their own answer** — the constellation is derived from the designation the catalogue displays as the name, so "In which constellation does bet Ori lie?" answers itself |
| Discoverer | No record carried it | 2 records carry one; four choices need four distinct values |
| Discovery method | One value, `Transit` | 61 records, still one value |
| Alias / identifier | Five informative aliases | `catalogueIdentifiers` made it measurable rather than viable: 68 of 69 are the object's own name behind a SIMBAD kind marker |
| Host star | Prompt names the answer | Unchanged |

Rationale:

Constellation is the instructive case. P5 removed the old blocker and replaced
it with a harder one, and no subset of the catalogue survives: the field is
genuinely valuable on the detail page and genuinely unusable as a question.
Adding a field is not the same as unlocking a family, and the reassessment is
recorded beside each family in `quiz.js` so the evidence stays next to the code.

Consequences:

- Constellation questions return only if a source supplies constellations for
  objects whose names do not encode them.
- Discoverer questions return only if a source publishes discoverers in bulk.
  No source UniMap can currently reach does.

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

## Decision template

### D# — Title

Status: **Proposed | Accepted | Superseded**

Decision:

Describe the choice.

Rationale:

Explain the user, technical, and operational reasons.

Consequences:

Describe tradeoffs, constraints, and follow-up work.
