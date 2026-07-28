#!/usr/bin/env python3
"""Apply the hand-written editorial layer in tools/editorial.json.

A development tool only. UniMap itself is static HTML, CSS, vanilla JavaScript
and JSON; Python is never required to run or deploy the site.

Usage:
    python3 tools/apply_editorial.py --dry-run
    python3 tools/apply_editorial.py

Exits 0 when every entry was applied, 1 when any entry was refused and the
catalogue was left untouched.

WHY THIS IS A SEPARATE TOOL
---------------------------
`tools/derive_enrichment.py` only ever moves values that a source already
published into fields that name them; it invents nothing and needs no review.
This tool does the opposite: it writes prose a person wrote. Keeping the two
apart means the catalogue always records which kind of text a record carries -
`summary` with `summarySource` is editorial, `sourceSummary` is importer-owned -
and a reviewer never has to guess which is which.

WHAT IT WILL REFUSE
-------------------
* An entry for an id the catalogue does not contain.
* A field already present on the record with a different value. The committed
  catalogue wins; the difference is reported. Editorial text never silently
  overwrites anything, including a previous edit of itself.
* A relation to an id that does not exist, a relation from a record to itself,
  or the same relation listed twice.
* An entry that would put editorial prose into `sourceSummary`, or that would
  claim source metadata the editorial layer has no right to set.

Re-running changes nothing.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CATALOGUE = ROOT / "celestial-bodies.json"
EDITORIAL = TOOLS / "editorial.json"

# Fields an editorial entry is allowed to set. `sourceSummary`, `sourceName`,
# `sourceUrl` and every measurement are deliberately absent: those belong to
# whatever actually measured the object.
ALLOWED_FIELDS = {
    "summary",
    "notability",
    "discoverer",
    "discoveryYear",
    "discoveryMethod",
    "discoveryDate",
    "constellation",
    "parentBody",
    "relatedObjectIds",
}

# Written onto every record this tool touches so the detail view and any future
# reviewer can tell hand-written text from importer-generated text.
EDITORIAL_MARK = "UniMap editorial"


def check_relations(entries: dict, ids: set) -> list:
    """Validate every declared relation before any of them is written."""
    problems = []
    for record_id, entry in sorted(entries.items()):
        related = entry.get("relatedObjectIds")
        if related is None:
            continue
        if not isinstance(related, list) or not all(isinstance(x, str) for x in related):
            problems.append(f"{record_id}: relatedObjectIds must be a list of strings")
            continue
        if record_id in related:
            problems.append(f"{record_id}: relates to itself")
        seen = Counter(related)
        for target, count in sorted(seen.items()):
            if count > 1:
                problems.append(f"{record_id}: relation to {target!r} listed {count} times")
            if target not in ids:
                problems.append(f"{record_id}: relation to {target!r}, which is not a record")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true",
                        help="report what would change without writing the catalogue")
    args = parser.parse_args()

    bodies = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    editorial = json.loads(EDITORIAL.read_text(encoding="utf-8"))
    entries = editorial["records"]
    reviewed = editorial["reviewed"]

    by_id = {record.get("id"): record for record in bodies}
    refusals = []

    for record_id, entry in sorted(entries.items()):
        if record_id not in by_id:
            refusals.append(f"{record_id}: no such record in the catalogue")
        unknown = set(entry) - ALLOWED_FIELDS
        if unknown:
            refusals.append(f"{record_id}: editorial may not set "
                            f"{', '.join(sorted(unknown))}")

    refusals.extend(check_relations(entries, set(by_id)))

    added = Counter()
    unchanged = Counter()
    touched = 0

    for record_id, entry in sorted(entries.items()):
        record = by_id.get(record_id)
        if record is None:
            continue

        applied = dict(entry)
        if "summary" in applied or "notability" in applied:
            applied["summarySource"] = EDITORIAL_MARK
            applied["summaryReviewed"] = reviewed

        changed = False
        for field, value in applied.items():
            if record.get(field) == value:
                unchanged[field] += 1
                continue
            if field in record:
                refusals.append(
                    f"{record_id}: {field} already set to {record[field]!r}, "
                    f"editorial says {value!r}"
                )
                continue
            record[field] = value
            added[field] += 1
            changed = True
        if changed:
            touched += 1

    print(f"records: {len(bodies)}; editorial entries: {len(entries)}; "
          f"records touched: {touched}")
    for field in sorted(set(added) | set(unchanged)):
        print(f"  {field}: +{added[field]} new, {unchanged[field]} already correct")

    if refusals:
        print(f"\n{len(refusals)} refusal(s); catalogue not written:", file=sys.stderr)
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
