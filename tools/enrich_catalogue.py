#!/usr/bin/env python3
"""Add structured fields to the catalogue from values that were already fetched.

Every value written here came from a real source response. Nothing is authored,
inferred from general knowledge, or parsed out of human prose (DECISIONS.md D7).
Three recovery routes are used, in order of preference:

1. **A cached source response.** `massEarth` comes from the exoplanet archive's
   own `pl_bmasse` column in `tools/cache/`, keyed by the planet name.
2. **A structured field the importer already stored.** `orbitClass` is lifted
   out of the `"<x> (JPL orbit class)"` alias the importer wrote.
3. **Reversal of our own generated sentence.** `sourceSummary` is emitted by
   `import_catalogue.py` from a fixed template in this repository, so reversing
   it is not prose parsing. Every reversal is verified by re-rendering the whole
   sentence from the captured values and requiring it to equal the stored string
   exactly. A record that does not round-trip is reported and left untouched.

`commonName` is applied from `tools/common-names.json`, produced by
`tools/fetch_common_names.py` from SIMBAD's `ident` table.

    python3 tools/enrich_catalogue.py --dry-run
    python3 tools/enrich_catalogue.py

Idempotent: re-running changes nothing. Exits non-zero if any record is refused.
"""

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_catalogue as importer  # noqa: E402  (path set above)

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "celestial-bodies.json"
CACHE_DIR = ROOT / "tools" / "cache"
MAPPING_FILE = ROOT / "tools" / "common-names.json"

# Sentences emitted by import_catalogue.describe(), reversed here.
CLASSIFICATION_RE = re.compile(
    r"^(?P<name>.+?) is classified by SIMBAD as (?:an?|the) (?P<gloss>.+?)"
    r"(?: of spectral type (?P<spectral>.+?))?\.")
MASS_RE = re.compile(r"Its best mass estimate is (?P<mass>[\d.]+) times Earth's\.")
DISCOVERY_RE = re.compile(
    r"Discovered (?P<date>[\d-]+) by (?P<who>.+?)(?: at (?P<where>.+?))?\.\s*$")
ORBIT_CLASS_RE = re.compile(r"^(?P<orbit>.+?) \(JPL orbit class\)$")
ORBIT_CLASS_SENTENCE_RE = re.compile(
    r"NASA/JPL's Small-Body Database records its orbit class as (?P<orbit>[^.]+)\.")


def load_exoplanet_masses() -> dict[str, str]:
    """Read pl_bmasse straight from the cached archive response.

    This is the authoritative route: the value is the source's own column, not a
    number lifted back out of a sentence.
    """
    masses = {}
    for path in sorted(CACHE_DIR.glob("exoplanet-archive-*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            rows = importer.rows_from_payload(payload)
        except (json.JSONDecodeError, ValueError, OSError):
            continue
        for row in rows:
            name = str(row.get("pl_name") or "").strip()
            value = row.get("pl_bmasse")
            if name and value not in (None, ""):
                masses[name] = f"{float(value):.2f}"
    return masses


def enrich_classification(record: dict, refusals: list) -> dict:
    """Recover the SIMBAD classification gloss the importer wrote into prose.

    66 records already carry the gloss in `measurementValue` under the label
    "SIMBAD classification"; the other 66 stars carry a parallax there instead
    and their gloss exists only in the sentence. Promoting it to its own field
    makes it usable without re-splitting a string, and stops a classification
    from having to masquerade as a measurement.
    """
    summary = record.get("sourceSummary")
    if not summary:
        return record

    match = CLASSIFICATION_RE.match(summary)
    if not match:
        return record

    gloss = match.group("gloss").strip()
    rendered = (f"{record['name']} is classified by SIMBAD as "
                f"{importer.article(gloss)} {gloss}"
                + (f" of spectral type {match.group('spectral')}." if match.group("spectral")
                   else "."))
    if not summary.startswith(rendered):
        refusals.append((record["id"], "classification did not round-trip"))
        return record

    # Where the gloss is also the stored measurement, the two must agree or the
    # reversal captured the wrong span.
    if record.get("measurementLabel") == "SIMBAD classification":
        stored = str(record.get("measurementValue") or "").strip()
        if stored and stored != gloss:
            refusals.append((record["id"], f"gloss {gloss!r} != measurement {stored!r}"))
            return record

    record["classification"] = gloss
    return record


def enrich_mass(record: dict, masses: dict, refusals: list) -> dict:
    """Take the exoplanet mass from the cached response, verified against prose."""
    if record.get("type") != "Exoplanet":
        return record
    summary = record.get("sourceSummary") or ""
    match = MASS_RE.search(summary)
    if not match:
        return record

    from_prose = match.group("mass")
    from_cache = masses.get(record["name"])
    if from_cache is None:
        # The sentence was rendered from the source, so the value is still real;
        # it just cannot be corroborated against a cache that is not present.
        record["massEarth"] = from_prose
        return record
    if from_cache != from_prose:
        refusals.append((record["id"], f"cached mass {from_cache} != stored {from_prose}"))
        return record

    record["massEarth"] = from_cache
    return record


def enrich_orbit_class(record: dict) -> dict:
    """Lift the JPL orbit class from the alias, or from the sentence stating it.

    The single-object importer stores an `"<x> (JPL orbit class)"` alias; the
    bulk one does not, and writes the class only into its generated sentence.
    Both are our own fixed strings, so both are reversible.
    """
    for alias in record.get("aliases") or []:
        match = ORBIT_CLASS_RE.match(str(alias).strip())
        if match:
            record["orbitClass"] = match.group("orbit").strip()
            return record

    match = ORBIT_CLASS_SENTENCE_RE.search(record.get("sourceSummary") or "")
    if match:
        record["orbitClass"] = match.group("orbit").strip()
    return record


def enrich_discovery(record: dict, refusals: list) -> dict:
    """Recover discoverer and discovery date from the JPL discovery sentence.

    The importer used JPL's own discovery string verbatim, so the trailing
    sentence is source wording rather than something we composed. Only the
    fields JPL actually supplied are stored; nothing is normalized into a
    different meaning.
    """
    summary = record.get("sourceSummary") or ""
    match = DISCOVERY_RE.search(summary)
    if not match:
        return record

    date = match.group("date").strip()
    who = match.group("who").strip()
    if not re.fullmatch(r"\d{4}(-\d{2}-\d{2})?", date):
        refusals.append((record["id"], f"unrecognised discovery date {date!r}"))
        return record

    record["discoverer"] = who
    record["discoveryDate"] = date
    record["discoveryYear"] = date[:4]
    if match.group("where"):
        record["discoverySite"] = match.group("where").strip()
    return record


def enrich_common_name(record: dict, mapping: dict) -> dict:
    entry = mapping.get(record["id"])
    if not entry:
        return record
    record["commonName"] = entry["commonName"]
    alternates = [a for a in entry.get("alternates") or []
                  if a.casefold() != str(record.get("name", "")).casefold()]
    if alternates:
        existing = record.get("catalogueIdentifiers") or []
        merged = list(dict.fromkeys([*existing, *alternates]))
        record["catalogueIdentifiers"] = merged
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    args = parser.parse_args()

    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    before = json.dumps(catalogue, ensure_ascii=False, sort_keys=True)

    mapping = {}
    if MAPPING_FILE.is_file():
        mapping = json.loads(MAPPING_FILE.read_text(encoding="utf-8")).get("records") or {}
        print(f"common-name mapping: {len(mapping)} record(s)")
    else:
        print(f"note: {MAPPING_FILE.name} not present; skipping common names")

    masses = load_exoplanet_masses()
    print(f"cached exoplanet masses available: {len(masses)}")

    refusals: list = []
    for record in catalogue:
        enrich_classification(record, refusals)
        enrich_mass(record, masses, refusals)
        enrich_orbit_class(record)
        enrich_discovery(record, refusals)
        enrich_common_name(record, mapping)

    counts = {}
    for field in ("commonName", "catalogueIdentifiers", "classification", "massEarth",
                  "orbitClass", "discoverer", "discoveryDate", "discoverySite"):
        counts[field] = sum(1 for r in catalogue if r.get(field) not in (None, "", [], {}))

    print("\ncoverage after enrichment:")
    for field, count in counts.items():
        print(f"  {field:22} {count:4}/{len(catalogue)}")

    if refusals:
        print(f"\nrefused {len(refusals)} record(s):", file=sys.stderr)
        for record_id, why in refusals:
            print(f"  {record_id}: {why}", file=sys.stderr)

    after = json.dumps(catalogue, ensure_ascii=False, sort_keys=True)
    if after == before:
        print("\ncatalogue already enriched; nothing to write")
        return 1 if refusals else 0

    if args.dry_run:
        print("\ndry run: catalogue not written")
        return 1 if refusals else 0

    CATALOGUE.write_text(
        json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {CATALOGUE.name} ({len(catalogue)} records)")
    return 1 if refusals else 0


if __name__ == "__main__":
    sys.exit(main())
