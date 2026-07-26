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
}

ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

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
    check_local_references(records, args.path.resolve().parent)

    report(records, args.quiet)

    if errors:
        print(f"\nFAILED: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"\nOK: catalogue is valid ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
