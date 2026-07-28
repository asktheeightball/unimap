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

Source terms and attribution strings were verified first-hand on 2026-07-28 and are
recorded in `tools/sources.json`. One finding is load-bearing: the JPL SSD API Fair
Use Policy states "You may not embed these APIs in your website (per NASA CORS
policy)". UniMap complies *because* of this decision — the API is called only at
import time, never from a page view. Had the site queried JPL directly, it would
have breached that policy.

Consequences:

- Imports require network access. The sandbox this was first attempted in denied it;
  a normal networked machine does not. Resolved 2026-07-28.
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

## D8 — A source query must select for readability, not only for correctness

Status: **Accepted** (extends D6)

Decision:

When a source can return far more objects than UniMap should carry, the query and
its normalizer must select objects a reader can recognise — not merely objects that
satisfy a measurement filter.

The SIMBAD source originally queried `otype_txt = 'Star' and plx_value > 20`. That is
a correct nearby-star filter and a poor catalogue: of its 2,684 rows, 1,280 are
`Gaia DR3 …` designations, 453 are `UCAC4 …`, and 187 are `2MASS …`. Every record
would have been accurate and almost none would have been recognisable.

The query now joins SIMBAD's `ident` table and keeps only objects carrying a
`NAME …` identifier, displaying that proper name. The normalizer additionally drops
`NAME` values that are themselves designations (containing a digit or `*`, such as
`NAME GR* 402A`). This yields 45 stars: Kochab, Bellatrix, Canopus, Adhara, Sargas,
Rastaban, and similar.

Records are keyed on `main_id`, not on the proper name. SIMBAD stores alternate
spellings as separate `NAME` rows — Celeno/Celaeno and Azmidiske/Asmidiske each
resolve to one object — and keying on the object collapses them into one record
instead of duplicating the star.

Rationale:

- An unreadable name defeats the product's purpose; UniMap is browsed by name.
- R2 quiz mode generates distractors from these records. Four Gaia designations are
  not a question, and a catalogue full of them would make quiz mode unbuildable.
- This is the judgement D6 already applies through `select_names` for the TNO
  source: a broad query filter is not a claim about an object's suitability.

Consequences:

- Curation lives in `sources.json` where it is reviewable in a diff, except for
  tests on the returned string itself, which must live in the normalizer.
- Three marginal names remain (`DS Tau B`, `T Cha C`, `TPHE G`). They are real and
  accurate; a stricter filter risks discarding legitimate names, so they stay until
  there is evidence they cause a problem.
- SIMBAD's ADQL rejects qualified column names in `ORDER BY`; the query orders by
  ordinal (`order by 4`) instead.
- This decision constrains data selection only. It never permits altering a value,
  which D5 and D7 still forbid.

## D9 — Quiz behavior lives in `quiz.js`, separate from the catalogue

Status: **Accepted**

Decision:

The quiz is a second plain script, `quiz.js`, loaded alongside `app.js`. It owns
the quiz views, question generation, timing, scoring and leaderboards, and it
switches between the catalogue and quiz views. `app.js` is unchanged.

Rationale:

- The quiz is roughly as large as the entire catalogue application. Merging the
  two would have made `app.js` the place where every future change lands.
- The catalogue's search, filter and detail behavior is already validated. Not
  touching that file is the cheapest way to keep it that way.
- Both files remain plain `<script>` tags. This adds no framework, module system,
  bundler or dependency, so it stays inside D1.

Consequences:

- Both scripts read `celestial-bodies.json` independently. Two fetches of a local
  file are cheaper than the coupling that sharing state between them would add;
  revisit if a third feature needs the catalogue.
- Switching views only toggles visibility, so a search and its results survive a
  trip through the quiz.
- Leaving the quiz mid-question abandons that round rather than leaving a timer
  running behind a hidden view. "End quiz" is the deliberate path that records a
  score.

## D10 — Quiz questions are generated only from stored fields, with enforced answer separation

Status: **Accepted** (applies D7 to generated content)

Decision:

Each question family declares which stored fields it needs and produces a question
only when a record actually carries them. A family that cannot build a valid
question for a record returns nothing; it never fills a gap with an estimate,
and no question is derived by parsing prose.

Six families are supported by the current catalogue:

| Family | Requires | Eligible records |
|---|---|---:|
| `object-type` | `name`, `type` | 129 |
| `which-is-type` | `name`, `type` | 129 |
| `distance-order` | Earth-referenced `distance` | 123 |
| `distance-value` | Earth-referenced `distance` | 123 |
| `designation` | a catalogue-designation alias | 49 |
| `measurement` | `measurementLabel` + `measurementValue` | 105 |

Two rules keep answers unambiguous:

1. **Distractors must be separated from the answer.** "How far away" options differ
   by at least 2×, "which is closest" winners beat every distractor by at least
   25%, and measurement options differ by at least 25%. Without this the four
   dwarf planets, whose semi-major axes are close together, would have produced
   coin-flip questions; the rule excludes them automatically rather than by a
   hand-maintained list.
2. **Quantities must be comparable.** A dwarf planet's `distance` is a mean orbital
   distance from the Sun, not a distance from Earth, so the distance families
   accept only Earth-referenced values. Measurement distractors are drawn only from
   records sharing the same `measurementLabel`, so units always match.

Every question is checked before use: exactly four options, exactly one correct,
and no two option labels equal.

Rationale:

- A quiz multiplies data errors — a wrong value becomes a wrong answer marked
  correct, which teaches the error.
- Ambiguity is as damaging as inaccuracy: a question with two defensible answers
  punishes the better-informed player.

Consequences:

- Question supply is bounded by data quality, not by the number of templates.
  Richer fields (a discovery method or year, a description) would unlock better
  families; see the note in `HANDOFF.md`.
- Adding a family means declaring its field requirements and separation rule.
- The generator is honest about failure: if the catalogue could not support a quiz
  at all, the interface says so rather than asking a degenerate question.

## Decision template

### D# — Title

Status: **Proposed | Accepted | Superseded**

Decision:

Describe the choice.

Rationale:

Explain the user, technical, and operational reasons.

Consequences:

Describe tradeoffs, constraints, and follow-up work.
