#!/usr/bin/env python3
"""Merge validated staging files into celestial-bodies.json.

A development tool only. This is the ONLY script that writes the production
catalogue, and it refuses to do so unless the merged result passes validation.

Safety rules:

- The merged catalogue is validated before anything is written.
- The previous catalogue is copied to celestial-bodies.json.bak first.
- A staged record never overwrites a record from a different source.
- A staged record never overwrites a hand-curated record of a different type.
- Hand-curated fields (summary, image, aliases you wrote) are preserved.
- Output is deterministic: grouped by type, alphabetical within each type.

Usage:
    python3 tools/promote_staging.py --dry-run     # report the merge, write nothing
    python3 tools/promote_staging.py               # promote every staged file
    python3 tools/promote_staging.py --only exoplanet-archive

Uses only the Python standard library.
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CATALOGUE = ROOT / "celestial-bodies.json"
STAGING_DIR = TOOLS / "staging"

# Fields an importer owns; everything else on an existing record is curated
# and must survive promotion untouched.
MANAGED_FIELDS = (
    "name", "type", "distance", "size", "circumference",
    "measurementLabel", "measurementValue",
    "rightAscension", "declination", "sourceSummary",
    "sourceName", "sourceUrl", "lastReviewed",
)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"error: {path.name} is not valid JSON "
                         f"(line {exc.lineno}, column {exc.colno}): {exc.msg}")
    except OSError as exc:
        raise SystemExit(f"error: cannot read {path}: {exc}")


def merge(existing: list, staged: list) -> tuple[list, int, int, int]:
    by_id = {}
    for record in existing:
        if not isinstance(record, dict) or "id" not in record:
            raise SystemExit(f"error: production catalogue has a record without an id: {record!r}")
        by_id[record["id"]] = record

    added = updated = refused = 0

    for record in staged:
        identifier = record.get("id")
        if not identifier:
            print(f"refuse: staged record without an id: {record!r}", file=sys.stderr)
            refused += 1
            continue

        current = by_id.get(identifier)
        if current is None:
            by_id[identifier] = record
            added += 1
            continue

        owner = current.get("sourceName")
        incoming = record.get("sourceName")

        if owner and incoming and owner != incoming:
            print(f"refuse: {identifier!r} belongs to {owner!r}, "
                  f"staged copy came from {incoming!r}", file=sys.stderr)
            refused += 1
            continue

        if not owner and current.get("type") != record.get("type"):
            print(f"refuse: {identifier!r} is a curated {current.get('type')!r} record; "
                  f"staged copy is a {record.get('type')!r}", file=sys.stderr)
            refused += 1
            continue

        merged_record = dict(current)
        merged_record.update({k: v for k, v in record.items() if k in MANAGED_FIELDS})
        if merged_record != current:
            updated += 1
        by_id[identifier] = merged_record

    ordered = sorted(by_id.values(), key=lambda r: (r.get("type", ""), r.get("name", "")))
    return ordered, added, updated, refused


def validate(records: list) -> int:
    """Validate a candidate catalogue in a temporary file."""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                     encoding="utf-8") as handle:
        json.dump(records, handle, indent=2, ensure_ascii=False)
        temporary = Path(handle.name)
    try:
        result = subprocess.run(
            [sys.executable, str(TOOLS / "validate_catalogue.py"), str(temporary)])
        return result.returncode
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="promote a single source id")
    parser.add_argument("--dry-run", action="store_true", help="report the merge, write nothing")
    args = parser.parse_args()

    if not STAGING_DIR.is_dir():
        raise SystemExit(f"error: no staging directory. Run tools/import_catalogue.py first.")

    pattern = f"{args.only}.staged.json" if args.only else "*.staged.json"
    staged_files = sorted(STAGING_DIR.glob(pattern))
    if not staged_files:
        raise SystemExit(f"error: no staging files matching {pattern!r} in "
                         f"{STAGING_DIR.relative_to(ROOT)}")

    existing = load_json(CATALOGUE)
    if not isinstance(existing, list):
        raise SystemExit("error: celestial-bodies.json must be a JSON array")

    before = len(existing)
    print(f"production catalogue: {before} record(s)")

    merged = existing
    total_added = total_updated = total_refused = 0

    for path in staged_files:
        staged = load_json(path)
        if not isinstance(staged, list):
            raise SystemExit(f"error: {path.name} must be a JSON array")
        merged, added, updated, refused = merge(merged, staged)
        print(f"  {path.name}: {len(staged)} staged -> +{added} new, "
              f"{updated} refreshed, {refused} refused")
        total_added += added
        total_updated += updated
        total_refused += refused

    print(f"\nmerged catalogue: {before} -> {len(merged)} record(s) "
          f"(+{total_added} new, {total_updated} refreshed, {total_refused} refused)")
    for body_type, count in sorted(Counter(r.get("type") for r in merged).items()):
        print(f"  {body_type:<14} {count:>4}")

    print("\nvalidating merged catalogue...")
    if validate(merged) != 0:
        print("\nerror: merged catalogue failed validation. "
              "celestial-bodies.json was NOT modified.", file=sys.stderr)
        return 1

    if args.dry_run:
        print("\ndry run: celestial-bodies.json was not modified")
        return 0

    backup = CATALOGUE.with_suffix(".json.bak")
    shutil.copy2(CATALOGUE, backup)
    CATALOGUE.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
                         encoding="utf-8")

    print(f"\nwrote {CATALOGUE.name} ({len(merged)} records)")
    print(f"previous catalogue backed up to {backup.name}")
    print("Now reload the app over a local server and re-run your checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
