#!/usr/bin/env python3
"""Promote already-published catalogue values into named, typed fields.

A development tool only. UniMap itself is static HTML, CSS, vanilla JavaScript
and JSON; Python is never required to run or deploy the site.

Usage:
    python3 tools/derive_enrichment.py --dry-run
    python3 tools/derive_enrichment.py

Exits 0 when every record was handled, 1 when a record could not be derived
safely and the catalogue was left untouched.

WHY THIS EXISTS
---------------
P5 asks for richer, structured object information. The honest first step is not
to fetch more data but to stop discarding data UniMap already holds:

* `measurementLabel`/`measurementValue` is a single generic slot. One record's
  "value" is a radius in Earth radii, another's is a parallax in milliarcseconds,
  another's is a semi-major axis in AU, and another's is a text classification.
  Nothing may compare those to each other, yet the catalogue gives them the same
  shape. This tool copies each into a field that names its own meaning and unit.
* `pl_bmasse` was fetched from the NASA Exoplanet Archive and rendered into the
  generated summary sentence but never stored as a field.
* SIMBAD's object-type gloss survives as a field only on records whose
  measurement slot was not already taken by a parallax.
* A Bayer, Flamsteed or variable-star designation states its own constellation.

Every value written here is already published verbatim in the committed
catalogue. No new fact is created and no external source is consulted.

THIS IS NOT PROSE PARSING
-------------------------
Where a value has to come back out of `sourceSummary`, that string is not human
writing: it is emitted by `tools/import_catalogue.py` from a fixed template, in
this repository, at a known revision. This tool reverses that exact template and
then PROVES the reversal by re-rendering the whole sentence from the captured
values and requiring byte-for-byte equality with the stored string. A record
that does not reproduce exactly is reported and left completely alone.

CONSTELLATION IS A LOOKUP, NOT A GUESS
--------------------------------------
The Bayer/Flamsteed/variable-star systems assign a letter or number WITHIN a
named constellation, so the trailing token of "* alf Ori" is not evidence about
where the star is - it is the constellation itself. This tool expands that
abbreviation using `tools/constellations.json` and refuses any abbreviation the
table does not list. It never derives a constellation from coordinates: that
needs the IAU boundary dataset, which UniMap does not carry (DECISIONS.md D15c).
Moving solar-system bodies are excluded because a sky constellation is not a
property they have.

IDEMPOTENCY
-----------
Re-running changes nothing. A field already present with the same value is left
alone; a field already present with a DIFFERENT value is a conflict, so the
committed value wins and the difference is reported as a refusal.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CATALOGUE = ROOT / "celestial-bodies.json"
CONSTELLATIONS = TOOLS / "constellations.json"

sys.path.insert(0, str(TOOLS))
import derive_quiz_fields as quiz_fields  # noqa: E402  (same directory, dev tool)
import import_catalogue as importer  # noqa: E402  (reuse the real templates)

# Generic measurement slots and the named field each one really means. The
# label is the importer's own literal string, so this mapping is exact rather
# than a heuristic about units.
MEASUREMENT_FIELDS = {
    "Radius (Earth radii)": "radiusEarth",
    "Parallax (mas)": "parallaxMas",
    "Semi-major axis (AU)": "semiMajorAxisAu",
    "SIMBAD classification": "classification",
}

# Aliases that are not catalogue identifiers. Both are facts the importer chose
# to store in the alias list so they would be searchable; each already has (or
# now gains) a field of its own, and neither is a designation anyone could look
# the object up by in a catalogue.
NON_IDENTIFIER_ALIASES = (
    lambda alias: alias.startswith(quiz_fields.SPECTRAL_ALIAS_PREFIX),
    lambda alias: alias.endswith(" system"),
)

# A sky constellation is a direction, not a location, so it is meaningless for
# a body that moves against the background stars over days or months.
MOVING_TYPES = {"Planet", "Dwarf Planet", "Moon"}

# A Bayer, Flamsteed or variable-star designation: an optional SIMBAD kind
# marker, the within-constellation designator, the constellation abbreviation,
# and an optional component letter for a multiple system ("alf Cen A").
DESIGNATION = re.compile(
    r"^(?:NAME |V\* |\*\* |\* )?"
    r"(?:[A-Z]{1,2}\d*|[a-z]{2,3}\.?|\d+) "
    r"(?P<abbreviation>[A-Za-z]{3})"
    r"(?: [A-Z])?$"
)

# Every gloss the importer can emit. The SIMBAD summary is reversed by matching
# this CLOSED SET as a literal alternation rather than by a wildcard: a real
# spectral type contains full stops ("K1.5IIIFe-0.5"), so a `.+?` gloss group
# would happily end on one and silently mis-split the sentence.
KNOWN_GLOSSES = sorted({gloss for _, gloss in importer.OTYPE_TO_TYPE.values()},
                       key=len, reverse=True)
GLOSS_ALTERNATION = "|".join(re.escape(gloss) for gloss in KNOWN_GLOSSES)

# The SIMBAD star summary, reversed. Mirrors `simbad_star()` in
# tools/import_catalogue.py; every group is one interpolation in that function.
# A spectral type contains full stops of its own ("K1.5IIIFe-0.5"), so the
# sentence boundary cannot be found by looking for the next ".". It is pinned
# instead to the two openings `simbad_star()` can put after it.
STAR_SUMMARY = re.compile(
    r"^(?P<name>.+?) is classified by SIMBAD as (?P<article>an?) "
    rf"(?P<gloss>{GLOSS_ALTERNATION})"
    r"(?: of spectral type (?P<spectral>.+?))?\."
    r"(?P<rest>(?: Its measured parallax of | SIMBAD publishes no parallax for it,)"
    r".*)$"
)

# The deep-sky summary, reversed. Mirrors `simbad_deep_sky()`.
DEEP_SKY_SUMMARY = re.compile(
    r"^(?P<name>.+?) is classified by SIMBAD as (?P<article>an?) "
    rf"(?P<gloss>{GLOSS_ALTERNATION})\.(?P<rest>.*)$"
)

# `~1,234.5 ly`, the only distance shape `simbad_star()` writes.
LIGHT_YEARS = re.compile(r"^~(?P<value>[\d,]+\.\d) ly$")

# NASA/JPL's Small-Body Database returns a `discovery` block that the importer
# appends to the summary verbatim, in the shape "Discovered 1801-01-01 by
# Piazzi, G. at Palermo." Unlike the sentences around it that string is JPL's
# prose, not ours, so it is matched by a fully anchored pattern and then
# re-rendered and compared: a fragment that does not reproduce exactly is
# refused rather than parsed loosely. The discoverer is kept exactly as JPL
# writes it - "Piazzi, G." is not reformatted into "G. Piazzi", because a
# normalisation nobody asked for is a change to a sourced value.
JPL_DISCOVERY = re.compile(
    r"^Discovered (?P<date>\d{4}-\d{2}-\d{2}) by (?P<who>.+?)"
    r"(?: at (?P<site>.+?))?\.$"
)


# --- derivations -----------------------------------------------------------


def derive_named_measurements(record: dict) -> dict:
    """Copy the generic measurement slot into a field that names its meaning."""
    label = record.get("measurementLabel")
    value = record.get("measurementValue")
    if not isinstance(label, str) or not isinstance(value, str) or not value.strip():
        return {}
    field = MEASUREMENT_FIELDS.get(label)
    if field is None:
        return {}
    return {field: value}


def derive_mass(record: dict) -> tuple[dict, str]:
    """Recover `pl_bmasse` from the exoplanet summary the importer generated.

    The whole sentence is re-rendered from the captured values and compared
    against the stored string, so a match proves the reversal rather than
    suggesting it.
    """
    summary = record.get("sourceSummary")
    if not isinstance(summary, str) or not summary:
        return {}, ""

    match = quiz_fields.EXOPLANET_SUMMARY.match(summary)
    if not match:
        return {}, "sourceSummary does not match the importer's exoplanet template"

    parts = match.groupdict()
    if quiz_fields.render_exoplanet_summary(parts) != summary:
        return {}, "exoplanet summary did not round-trip; leaving the record alone"

    mass = parts.get("mass")
    if not mass:
        return {}, ""
    return {"massEarth": mass}, ""


def render_position_note(record: dict) -> str:
    """Mirror `position_note()` in tools/import_catalogue.py."""
    return importer.position_note(record)


def render_star_summary(record: dict, gloss: str, spectral: str | None) -> str | None:
    """Re-render a SIMBAD star summary exactly as `simbad_star()` would.

    Returns None when the record does not hold the values the template needs,
    which makes the round-trip fail rather than pass on a partial rebuild.
    """
    opening = (f"{record.get('name')} is classified by SIMBAD as "
               f"{importer.article(gloss)} {gloss}"
               + (f" of spectral type {spectral}." if spectral else "."))

    parallax = record.get("measurementValue") if \
        record.get("measurementLabel") == "Parallax (mas)" else None
    if parallax is None:
        distance_note = ("SIMBAD publishes no parallax for it, so it carries no "
                         "distance.")
    else:
        distance = LIGHT_YEARS.match(str(record.get("distance") or ""))
        if not distance:
            return None
        try:
            parallax_mas = float(parallax)
        except ValueError:
            return None
        light_years = float(distance.group("value").replace(",", ""))
        distance_note = (f"Its measured parallax of {parallax_mas:,.4f} mas puts it "
                         f"about {light_years:,.1f} light years from Earth.")

    return importer.describe(opening, distance_note, render_position_note(record))


def render_deep_sky_summary(record: dict, gloss: str) -> str:
    """Re-render a SIMBAD deep-sky summary exactly as `simbad_deep_sky()` would."""
    return importer.describe(
        f"{record.get('name')} is classified by SIMBAD as "
        f"{importer.article(gloss)} {gloss}.",
        render_position_note(record),
        "SIMBAD's basic table publishes no distance for this object, so none is "
        "recorded here.",
    )


def derive_simbad_fields(record: dict) -> tuple[dict, str]:
    """Recover SIMBAD's object-type gloss, and any spectral type, from the summary.

    Records whose measurement slot was free already carry the gloss verbatim in
    `measurementValue`; a star with a published parallax used that slot for the
    parallax instead, so for those the gloss survives only in the summary. The
    whole summary is re-rendered from the captured values and required to equal
    the stored string byte for byte, so a match proves the reversal.
    """
    summary = record.get("sourceSummary")
    if not isinstance(summary, str) or not summary:
        return {}, ""
    if record.get("sourceName") != "SIMBAD (CDS, Strasbourg)":
        return {}, ""

    is_star = record.get("type") == "Star"
    match = (STAR_SUMMARY if is_star else DEEP_SKY_SUMMARY).match(summary)
    if not match:
        return {}, "sourceSummary does not match the importer's SIMBAD template"

    gloss = match.group("gloss")
    if match.group("article") != importer.article(gloss):
        return {}, f"article does not agree with classification {gloss!r}"

    spectral = match.groupdict().get("spectral") if is_star else None
    rebuilt = (render_star_summary(record, gloss, spectral) if is_star
               else render_deep_sky_summary(record, gloss))
    if rebuilt != summary:
        return {}, "SIMBAD summary did not round-trip; leaving the record alone"

    fields = {"classification": gloss}
    if spectral:
        # The importer wrote the spectral type into the summary and into an
        # alias. A star with no alias list therefore had a published spectral
        # type that never reached a field; the round-trip above proves it.
        fields["spectralType"] = spectral
    return fields, ""


def derive_constellation(record: dict, abbreviations: dict) -> tuple[dict, str]:
    """Read the constellation out of a Bayer/Flamsteed/variable-star designation."""
    if record.get("type") in MOVING_TYPES:
        return {}, ""

    for candidate in [record.get("name")] + list(record.get("aliases") or []):
        if not isinstance(candidate, str):
            continue
        match = DESIGNATION.match(candidate.strip())
        if not match:
            continue
        abbreviation = match.group("abbreviation")
        name = abbreviations.get(abbreviation)
        if name is None:
            return {}, (f"designation {candidate!r} ends in {abbreviation!r}, which is "
                        f"not an IAU constellation abbreviation")
        return {"constellation": name}, ""
    return {}, ""


def derive_jpl_discovery(record: dict) -> tuple[dict, str]:
    """Recover discoverer and discovery date from JPL's own discovery sentence.

    The Small-Body Database single-object endpoint returns a `discovery` block
    that `jpl_sbdb_object()` appends to the summary as the source wrote it. That
    sentence therefore carries a discoverer and a precise date that never
    reached a field.
    """
    if record.get("sourceName") != "NASA/JPL Small-Body Database":
        return {}, ""
    summary = record.get("sourceSummary")
    if not isinstance(summary, str) or not summary:
        return {}, ""

    # The importer joins fragments with a single space and puts the discovery
    # sentence last. It cannot be found by splitting on ". ", because JPL writes
    # discoverers as "Piazzi, G." and that abbreviation ends in a full stop too.
    start = summary.rfind(". Discovered ")
    if start == -1:
        return {}, ""
    fragment = summary[start + 2:]

    match = JPL_DISCOVERY.match(fragment)
    if not match:
        return {}, f"discovery sentence {fragment!r} does not match JPL's shape"

    site = match.group("site")
    rebuilt = (f"Discovered {match.group('date')} by {match.group('who')}"
               + (f" at {site}" if site else "") + ".")
    if rebuilt != fragment:
        return {}, "discovery sentence did not round-trip; leaving the record alone"

    date = match.group("date")
    return {
        "discoverer": match.group("who"),
        "discoveryDate": date,
        "discoveryYear": date[:4],
    }, ""


def derive_catalogue_identifiers(record: dict) -> dict:
    """Split the alias list into designations and stored facts.

    `aliases` stays exactly as it is so search keeps working unchanged; this
    adds the subset a reader would recognise as a catalogue designation.
    """
    identifiers = [
        alias for alias in (record.get("aliases") or [])
        if isinstance(alias, str) and alias.strip()
        and not any(reject(alias) for reject in NON_IDENTIFIER_ALIASES)
    ]
    return {"catalogueIdentifiers": identifiers} if identifiers else {}


# --- driver ----------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would change without writing the catalogue")
    args = parser.parse_args()

    bodies = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    abbreviations = json.loads(CONSTELLATIONS.read_text(encoding="utf-8"))["abbreviations"]

    added = Counter()
    unchanged = Counter()
    refusals: list[str] = []

    for record in bodies:
        derived: dict = {}

        derived.update(derive_named_measurements(record))
        derived.update(derive_catalogue_identifiers(record))

        for derivation in (
            lambda r: derive_mass(r) if r.get("type") == "Exoplanet" else ({}, ""),
            derive_simbad_fields,
            derive_jpl_discovery,
            lambda r: derive_constellation(r, abbreviations),
        ):
            fields, refusal = derivation(record)
            if refusal:
                refusals.append(f"{record.get('id')}: {refusal}")
            derived.update(fields)

        for field, value in derived.items():
            if record.get(field) == value:
                unchanged[field] += 1
                continue
            if field in record:
                refusals.append(
                    f"{record.get('id')}: {field} already set to {record[field]!r}, "
                    f"derived {value!r}"
                )
                continue
            record[field] = value
            added[field] += 1

    print(f"records: {len(bodies)}")
    for field in sorted(set(added) | set(unchanged)):
        print(f"  {field}: +{added[field]} new, {unchanged[field]} already correct")

    if refusals:
        print(f"\n{len(refusals)} record(s) refused; catalogue not written:", file=sys.stderr)
        for refusal in refusals:
            print(f"  {refusal}", file=sys.stderr)
        return 1

    if args.dry_run:
        print("\ndry run: no changes written")
        return 0

    CATALOGUE.write_text(json.dumps(bodies, indent=2, ensure_ascii=False) + "\n",
                         encoding="utf-8")
    print(f"\nwrote {CATALOGUE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
