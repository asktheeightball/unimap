#!/usr/bin/env python3
"""Fetch SIMBAD common names for catalogue objects into a curated mapping file.

Most imported records display a catalogue designation: `* alf CMa`, `M 31`,
`PSR B0531+21`. Those are the identifiers the sources returned, and they are
correct, but they are not what a reader searches for or recognises.

SIMBAD stores common names as `NAME <x>` entries in its `ident` table. They are
source-supplied values, not model recall, so recovering them satisfies D7. This
tool asks SIMBAD for every `NAME` identifier belonging to the objects UniMap
already curates, and writes `tools/common-names.json`.

The catalogue is not modified here. `tools/enrich_catalogue.py` applies the
mapping, so the fetch and the write stay reviewable as separate steps.

    python3 tools/fetch_common_names.py --dry-run
    python3 tools/fetch_common_names.py

An object often carries several NAME entries (`Sirius` and `Sirius A`, `Hadar`
and `Agena`). Choosing between them is an editorial decision, so it is made by a
fixed, documented rule rather than by preference: the shortest name wins, ties
break alphabetically. Every other name is kept in `alternates`, so nothing the
source supplied is discarded and search can still match all of them.
"""

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_catalogue as importer  # noqa: E402  (path set above)

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
CATALOGUE = ROOT / "celestial-bodies.json"
CACHE_DIR = TOOLS / "cache"
MAPPING_FILE = TOOLS / "common-names.json"

ENDPOINT = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
SOURCE_NAME = "SIMBAD (CDS, Strasbourg)"
SOURCE_URL = "https://simbad.cds.unistra.fr/"

# Sources whose curated identifier lists name objects UniMap actually carries.
SIMBAD_SOURCE_IDS = (
    "simbad-notable-stars",
    "simbad-galaxies",
    "simbad-nebulae",
    "simbad-pulsars",
)


def build_query(identifiers: list[str]) -> str:
    """Every NAME identifier of every object matching a curated identifier.

    The inner select resolves the curated identifiers to SIMBAD objects; the
    outer one then lists *all* names those objects carry, which is what makes a
    common name discoverable from a designation.
    """
    quoted = importer.quote_identifiers(identifiers)
    return " ".join(f"""
        select b.main_id, i.id
        from basic as b join ident as i on b.oid = i.oidref
        where b.oid in (
            select b2.oid from basic as b2 join ident as i2 on b2.oid = i2.oidref
            where i2.id in ({quoted})
        )
        and i.id like 'NAME %'
    """.split())


def fetch(query: str, timeout: int, refresh: bool, context) -> dict:
    url = f"{ENDPOINT}?" + urllib.parse.urlencode({
        "request": "doQuery", "lang": "ADQL", "format": "json", "query": query,
    })
    # Shaped like a sources.json entry because importer.fetch caches by source id
    # and names the endpoint in its error messages.
    source = {"id": "simbad-common-names", "endpoint": ENDPOINT}
    body, path = importer.fetch(source, url, timeout, refresh, context)
    print(f"  cached response: {path.relative_to(ROOT)}")
    return json.loads(body)


def rows_of(payload: dict) -> list[dict]:
    return importer.rows_from_payload(payload)


def choose(names: list[str]) -> str:
    """Shortest name wins; ties break alphabetically. Documented and stable."""
    return sorted(names, key=lambda n: (len(n), n.casefold()))[0]


def record_id_for(main_id: str, overrides: dict) -> tuple[str, str]:
    """Map a SIMBAD main_id onto a catalogue id exactly as the importer does."""
    display, identifier = importer.simbad_name(main_id)
    override = overrides.get(identifier, {})
    return override.get("id") or importer.slugify(display), identifier


def build_mapping(rows: list[dict], catalogue: list[dict], overrides: dict) -> tuple[dict, list]:
    by_id = {r["id"]: r for r in catalogue}
    grouped: dict[str, dict] = {}

    for row in rows:
        main_id = row.get("main_id")
        raw = str(row.get("id") or "").strip()
        if not main_id or not raw.startswith("NAME "):
            continue
        name = raw[len("NAME "):].strip()
        if not name:
            continue
        try:
            record_id, identifier = record_id_for(main_id, overrides)
        except ValueError:
            continue
        entry = grouped.setdefault(record_id, {"identifier": identifier, "names": set()})
        entry["names"].add(name)

    mapping, refusals = {}, []
    for record_id, entry in sorted(grouped.items()):
        record = by_id.get(record_id)
        if record is None:
            refusals.append((record_id, entry["identifier"], "no such record in the catalogue"))
            continue

        names = sorted(entry["names"])
        chosen = choose(names)

        # A common name that only repeats the record's own name adds nothing and
        # would show the same string twice in the interface.
        if chosen.casefold() == str(record.get("name", "")).casefold():
            refusals.append((record_id, entry["identifier"], f"name already {chosen!r}"))
            continue

        mapping[record_id] = {
            "commonName": chosen,
            "alternates": [n for n in names if n != chosen],
            "simbadIdentifier": entry["identifier"],
            "sourceName": SOURCE_NAME,
            "sourceUrl": SOURCE_URL,
        }

    return mapping, refusals


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    parser.add_argument("--refresh", action="store_true", help="refetch even if cached")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--ca-bundle", default=None,
                        help="PEM CA bundle (fixes local CERTIFICATE_VERIFY_FAILED "
                             "without disabling verification)")
    args = parser.parse_args()

    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    sources = importer.load_sources()

    identifiers, overrides = [], {}
    for source in sources:
        if source["id"] not in SIMBAD_SOURCE_IDS:
            continue
        identifiers += source.get("select_identifiers") or []
        overrides.update(source.get("id_overrides") or {})

    if not identifiers:
        raise SystemExit("error: no curated SIMBAD identifiers found in sources.json")

    print(f"catalogue: {len(catalogue)} record(s)")
    print(f"curated SIMBAD identifiers: {len(identifiers)}")

    payload = fetch(build_query(identifiers), args.timeout, args.refresh,
                    importer.ssl_context(args.ca_bundle))
    rows = rows_of(payload)
    print(f"  NAME rows returned: {len(rows)}")

    mapping, refusals = build_mapping(rows, catalogue, overrides)

    print(f"\nmapped {len(mapping)} record(s) to a SIMBAD common name")
    for record_id, entry in list(mapping.items())[:10]:
        extra = f"  (also {', '.join(entry['alternates'])})" if entry["alternates"] else ""
        print(f"  {record_id:24} -> {entry['commonName']}{extra}")
    if len(mapping) > 10:
        print(f"  ... and {len(mapping) - 10} more")

    if refusals:
        print(f"\nrefused {len(refusals)}:")
        for record_id, identifier, why in refusals:
            print(f"  {record_id:24} ({identifier}): {why}")

    duplicates = {}
    for record_id, entry in mapping.items():
        duplicates.setdefault(entry["commonName"].casefold(), []).append(record_id)
    clashes = {name: ids for name, ids in duplicates.items() if len(ids) > 1}
    if clashes:
        print("\nerror: two records resolved to the same common name:", file=sys.stderr)
        for name, ids in clashes.items():
            print(f"  {name}: {', '.join(ids)}", file=sys.stderr)
        return 1

    if args.dry_run:
        print("\ndry run: no file written")
        return 0

    document = {
        "_comment": [
            "Curated SIMBAD common names, fetched by tools/fetch_common_names.py.",
            "Values come from SIMBAD's ident table; none is authored here.",
            "Where an object carries several NAME entries the shortest wins, ties",
            "break alphabetically, and the rest are kept in 'alternates'.",
            "Applied to the catalogue by tools/enrich_catalogue.py.",
        ],
        "reviewed": datetime.now(timezone.utc).date().isoformat(),
        "sourceName": SOURCE_NAME,
        "sourceUrl": SOURCE_URL,
        "records": mapping,
    }
    MAPPING_FILE.write_text(
        json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {MAPPING_FILE.relative_to(ROOT)} ({len(mapping)} records)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
