#!/usr/bin/env python3
"""Validate celestial-bodies.json.

A development tool only. UniMap itself is static HTML, CSS, vanilla JavaScript
and JSON; Python is never required to run or deploy the site.

Usage:
    python3 tools/validate_catalogue.py
    python3 tools/validate_catalogue.py --quiet     # errors only, no summary

Exits 0 when the catalogue is valid, 1 when any error is found.
Uses only the Python standard library.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

CATALOGUE = Path(__file__).resolve().parent.parent / "celestial-bodies.json"

# Every record must carry these. `size`, `circumference` and `distance` are
# deliberately NOT required: many real objects have no published diameter, and
# SIMBAD's basic table has no distance column at all, so its galaxies, nebulae,
# clusters and pulsars arrive with coordinates and a classification but no
# distance. Inventing one is worse than omitting it (D7), and the detail view
# hides rows whose value is absent.
REQUIRED_FIELDS = ("id", "name", "type")

# Types the application's category filters can currently reach. Keep this in
# sync with CATEGORY_TYPES in app.js — a type absent here is unreachable in the
# interface, which is a real defect even though the JSON parses.
KNOWN_TYPES = {
    "Star",
    "Planet",
    "Exoplanet",
    "Dwarf Planet",
    "Moon",
    "Nebula",
    "Black Hole",
    "Neutron Star",
    "Pulsar",
    "Galaxy",
    "Star Cluster",
}

# Optional fields and the type each must have when present.
OPTIONAL_FIELDS = {
    "distance": str,
    "size": str,
    "circumference": str,
    "aliases": list,
    # Two distinct kinds of prose. `summary` is hand-written editorial text and
    # is never touched by an importer; `sourceSummary` is assembled by an
    # importer from values the source actually returned, and is importer-owned.
    "summary": str,
    "sourceSummary": str,
    "measurementLabel": str,
    "measurementValue": str,
    "sourceName": str,
    "sourceUrl": str,
    "lastReviewed": str,
    "rightAscension": str,
    "declination": str,
    "image": str,
    "imageAlt": str,
    "imageCredit": str,
    # Structured quiz fields. Each is a value the source actually returned;
    # `tools/derive_quiz_fields.py` explains how the committed ones were
    # recovered from importer-generated prose, and the importer now writes them
    # directly. `wellKnown` is the only editorial flag: it marks a record a
    # maintainer already selected by name in `tools/sources.json`, and the quiz
    # uses it to choose Effortless questions.
    "hostName": str,
    "discoveryYear": str,
    "discoveryMethod": str,
    "spectralType": str,
    "wellKnown": bool,
    # --- P5 enrichment -----------------------------------------------------
    # Named measurements. `measurementLabel`/`measurementValue` is one generic
    # slot whose meaning changes from record to record, so nothing may compare
    # two records through it. These name their own quantity and unit, and are
    # written by tools/derive_enrichment.py from the value already stored in
    # that slot. They are strings, not numbers, because the source's own
    # precision is part of the value and reformatting it would lose that.
    "radiusEarth": str,          # planet radius in Earth radii
    "massEarth": str,            # planet mass in Earth masses
    "parallaxMas": str,          # measured parallax in milliarcseconds
    "semiMajorAxisAu": str,      # orbital semi-major axis in astronomical units
    # SIMBAD's own object-type gloss ("red giant", "planetary nebula"). A
    # classification the source published, not a UniMap judgement; `type` stays
    # the coarse category the interface filters by.
    "classification": str,
    # The IAU constellation the object's designation places it in. Derived only
    # from a Bayer/Flamsteed/variable-star designation, never from coordinates,
    # and never applied to a moving solar-system body. See CONSTELLATIONS.
    "constellation": str,
    # The subset of `aliases` that is a real catalogue designation, with the
    # stored-fact pseudo-aliases ("Spectral type G2V", "Kepler-11 system")
    # removed. `aliases` itself is unchanged so search behaviour is unaffected.
    "catalogueIdentifiers": list,
    # Editorial. `summary` is hand-written prose and always takes precedence
    # over `sourceSummary`; `notability` says why a general reader would care.
    # `summarySource` and `summaryReviewed` record who wrote it and when, and
    # are required whenever either prose field is present.
    "commonName": str,
    "notability": str,
    "summarySource": str,
    "summaryReviewed": str,
    # Discovery attribution. `discoverer` is free text so a team, a survey or
    # several people can be credited without being forced into one name.
    "discoverer": str,
    "discoveryDate": str,        # YYYY-MM-DD, when the source is that precise
    # Relationships. `parentBody` is the name of what this object orbits or
    # belongs to; `relatedObjectIds` are ids of other catalogue records.
    "parentBody": str,
    "relatedObjectIds": list,
}

# Constellation values are checked against the IAU table rather than accepted
# as free text, so a typo or an abbreviation that was never expanded is an
# error instead of a label nobody notices.
CONSTELLATIONS = Path(__file__).resolve().parent / "constellations.json"

# A sky constellation is a direction, not a place, so it is not a property a
# body that moves against the background stars can have.
MOVING_TYPES = {"Planet", "Dwarf Planet", "Moon"}

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
YEAR_PATTERN = re.compile(r"^\d{4}$")

try:
    CONSTELLATION_NAMES = set(
        json.loads(CONSTELLATIONS.read_text(encoding="utf-8"))["abbreviations"].values()
    )
except (OSError, ValueError, KeyError) as exc:  # pragma: no cover - setup error
    print(f"error: cannot read {CONSTELLATIONS}: {exc}", file=sys.stderr)
    sys.exit(1)

errors: list[str] = []
warnings: list[str] = []


def error(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def load_catalogue(path: Path):
    """Parse the catalogue, reporting syntax problems with line numbers."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"error: cannot read {path}: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON at line {exc.lineno} column {exc.colno}: {exc.msg}",
              file=sys.stderr)
        sys.exit(1)

    if not isinstance(data, list):
        print("error: catalogue must be a JSON array of records", file=sys.stderr)
        sys.exit(1)

    return data


def check_record(index: int, record) -> None:
    label = f"record[{index}]"

    if not isinstance(record, dict):
        error(f"{label}: expected an object, found {type(record).__name__}")
        return

    identifier = record.get("id")
    if isinstance(identifier, str) and identifier:
        label = f"{identifier!r}"

    for field in REQUIRED_FIELDS:
        value = record.get(field)
        if value is None:
            error(f"{label}: missing required field {field!r}")
        elif not isinstance(value, str):
            error(f"{label}: {field!r} must be a string, found {type(value).__name__}")
        elif not value.strip():
            error(f"{label}: {field!r} is empty")

    if isinstance(identifier, str) and not ID_PATTERN.match(identifier):
        error(f"{label}: id must be lowercase alphanumeric words joined by hyphens")

    body_type = record.get("type")
    if isinstance(body_type, str) and body_type not in KNOWN_TYPES:
        error(f"{label}: type {body_type!r} is not reachable by any category filter "
              f"(known types: {', '.join(sorted(KNOWN_TYPES))})")

    for field, expected in OPTIONAL_FIELDS.items():
        if field not in record:
            continue
        value = record[field]
        if not isinstance(value, expected):
            error(f"{label}: optional field {field!r} must be "
                  f"{expected.__name__}, found {type(value).__name__}")
        elif expected is list and not all(isinstance(item, str) for item in value):
            error(f"{label}: optional field {field!r} must contain only strings")

    reviewed = record.get("lastReviewed")
    if isinstance(reviewed, str) and not DATE_PATTERN.match(reviewed):
        error(f"{label}: lastReviewed must be YYYY-MM-DD, found {reviewed!r}")

    # The quiz asks "in what year was this discovered?" and shows the stored
    # string verbatim, so anything that is not a plain four-digit year would be
    # displayed as an answer option exactly as written.
    year = record.get("discoveryYear")
    if isinstance(year, str) and not YEAR_PATTERN.match(year):
        error(f"{label}: discoveryYear must be a four-digit year, found {year!r}")

    # A host that names the planet itself would generate "which star does X
    # orbit?" with X as its own answer.
    host = record.get("hostName")
    if isinstance(host, str) and host.strip() == str(record.get("name") or "").strip():
        error(f"{label}: hostName is the record's own name")

    date = record.get("discoveryDate")
    if isinstance(date, str) and not DATE_PATTERN.match(date):
        error(f"{label}: discoveryDate must be YYYY-MM-DD, found {date!r}")

    # A precise date and a year must not contradict each other.
    if isinstance(date, str) and isinstance(year, str) and DATE_PATTERN.match(date):
        if date[:4] != year:
            error(f"{label}: discoveryDate {date!r} disagrees with discoveryYear {year!r}")

    reviewed_summary = record.get("summaryReviewed")
    if isinstance(reviewed_summary, str) and not DATE_PATTERN.match(reviewed_summary):
        error(f"{label}: summaryReviewed must be YYYY-MM-DD, found {reviewed_summary!r}")

    # Editorial prose without attribution is indistinguishable from importer
    # output, which is exactly the confusion the two fields exist to prevent.
    if record.get("summary") or record.get("notability"):
        if not record.get("summarySource"):
            error(f"{label}: has editorial prose but no summarySource")
        if not record.get("summaryReviewed"):
            error(f"{label}: has editorial prose but no summaryReviewed")

    constellation = record.get("constellation")
    if isinstance(constellation, str):
        if constellation not in CONSTELLATION_NAMES:
            error(f"{label}: constellation {constellation!r} is not one of the 88 "
                  f"IAU constellations")
        if body_type in MOVING_TYPES:
            error(f"{label}: {body_type} moves against the background stars, so a "
                  f"constellation is not a property it has")

    # A named measurement must be a number: these fields exist precisely so a
    # value can be compared or converted, which text cannot be.
    for field in ("radiusEarth", "massEarth", "parallaxMas", "semiMajorAxisAu"):
        value = record.get(field)
        if not isinstance(value, str):
            continue
        try:
            float(value.replace(",", ""))
        except ValueError:
            error(f"{label}: {field} must be numeric, found {value!r}")

    # Provenance is paired: a URL without a name (or vice versa) is incomplete.
    has_name, has_url = "sourceName" in record, "sourceUrl" in record
    if has_name != has_url:
        warn(f"{label}: has only one of sourceName/sourceUrl; provenance is incomplete")

    unknown = set(record) - set(REQUIRED_FIELDS) - set(OPTIONAL_FIELDS)
    if unknown:
        warn(f"{label}: unrecognised field(s): {', '.join(sorted(unknown))}")


def check_collisions(records) -> None:
    ids = defaultdict(list)
    names = defaultdict(list)

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            continue
        identifier = record.get("id")
        name = record.get("name")
        if isinstance(identifier, str):
            ids[identifier].append(index)
        if isinstance(name, str):
            names[name.strip().lower()].append(index)

    for identifier, positions in sorted(ids.items()):
        if len(positions) > 1:
            error(f"duplicate id {identifier!r} at records {positions}")

    for name, positions in sorted(names.items()):
        if len(positions) > 1:
            error(f"duplicate name {name!r} at records {positions}")

    # An alias that collides with a real object's name would make future alias
    # search ambiguous, so flag it now rather than after alias search ships.
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            continue
        for alias in record.get("aliases", []) or []:
            if isinstance(alias, str) and alias.strip().lower() in names:
                owner = names[alias.strip().lower()]
                if owner != [index]:
                    warn(f"record[{index}]: alias {alias!r} collides with the name "
                         f"of record(s) {owner}")


def check_relations(records) -> None:
    """Every relation must point at a real, different record, exactly once.

    A relation that names a missing id renders as a dead link; a self-relation
    renders as a link back to the page the reader is already on; a duplicate
    renders the same link twice. None of the three is caught by JSON validity.
    """
    ids = {r.get("id") for r in records if isinstance(r, dict)}

    for record in records:
        if not isinstance(record, dict):
            continue
        related = record.get("relatedObjectIds")
        if not isinstance(related, list):
            continue
        label = repr(record.get("id"))
        seen = Counter(target for target in related if isinstance(target, str))
        for target, count in sorted(seen.items()):
            if count > 1:
                error(f"{label}: relatedObjectIds lists {target!r} {count} times")
            if target == record.get("id"):
                error(f"{label}: relatedObjectIds contains the record's own id")
            elif target not in ids:
                error(f"{label}: relatedObjectIds names {target!r}, which is not a record")


def check_local_references(records, root: Path) -> None:
    for record in records:
        if not isinstance(record, dict):
            continue
        image = record.get("image")
        if not isinstance(image, str) or not image:
            continue
        if image.startswith(("http://", "https://")):
            warn(f"{record.get('id')!r}: image is a remote URL; the catalogue "
                 f"should reference a locally stored file")
        elif not (root / image).is_file():
            error(f"{record.get('id')!r}: image file not found: {image}")


def report(records, quiet: bool) -> None:
    if not quiet:
        counts = Counter(r.get("type") for r in records if isinstance(r, dict))
        print(f"records: {len(records)}")
        for body_type, count in sorted(counts.items(), key=lambda pair: (-pair[1], str(pair[0]))):
            print(f"  {body_type:<14} {count:>4}")

        provenance = sum(1 for r in records if isinstance(r, dict) and r.get("sourceUrl"))
        print(f"with source metadata: {provenance}/{len(records)}")

        # Coverage per enriched field, so a promotion can be compared against
        # the numbers reported before it rather than eyeballed.
        total = len(records)
        print("field coverage:")
        for field in ("summary", "notability", "sourceSummary", "classification",
                      "constellation", "spectralType", "hostName", "parentBody",
                      "discoverer", "discoveryYear", "discoveryMethod",
                      "catalogueIdentifiers", "relatedObjectIds", "aliases",
                      "distance", "size", "radiusEarth", "massEarth",
                      "parallaxMas", "semiMajorAxisAu",
                      "rightAscension", "declination"):
            count = sum(1 for r in records
                        if isinstance(r, dict) and r.get(field) not in (None, "", []))
            print(f"  {field:<22} {count:>4}/{total}")

        described = sum(1 for r in records if isinstance(r, dict)
                        and (r.get("summary") or r.get("sourceSummary")))
        print(f"with any description: {described}/{total}")

    for message in warnings:
        print(f"warning: {message}")
    for message in errors:
        print(f"error: {message}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate the UniMap catalogue.")
    parser.add_argument("--quiet", action="store_true", help="suppress the summary")
    parser.add_argument("path", nargs="?", type=Path, default=CATALOGUE,
                        help="catalogue path (default: celestial-bodies.json)")
    args = parser.parse_args()

    records = load_catalogue(args.path)

    for index, record in enumerate(records):
        check_record(index, record)
    check_collisions(records)
    check_relations(records)
    check_local_references(records, args.path.resolve().parent)

    report(records, args.quiet)

    if errors:
        print(f"\nFAILED: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"\nOK: catalogue is valid ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
