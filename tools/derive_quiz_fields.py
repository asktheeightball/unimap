#!/usr/bin/env python3
"""Recover structured quiz fields that earlier imports only wrote into prose.

A development tool only. UniMap itself is static HTML, CSS, vanilla JavaScript
and JSON; Python is never required to run or deploy the site.

Usage:
    python3 tools/derive_quiz_fields.py --dry-run
    python3 tools/derive_quiz_fields.py

Exits 0 when every record was handled, 1 when a record could not be derived
safely and the catalogue was left untouched.

WHY THIS EXISTS
---------------
`tools/import_catalogue.py` fetched `hostname`, `disc_year` and
`discoverymethod` from the NASA Exoplanet Archive and `sp_type` from SIMBAD,
but it only ever rendered them into the generated `sourceSummary` sentence.
The values were retrieved from a real source (D7 is satisfied); they were
simply serialised into prose instead of into fields, so the quiz could not use
them. Re-running the importer would be the natural fix, but every astronomy
host is refused by the sandbox network policy, so the values have to be
recovered from what is already committed.

THIS IS NOT PROSE PARSING
-------------------------
`sourceSummary` is not human writing. It is emitted by our own importer from a
fixed template, in this repository, at a known revision. This tool reverses
that exact template and then PROVES the reversal by re-rendering the whole
sentence from the captured values and requiring it to equal the stored string
byte for byte. A record whose summary does not reproduce exactly is reported
and left completely alone -- nothing is guessed, inferred or rounded. No new
fact is created: every value written here was already published verbatim in the
committed catalogue.

`spectralType` needs no reversal at all. The importer stored it as a structured
alias (`"Spectral type G2IV"`), so it is read straight out of `aliases`.

`wellKnown` is not a fact about the sky. It is an editorial eligibility flag for
the quiz's Effortless mode, derived from the curated identifier lists a
maintainer already wrote in `tools/sources.json`. See `well_known_rule` below.

The importer has been updated to write all four fields directly, so a future
import does not need this tool. It stays in the repository because it documents
how the committed values were recovered and can be re-run to verify them.
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "celestial-bodies.json"
SOURCES = Path(__file__).resolve().parent / "sources.json"

SPECTRAL_ALIAS_PREFIX = "Spectral type "

# The exoplanet `sourceSummary` template, reversed. Every group corresponds to
# one interpolation in `exoplanet_archive()`; the sentence structure, the
# thousands separators and the decimal places are all fixed by that function, so
# this pattern is anchored end to end and cannot match a differently shaped
# string.
EXOPLANET_SUMMARY = re.compile(
    r"^(?P<name>.+?) is a confirmed exoplanet(?: orbiting (?P<host>.+?))?\. "
    r"The system lies about (?P<light_years>[\d,]+\.\d) light years from Earth\. "
    r"The planet's radius is (?P<radius>[\d,]+\.\d\d) times Earth's\."
    r"(?: Its best mass estimate is (?P<mass>[\d,]+\.\d\d) times Earth's\.)?"
    r"(?: It was discovered in (?P<year>\d{4})"
    r"(?: using the (?P<method>.+?) method)?\.)?$"
)


def render_exoplanet_summary(parts: dict) -> str:
    """Re-render the exoplanet summary from captured values.

    This mirrors `exoplanet_archive()` in `tools/import_catalogue.py` exactly.
    Its output is compared against the stored string; a mismatch means the
    reversal is not trustworthy for that record and the record is refused.
    """
    host = parts.get("host")
    sentences = [
        f"{parts['name']} is a confirmed exoplanet" + (f" orbiting {host}." if host else "."),
        f"The system lies about {parts['light_years']} light years from Earth.",
        f"The planet's radius is {parts['radius']} times Earth's.",
    ]
    if parts.get("mass"):
        sentences.append(f"Its best mass estimate is {parts['mass']} times Earth's.")
    if parts.get("year") and parts.get("method"):
        sentences.append(
            f"It was discovered in {parts['year']} using the {parts['method']} method."
        )
    elif parts.get("year"):
        sentences.append(f"It was discovered in {parts['year']}.")
    return " ".join(sentences)


def derive_exoplanet(record: dict) -> tuple[dict, str | None]:
    """Return the fields recoverable from an exoplanet record, or a refusal."""
    summary = str(record.get("sourceSummary") or "")
    if not summary:
        return {}, "no sourceSummary to derive from"

    match = EXOPLANET_SUMMARY.match(summary)
    if not match:
        return {}, "sourceSummary does not match the importer template"

    captured = match.groupdict()
    if render_exoplanet_summary(captured) != summary:
        return {}, "reversed values do not re-render the stored summary exactly"

    # The name in the sentence must be the record's own name. If it is not, the
    # summary belongs to a different object and nothing here can be trusted.
    if captured["name"] != record.get("name"):
        return {}, f"summary names {captured['name']!r}, record is {record.get('name')!r}"

    derived = {}
    host = captured.get("host")
    if host:
        # Independent corroboration: the importer also wrote the host into an
        # alias as "<host> system". Requiring both to agree means the host is
        # confirmed by two separately stored copies of the same fetched value.
        expected_alias = f"{host} system"
        aliases = record.get("aliases") or []
        if expected_alias not in aliases:
            return {}, f"host {host!r} is not corroborated by the {expected_alias!r} alias"
        derived["hostName"] = host

    if captured.get("year"):
        derived["discoveryYear"] = captured["year"]
    if captured.get("method"):
        derived["discoveryMethod"] = captured["method"]
    return derived, None


def derive_spectral_type(record: dict) -> dict:
    """Read the spectral type out of the structured alias the importer wrote."""
    for alias in record.get("aliases") or []:
        if isinstance(alias, str) and alias.startswith(SPECTRAL_ALIAS_PREFIX):
            value = alias[len(SPECTRAL_ALIAS_PREFIX):].strip()
            if value:
                return {"spectralType": value}
    return {}


# --- Effortless eligibility ------------------------------------------------

# Records whose fame is editorial rather than list-derived. The four solar
# system planets and the Sun are in the catalogue because they are the objects
# a visitor already knows; the Milky Way is the galaxy they are standing in.
# They predate the curated source lists and appear in none of them.
ALWAYS_WELL_KNOWN_IDS = {"sol", "milky-way"}
ALWAYS_WELL_KNOWN_TYPES = {"Planet"}

# A name that is a bare catalogue designation ("M 74", "NGC 1300", "PSR
# B0531+21") is not a common name, whatever the object's standing. Effortless
# prefers common names, so `wellKnown` records whose name matches this are still
# flagged well-known but are excluded from the Effortless pool by quiz.js.
CATALOGUE_DESIGNATION = re.compile(
    r"^(?:M|NGC|IC|UGCA|PSR|SGR|RX|KOI|HD|HIP|GJ|Gl|TOI|K2|EPIC|3C|4U|GRO|GRS|GS|XTE)"
    r"[\s\-]?[\dBJ]",
    re.IGNORECASE,
)


def curated_identity(sources: dict) -> tuple[set, set, set]:
    """Collect the maintainer-curated identifiers from tools/sources.json.

    `select_identifiers` and `select_names` are the explicit lists a maintainer
    wrote to choose which objects to import -- "the brightest naked-eye stars",
    "curated Messier/NGC/IC galaxies", "pulsars of historical or educational
    importance", "the IAU-recognised dwarf planets". Membership of one of those
    lists IS the notability judgement, already made and already reviewed.

    `id_overrides` maps a source identifier onto the record UniMap keeps it
    under, which is how "M 31" reaches the record named "Andromeda".
    """
    identifiers, override_ids, override_names = set(), set(), set()
    for source in sources.get("sources") or []:
        for key in ("select_identifiers", "select_names"):
            for value in source.get(key) or []:
                identifiers.add(value)
        for override in (source.get("id_overrides") or {}).values():
            if override.get("id"):
                override_ids.add(override["id"])
            if override.get("name"):
                override_names.add(override["name"])
    return identifiers, override_ids, override_names


def well_known_rule(record: dict, identifiers: set, override_ids: set, override_names: set) -> bool:
    """The documented Effortless eligibility predicate.

    A record is well-known when a maintainer already selected it by name:
    its name, id or any alias appears in a curated list in `tools/sources.json`,
    or it is the target of one of those lists' `id_overrides`, or it is one of
    the always-well-known solar-system records above.
    """
    if record.get("id") in ALWAYS_WELL_KNOWN_IDS:
        return True
    if record.get("type") in ALWAYS_WELL_KNOWN_TYPES:
        return True
    if record.get("id") in override_ids or record.get("name") in override_names:
        return True
    candidates = {record.get("name"), record.get("id")} | set(record.get("aliases") or [])
    return bool(candidates & identifiers)


# --- driver ----------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would change without writing the catalogue")
    args = parser.parse_args()

    bodies = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    identifiers, override_ids, override_names = curated_identity(sources)

    added = Counter()
    refusals = []

    for record in bodies:
        derived = {}

        if record.get("type") == "Exoplanet":
            fields, refusal = derive_exoplanet(record)
            if refusal:
                refusals.append(f"{record.get('id')}: {refusal}")
            derived.update(fields)

        derived.update(derive_spectral_type(record))

        if well_known_rule(record, identifiers, override_ids, override_names):
            derived["wellKnown"] = True

        for field, value in derived.items():
            if record.get(field) == value:
                continue
            if field in record:
                # A field already present with a different value is a conflict,
                # not something to overwrite: the committed value wins and the
                # difference is reported.
                refusals.append(
                    f"{record.get('id')}: {field} already set to {record[field]!r}, "
                    f"derived {value!r}"
                )
                continue
            record[field] = value
            added[field] += 1

    print(f"records: {len(bodies)}")
    for field, count in sorted(added.items()):
        print(f"  +{field}: {count}")

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
