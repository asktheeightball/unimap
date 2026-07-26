#!/usr/bin/env python3
"""Import celestial bodies from authoritative sources into a staging file.

A development tool only. UniMap itself is static HTML, CSS, vanilla JavaScript
and JSON; Python is never required to run, build, or deploy the site, and the
browser never calls these services.

Pipeline:

    authoritative source -> raw response cache -> normalized records
                         -> tools/staging/<source>.staged.json -> validation

This script NEVER writes celestial-bodies.json. Promoting a validated staging
file into the production catalogue is a separate, deliberate step:

    python3 tools/promote_staging.py

Usage:
    python3 tools/import_catalogue.py --list
    python3 tools/import_catalogue.py --source exoplanet-archive --probe
    python3 tools/import_catalogue.py --source exoplanet-archive --limit 50
    python3 tools/import_catalogue.py --all --limit 40

Uses only the Python standard library.
"""

import argparse
import hashlib
import json
import math
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CATALOGUE = ROOT / "celestial-bodies.json"
SOURCES_FILE = TOOLS / "sources.json"
CACHE_DIR = TOOLS / "cache"
STAGING_DIR = TOOLS / "staging"

PARSEC_IN_LIGHT_YEARS = 3.261563777
EARTH_RADIUS_KM = 6371.0
AU_IN_KM = 149_597_870.7

# Fields an importer owns. Anything else on a record it previously wrote --
# a hand-written summary, a curated image -- survives a rerun untouched.
MANAGED_FIELDS = (
    "name", "type", "distance", "size", "circumference",
    "measurementLabel", "measurementValue",
    "rightAscension", "declination", "sourceSummary",
    "sourceName", "sourceUrl", "lastReviewed",
)


def article(phrase: str) -> str:
    """Pick "a" or "an" for a classification gloss.

    Only the glosses in OTYPE_TO_TYPE are ever passed here, so this handles the
    cases that actually occur rather than trying to be a general rule: the
    vowel-initial ones ("active galaxy nucleus", "open cluster", "eruptive
    variable") and "HII region", which is read aloud as "an aitch-two region".
    """
    word = str(phrase).strip()
    if word.upper().startswith("HII"):
        return "an"
    return "an" if word[:1].lower() in "aeiou" else "a"


def describe(*parts) -> str:
    """Join sentence fragments into a description, dropping empty ones.

    Every fragment handed in must be built from a value the source actually
    returned. This assembles retrieved values into readable prose; it never adds
    a fact of its own (DECISIONS.md D7, D12).
    """
    return " ".join(part.strip() for part in parts if part and part.strip())


# --- helpers -------------------------------------------------------------


def slugify(name: str) -> str:
    """Turn an object name into a stable lowercase id."""
    slug = re.sub(r"[^a-z0-9]+", "-", str(name).strip().lower()).strip("-")
    if not slug:
        raise ValueError(f"cannot derive an id from name {name!r}")
    return slug


def number(value, field: str):
    """Coerce a source value to float, refusing anything unusable.

    Sources use null, "", and occasionally "null" for absent measurements.
    None of those may become a displayed number.
    """
    if value is None or (isinstance(value, str) and value.strip().lower() in ("", "null", "nan")):
        raise ValueError(f"{field} is absent")
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} is not numeric: {value!r}")
    if math.isnan(result) or math.isinf(result):
        raise ValueError(f"{field} is not a finite number: {value!r}")
    return result


def rows_from_payload(payload):
    """Normalize the three response shapes these services return.

    Handles a plain array of objects, the IVOA TAP {"metadata": [...],
    "data": [[...]]} shape, and the JPL {"fields": [...], "data": [[...]]}
    shape, so a source that changes format does not silently import nothing.
    """
    if isinstance(payload, list):
        if payload and not isinstance(payload[0], dict):
            raise ValueError("array response did not contain objects")
        return payload

    if not isinstance(payload, dict):
        raise ValueError(f"unexpected response type: {type(payload).__name__}")

    data = payload.get("data")
    if data is None:
        raise ValueError(f"response has no 'data' key (keys: {sorted(payload)})")

    columns = payload.get("fields") or payload.get("metadata")
    if not columns:
        raise ValueError(f"response has no column names (keys: {sorted(payload)})")

    names = []
    for column in columns:
        if isinstance(column, dict):
            names.append(column.get("name") or column.get("colname"))
        else:
            names.append(str(column))

    return [dict(zip(names, row)) for row in data]


# --- normalizers ---------------------------------------------------------
#
# Each returns a UniMap record or raises ValueError to skip the row.
# Every displayed number is arithmetic on a published value. Nothing is
# estimated, inferred, or filled in from general knowledge (DECISIONS.md D7).


def exoplanet_archive(row: dict, source: dict, reviewed: str) -> dict:
    name = str(row.get("pl_name") or "").strip()
    if not name:
        raise ValueError("row has no pl_name")

    light_years = number(row.get("sy_dist"), "sy_dist") * PARSEC_IN_LIGHT_YEARS
    radius_earths = number(row.get("pl_rade"), "pl_rade")
    diameter_km = 2.0 * radius_earths * EARTH_RADIUS_KM

    record = {
        "id": slugify(name),
        "name": name,
        "type": "Exoplanet",
        "distance": f"~{light_years:,.1f} ly",
        "size": f"~{diameter_km:,.0f} km (diameter)",
        "circumference": f"~{math.pi * diameter_km:,.0f} km",
        "measurementLabel": "Radius (Earth radii)",
        "measurementValue": f"{radius_earths:.2f}",
    }

    host = str(row.get("hostname") or "").strip()
    if host and host != name:
        record["aliases"] = [f"{host} system"]

    try:
        record["rightAscension"] = f"{number(row.get('ra'), 'ra'):.5f}"
        record["declination"] = f"{number(row.get('dec'), 'dec'):.5f}"
    except ValueError:
        pass  # Coordinates are optional; the rest of the record is still good.

    # The archive returns disc_year and discoverymethod on every row, so this is
    # the one source that can answer "how was it discovered".
    try:
        mass_earths = number(row.get("pl_bmasse"), "pl_bmasse")
        mass = f"Its best mass estimate is {mass_earths:,.2f} times Earth's."
    except ValueError:
        mass = ""

    year = str(row.get("disc_year") or "").strip()
    method = str(row.get("discoverymethod") or "").strip()
    discovery = ""
    if year and method:
        discovery = f"It was discovered in {year} using the {method} method."
    elif year:
        discovery = f"It was discovered in {year}."

    record["sourceSummary"] = describe(
        f"{name} is a confirmed exoplanet" + (f" orbiting {host}." if host else "."),
        f"The system lies about {light_years:,.1f} light years from Earth.",
        f"The planet's radius is {radius_earths:,.2f} times Earth's.",
        mass,
        discovery,
    )

    return record


# SIMBAD's otype_txt code -> the UniMap type it supports, and a plain-language
# gloss shown on the record. EVERY code here was observed in a real cached
# response (tools/cache/simbad-*.json, probed 2026-07-26); nothing is
# speculative, and a code that is not listed is skipped rather than guessed at.
#
# The mapping is the whole point of these sources: a curated list says which
# objects to ask for, but only the source may say what an object IS. The nebula
# list, for instance, asked for 28 famous objects and SIMBAD typed six of them
# as open clusters -- so they become Star Clusters, not Nebulae.
OTYPE_TO_TYPE = {
    # Stars.
    "*": ("Star", "star"),
    "**": ("Star", "double or multiple star"),
    "PM*": ("Star", "high proper-motion star"),
    "SB*": ("Star", "spectroscopic binary"),
    "V*": ("Star", "variable star"),
    "Mi*": ("Star", "Mira variable"),
    "cC*": ("Star", "classical Cepheid variable"),
    "dS*": ("Star", "Delta Scuti variable"),
    "bC*": ("Star", "Beta Cephei variable"),
    "a2*": ("Star", "Alpha2 Canum Venaticorum variable"),
    "BY*": ("Star", "BY Draconis variable"),
    "Er*": ("Star", "eruptive variable"),
    "Be*": ("Star", "Be star"),
    "RG*": ("Star", "red giant"),
    "sg*": ("Star", "supergiant"),
    "s*b": ("Star", "blue supergiant"),
    "s*r": ("Star", "red supergiant"),
    "s*y": ("Star", "yellow supergiant"),
    "LM*": ("Star", "low-mass star"),
    "LP?": ("Star", "candidate long-period variable"),
    # Galaxies, including active galaxies. In SIMBAD's hierarchy each of these
    # denotes a galaxy or a galaxy nucleus.
    "G": ("Galaxy", "galaxy"),
    "GiG": ("Galaxy", "galaxy in a group"),
    "GiP": ("Galaxy", "galaxy in a pair"),
    "GiC": ("Galaxy", "galaxy in a cluster"),
    "rG": ("Galaxy", "radio galaxy"),
    "AGN": ("Galaxy", "active galaxy nucleus"),
    "LIN": ("Galaxy", "LINER-type active galaxy nucleus"),
    "Sy1": ("Galaxy", "Seyfert 1 galaxy"),
    "Sy2": ("Galaxy", "Seyfert 2 galaxy"),
    "SyG": ("Galaxy", "Seyfert galaxy"),
    # Nebulae.
    "PN": ("Nebula", "planetary nebula"),
    "HII": ("Nebula", "HII region"),
    "RNe": ("Nebula", "reflection nebula"),
    "SNR": ("Nebula", "supernova remnant"),
    # Star clusters.
    "OpC": ("Star Cluster", "open cluster"),
    "Cl*": ("Star Cluster", "cluster of stars"),
    # Neutron stars.
    "Psr": ("Pulsar", "pulsar"),
}

# Codes seen in a real response that UniMap deliberately will NOT map, with the
# reason. Skipping these is a decision, not an oversight, so it is recorded
# here and reported by the importer rather than failing silently.
OTYPE_REFUSED = {
    "BLL": "BL Lac object: a jet-dominated blazar, not a defensible plain 'Galaxy'",
    "ISM": "interstellar matter: too generic to classify",
    "sh": "interstellar shell: too generic to classify",
    "HXB": "high-mass X-ray binary: a binary system, not a black-hole classification",
    "X": "X-ray source: an observation, not a classification",
}

# Leading markers SIMBAD puts on a main_id to say what KIND of thing it is
# ("V*" variable, "*" star, "NAME" common name). They are not part of the
# object's designation, so they are stripped for display and the untouched
# identifier is kept as an alias. Nothing is renamed or translated: "* alf CMa"
# becomes "alf CMa", never "Sirius".
SIMBAD_PREFIXES = ("NAME ", "V* ", "** ", "* ")


def simbad_name(main_id: str) -> tuple[str, str]:
    """Return (display name, full SIMBAD identifier) from a raw main_id.

    SIMBAD pads identifiers to a fixed width ("M  31", "*  51 Peg"), so the
    whitespace is collapsed first.
    """
    identifier = re.sub(r"\s+", " ", str(main_id or "")).strip()
    if not identifier:
        raise ValueError("row has no main_id")
    display = identifier
    for prefix in SIMBAD_PREFIXES:
        if display.startswith(prefix):
            display = display[len(prefix):].strip()
            break
    return (display or identifier), identifier


def simbad_identity(row: dict, source: dict, expected: str | None) -> tuple[dict, str]:
    """Shared identity, classification and coordinate handling for SIMBAD rows.

    Returns the record skeleton and the object-type gloss. Raises ValueError to
    skip the row when SIMBAD's own classification does not support a UniMap type.
    """
    display, identifier = simbad_name(row.get("main_id"))

    otype = str(row.get("otype_txt") or "").strip()
    if not otype:
        raise ValueError(f"{identifier}: row has no otype_txt")
    if otype in OTYPE_REFUSED:
        raise ValueError(f"{identifier}: refusing otype {otype!r} - {OTYPE_REFUSED[otype]}")
    if otype not in OTYPE_TO_TYPE:
        raise ValueError(f"{identifier}: otype {otype!r} has no approved UniMap type")

    body_type, gloss = OTYPE_TO_TYPE[otype]
    if expected and body_type != expected:
        raise ValueError(f"{identifier}: SIMBAD types this {otype!r} ({body_type}), "
                         f"not {expected}")

    # An editorial override says "this SIMBAD object is the record UniMap
    # already carries", so the import refreshes that record instead of adding a
    # second one under a catalogue designation. It supplies only an id and the
    # existing record's own name -- never a value.
    override = (source.get("id_overrides") or {}).get(identifier, {})
    record = {
        "id": override.get("id") or slugify(display),
        "name": override.get("name") or display,
        "type": body_type,
    }

    aliases = []
    if identifier != record["name"]:
        aliases.append(identifier)
    if aliases:
        record["aliases"] = aliases

    # ra/dec are DOUBLE degrees in the cached response, and may be absent.
    try:
        record["rightAscension"] = f"{number(row.get('ra'), 'ra'):.5f}"
        record["declination"] = f"{number(row.get('dec'), 'dec'):.5f}"
    except ValueError:
        pass

    return record, gloss


def position_note(record: dict) -> str:
    """State where an object sits, using only coordinates the source returned."""
    if "rightAscension" not in record or "declination" not in record:
        return ""
    return (f"It lies at right ascension {record['rightAscension']}°, "
            f"declination {record['declination']}° (J2000).")


def simbad_star(row: dict, source: dict, reviewed: str) -> dict:
    record, gloss = simbad_identity(row, source, expected="Star")

    spectral = str(row.get("sp_type") or "").strip()
    if spectral:
        record.setdefault("aliases", []).append(f"Spectral type {spectral}")

    # SIMBAD reports parallax in milliarcseconds; distance(pc) = 1000 / plx.
    # plx_value is null for some real stars (eta Car in the cached response), and
    # a star with no published parallax simply gets no distance -- the field is
    # optional precisely so it is never invented.
    try:
        parallax_mas = number(row.get("plx_value"), "plx_value")
    except ValueError:
        parallax_mas = None

    if parallax_mas is not None and parallax_mas > 0:
        light_years = (1000.0 / parallax_mas) * PARSEC_IN_LIGHT_YEARS
        record["distance"] = f"~{light_years:,.1f} ly"
        record["measurementLabel"] = "Parallax (mas)"
        record["measurementValue"] = f"{parallax_mas:.4f}"
        distance_note = (f"Its measured parallax of {parallax_mas:,.4f} mas puts it "
                         f"about {light_years:,.1f} light years from Earth.")
    else:
        record["measurementLabel"] = "SIMBAD classification"
        record["measurementValue"] = gloss
        distance_note = "SIMBAD publishes no parallax for it, so it carries no distance."

    record["sourceSummary"] = describe(
        f"{record['name']} is classified by SIMBAD as {article(gloss)} {gloss}"
        + (f" of spectral type {spectral}." if spectral else "."),
        distance_note,
        position_note(record),
    )

    # SIMBAD's basic table carries no radius, so no size/circumference is set.
    return record


def simbad_deep_sky(row: dict, source: dict, reviewed: str) -> dict:
    """Normalize a deep-sky SIMBAD row (galaxy, nebula, cluster, pulsar).

    The probed query returns main_id, ra, dec and otype_txt and NOTHING ELSE --
    in particular no distance, magnitude or size. These records therefore carry
    a name, a source-supplied classification and coordinates, and no distance at
    all. That is the honest result: SIMBAD's basic table has no distance column,
    galaxies and nebulae have no useful parallax, and a plausible-looking
    invented distance would be worse than an absent one (DECISIONS.md D7).
    """
    expected = None
    produces = source.get("produces") or []
    if len(produces) == 1:
        expected = produces[0]

    record, gloss = simbad_identity(row, source, expected=expected)
    record["measurementLabel"] = "SIMBAD classification"
    record["measurementValue"] = gloss

    record["sourceSummary"] = describe(
        f"{record['name']} is classified by SIMBAD as {article(gloss)} {gloss}.",
        position_note(record),
        "SIMBAD's basic table publishes no distance for this object, so none is "
        "recorded here.",
    )
    return record


def jpl_sbdb_object(row: dict, source: dict, reviewed: str) -> dict:
    """Normalize the JPL SBDB single-object response.

    This endpoint returns a nested document, not a row table:

        {"object": {...}, "orbit": {"elements": [...]}, "phys_par": [...],
         "discovery": {...}, "signature": {...}}

    Confirmed against tools/cache/jpl-sbdb-ceres-*.json. Units are read from the
    response itself rather than assumed, and a value in an unexpected unit is
    skipped rather than reinterpreted.
    """
    obj = row.get("object") or {}
    full_name = str(obj.get("fullname") or obj.get("shortname") or "").strip()
    if not full_name:
        raise ValueError("response has no object.fullname")

    # "1 Ceres (A801 AA)" -> "Ceres", keeping the full designation as an alias,
    # matching how jpl_sbdb already presents the trans-Neptunian dwarf planets.
    match = re.match(r"^\d+\s+([^(]+?)\s*(?:\(.*\))?$", full_name)
    name = match.group(1).strip() if match else full_name

    # The curated source states the type; SBDB's orbit_class is an ORBITAL
    # class ("Main-belt Asteroid"), which says where the body orbits, not what
    # kind of body it is. Same editorial rule as the TNO dwarf planets, where
    # sb-class=TNO likewise is not a body-type claim.
    produces = source.get("produces") or []
    if len(produces) != 1:
        raise ValueError("an object source must declare exactly one produced type")

    elements = {e.get("name"): e for e in (row.get("orbit") or {}).get("elements") or []}
    semi_major = elements.get("a") or {}
    if str(semi_major.get("units") or "").strip() != "au":
        raise ValueError(f"semi-major axis is not in au: {semi_major.get('units')!r}")
    semi_major_au = number(semi_major.get("value"), "orbit.elements.a")

    record = {
        "id": slugify(name),
        "name": name,
        "type": produces[0],
        "distance": f"~{semi_major_au:,.1f} AU (mean orbital distance)",
        "measurementLabel": "Semi-major axis (AU)",
        "measurementValue": f"{semi_major_au:.3f}",
    }

    aliases = []
    if full_name != name:
        aliases.append(full_name)
    orbit_class = ((obj.get("orbit_class") or {}).get("name") or "").strip()
    if orbit_class:
        aliases.append(f"{orbit_class} (JPL orbit class)")
    if aliases:
        record["aliases"] = aliases

    physical = {p.get("name"): p for p in row.get("phys_par") or []}
    diameter = physical.get("diameter") or {}
    diameter_km = None
    if str(diameter.get("units") or "").strip() == "km":
        try:
            diameter_km = number(diameter.get("value"), "phys_par.diameter")
        except ValueError:
            diameter_km = None
        if diameter_km is not None:
            record["size"] = f"~{diameter_km:,.0f} km (diameter)"
            record["circumference"] = f"~{math.pi * diameter_km:,.0f} km"

    # The single-object endpoint returns a discovery block the bulk query does
    # not, so these records can state how and by whom the object was found. The
    # sentence is used verbatim as the source wrote it.
    discovery = str((row.get("discovery") or {}).get("discovery") or "").strip()

    record["sourceSummary"] = describe(
        f"{name} orbits the Sun at a mean distance of {semi_major_au:,.2f} AU.",
        f"Its measured diameter is {diameter_km:,.0f} km." if diameter_km is not None else "",
        f"NASA/JPL's Small-Body Database records its orbit class as {orbit_class}."
        if orbit_class else "",
        f"{discovery.rstrip('.')}." if discovery else "",
    )

    return record


def jpl_sbdb(row: dict, source: dict, reviewed: str) -> dict:
    # SBDB returns e.g. " 136199 Eris (2003 UB313)" -- a leading space, a
    # catalogue number, and a provisional designation. Display "Eris" and keep
    # the full designation as an alias.
    designation = str(row.get("full_name") or row.get("name") or "").strip()
    if not designation:
        raise ValueError("row has no full_name")

    match = re.match(r"^\d+\s+([^(]+?)\s*(?:\(.*\))?$", designation)
    name = match.group(1).strip() if match else designation

    # Solar-system distance is an orbital semi-major axis in AU -- a different
    # quantity from the light-year distances used for deep-sky objects, so the
    # record says so explicitly rather than implying they are comparable.
    semi_major_au = number(row.get("a"), "a")

    record = {
        "id": slugify(name),
        "name": name,
        "type": "Dwarf Planet",
        "distance": f"~{semi_major_au:,.1f} AU (mean orbital distance)",
        "measurementLabel": "Semi-major axis (AU)",
        "measurementValue": f"{semi_major_au:.3f}",
    }

    if designation != name:
        record["aliases"] = [designation]

    try:
        diameter_km = number(row.get("diameter"), "diameter")
    except ValueError:
        diameter_km = None  # Many small bodies have no measured diameter.

    if diameter_km is not None:
        record["size"] = f"~{diameter_km:,.0f} km (diameter)"
        record["circumference"] = f"~{math.pi * diameter_km:,.0f} km"

    orbit_class = str(row.get("class") or "").strip()
    record["sourceSummary"] = describe(
        f"{name} orbits the Sun at a mean distance of {semi_major_au:,.2f} AU.",
        f"NASA/JPL's Small-Body Database records its orbit class as {orbit_class}."
        if orbit_class else "",
        f"Its measured diameter is {diameter_km:,.0f} km."
        if diameter_km is not None else
        "The Small-Body Database lists no measured diameter for it.",
    )

    return record


NORMALIZERS = {
    "exoplanet_archive": exoplanet_archive,
    "simbad_star": simbad_star,
    "simbad_deep_sky": simbad_deep_sky,
    "jpl_sbdb": jpl_sbdb,
    "jpl_sbdb_object": jpl_sbdb_object,
}


# --- fetching ------------------------------------------------------------


def quote_identifiers(identifiers: list) -> str:
    """Render a curated identifier list as an ADQL string list.

    Doubling an embedded apostrophe is the ADQL/SQL escape, and it matters:
    "Barnard's star" is a real SIMBAD identifier.
    """
    return ", ".join("'" + str(name).replace("'", "''") + "'" for name in identifiers)


def build_url(source: dict, limit: int | None) -> str:
    params = dict(source.get("params") or {})
    query = source.get("query")

    # A source that curates by name must see the whole result set, or the
    # objects it selects may fall outside an arbitrary row limit.
    if source.get("select_names"):
        limit = None

    if query:
        identifiers = source.get("select_identifiers")
        if "{identifiers}" in query:
            if not identifiers:
                raise SystemExit(f"error: source {source['id']!r} uses {{identifiers}} "
                                 f"but defines no select_identifiers")
            query = query.replace("{identifiers}", quote_identifiers(identifiers))
            # The query already names every object wanted, so a row cap could
            # only truncate the curated set. Asking for exactly these objects is
            # also the polite way to query a shared service.
            limit = None

        # TAP/ADQL uses TOP rather than LIMIT.
        query = query.replace("{limit}", f"top {int(limit)}" if limit else "")
        params["query"] = re.sub(r"\s+", " ", query).strip()
    elif limit:
        params["limit"] = str(int(limit))

    return f"{source['endpoint']}?{urllib.parse.urlencode(params)}"


def selected(record: dict, source: dict) -> bool:
    """Apply a source's editorial name filter.

    Some queries return far more than UniMap should carry, and a broad class
    filter is not a claim about an object's type: sb-class=TNO returns every
    trans-Neptunian object, only a few of which are dwarf planets. Choosing
    which objects to keep is an editorial decision recorded in sources.json;
    the values themselves still come from the source.
    """
    wanted = source.get("select_names")
    if not wanted:
        return True
    haystack = " ".join([record.get("name", ""), *record.get("aliases", [])]).lower()
    return any(term.lower() in haystack for term in wanted)


def cache_path(source: dict, url: str) -> Path:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:12]
    return CACHE_DIR / f"{source['id']}-{digest}.json"


def ssl_context(ca_bundle: str | None):
    """Build a TLS context, optionally from an explicit CA bundle.

    Some Python installations (commonly on Windows) cannot find a system trust
    store and fail with CERTIFICATE_VERIFY_FAILED. Pointing at a real CA bundle
    fixes that while keeping verification ON. Verification is never disabled.
    """
    if not ca_bundle:
        return None
    path = Path(ca_bundle)
    if not path.is_file():
        raise SystemExit(f"error: CA bundle not found: {path}")
    return ssl.create_default_context(cafile=str(path))


def fetch(source: dict, url: str, timeout: int, refresh: bool, context=None) -> tuple[str, Path]:
    """Fetch a source response, caching the raw body for audit and reruns."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = cache_path(source, url)

    if path.is_file() and not refresh:
        print(f"  cache hit: {path.relative_to(ROOT)} (use --refresh to refetch)")
        return path.read_text(encoding="utf-8"), path

    print(f"  GET {url[:120]}{'...' if len(url) > 120 else ''}")
    request = urllib.request.Request(url, headers={
        "User-Agent": "UniMap-importer/1.0 (static astronomy catalogue; contact repository owner)",
        "Accept": "application/json",
    })

    try:
        with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:800]
        raise SystemExit(f"error: {source['id']} request failed "
                         f"({exc.code} {exc.reason})\n{detail}")
    except urllib.error.URLError as exc:
        hint = ""
        if isinstance(exc.reason, ssl.SSLError) or "CERTIFICATE_VERIFY_FAILED" in str(exc.reason):
            hint = ("\n       This is a local trust-store problem, not a problem with the "
                    "source.\n"
                    "       Point at a CA bundle and keep verification on:\n"
                    "           python -m pip install certifi\n"
                    "           python -c \"import certifi; print(certifi.where())\"\n"
                    "           python tools/import_catalogue.py --ca-bundle <that path> ...\n"
                    "       Do not disable certificate verification.")
        raise SystemExit(f"error: cannot reach {source['id']} ({source['endpoint']}): "
                         f"{exc.reason}{hint}")

    path.write_text(body, encoding="utf-8")
    print(f"  cached -> {path.relative_to(ROOT)} ({len(body):,} bytes)")
    return body, path


def probe(source: dict, body: str, path: Path) -> int:
    """Report a response's real shape without importing anything.

    Run this first against a new or changed source. The normalizers were written
    without network access, so the cached file this produces is the ground truth
    for correcting them.
    """
    print(f"\n--- probe: {source['id']} ---")
    print(f"raw response cached at: {path.relative_to(ROOT)}")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        print(f"response is not JSON ({exc}); first 400 characters:\n{body[:400]}")
        return 1

    print(f"top-level type: {type(payload).__name__}")
    if isinstance(payload, dict):
        print(f"top-level keys: {sorted(payload)}")

    try:
        rows = rows_from_payload(payload)
    except ValueError as exc:
        print(f"could not extract rows: {exc}")
        return 1

    print(f"rows: {len(rows)}")
    if rows:
        print(f"columns: {sorted(rows[0])}")
        print("first row:")
        print(json.dumps(rows[0], indent=2, default=str)[:1200])
    return 0


# --- import --------------------------------------------------------------


def load_sources() -> list[dict]:
    config = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    sources = config.get("sources")
    if not isinstance(sources, list) or not sources:
        raise SystemExit(f"error: {SOURCES_FILE.name} defines no sources")
    return sources


def import_source(source: dict, args, existing_ids: set[str]) -> int:
    print(f"\n=== {source['id']} — {source['name']} ===")

    # A source nobody has ever seen a response from may be probed but not
    # imported. Its column names are assumptions, and an assumption that
    # silently normalizes into a record would put invented values in the
    # catalogue under a real source's name -- fabricated provenance, which is
    # the one failure this pipeline exists to prevent (DECISIONS.md D7).
    if source.get("unprobed") and not args.probe:
        print(f"  refusing to import: {source['id']!r} is marked unprobed.\n"
              f"  Probe it first and inspect the real response:\n"
              f"      python3 tools/import_catalogue.py --source {source['id']} --probe\n"
              f"  Then write or correct its normalizer against that cached response and\n"
              f"  remove \"unprobed\" from tools/sources.json.", file=sys.stderr)
        if source.get("note_unprobed"):
            print(f"  note: {source['note_unprobed']}", file=sys.stderr)
        return 1

    url = build_url(source, args.limit)
    body, path = fetch(source, url, args.timeout, args.refresh,
                       ssl_context(args.ca_bundle))

    # Probing deliberately happens before the normalizer is resolved: the whole
    # point of a probe is to see the response BEFORE writing the normalizer, so
    # a source may legitimately carry "normalizer": null until it has been run.
    if args.probe:
        return probe(source, body, path)

    normalizer = NORMALIZERS.get(source.get("normalizer"))
    if normalizer is None:
        raise SystemExit(f"error: source {source['id']!r} has no usable normalizer "
                         f"({source.get('normalizer')!r}). Probe the source, then write "
                         f"a normalizer against its real response.")

    try:
        payload = json.loads(body)
        # A single-object endpoint returns one nested document rather than a row
        # table, so it is passed to the normalizer whole.
        if source.get("response") == "object":
            rows = [payload]
        else:
            rows = rows_from_payload(payload)
    except (json.JSONDecodeError, ValueError) as exc:
        raise SystemExit(f"error: {source['id']} returned an unusable response: {exc}\n"
                         f"       run with --probe to inspect {path.relative_to(ROOT)}")

    print(f"  rows: {len(rows)}")

    reviewed = datetime.now(timezone.utc).date().isoformat()
    records, skipped, filtered, seen = [], 0, 0, set()

    for row in rows:
        try:
            record = normalizer(row, source, reviewed)
        except (ValueError, TypeError) as exc:
            if args.verbose:
                print(f"  skip: {exc}", file=sys.stderr)
            skipped += 1
            continue

        if not selected(record, source):
            filtered += 1
            continue

        if record["id"] in seen:
            print(f"  skip: duplicate id {record['id']!r} within this import", file=sys.stderr)
            skipped += 1
            continue
        if record["id"] in existing_ids:
            print(f"  note: {record['id']!r} already in the catalogue; "
                  f"promote will refresh it in place")

        seen.add(record["id"])
        record["sourceName"] = source["name"]
        record["sourceUrl"] = source["url"]
        record["lastReviewed"] = reviewed
        records.append(record)

    records.sort(key=lambda r: (r["type"], r["name"]))
    print(f"  normalized: {len(records)} record(s), {skipped} skipped")
    if filtered:
        wanted = ", ".join(source["select_names"])
        print(f"  curation filter kept {len(records)} of {len(records) + filtered} rows "
              f"(select_names: {wanted})")

    if not records:
        print("  nothing to stage", file=sys.stderr)
        return 1

    if args.dry_run:
        print("  dry run: no staging file written")
        print(json.dumps(records[0], indent=2, ensure_ascii=False))
        return 0

    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    staged = STAGING_DIR / f"{source['id']}.staged.json"
    staged.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  staged -> {staged.relative_to(ROOT)}")

    validator = TOOLS / "validate_catalogue.py"
    result = subprocess.run([sys.executable, str(validator), "--quiet", str(staged)])
    if result.returncode != 0:
        print(f"  error: staged file failed validation; it was NOT promoted.",
              file=sys.stderr)
        return 1

    print("  staged file is valid")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", help="source id from tools/sources.json")
    parser.add_argument("--all", action="store_true", help="import every configured source")
    parser.add_argument("--list", action="store_true", help="list configured sources and exit")
    parser.add_argument("--limit", type=int, default=None, help="maximum records per source")
    parser.add_argument("--probe", action="store_true",
                        help="fetch and report the response shape without importing")
    parser.add_argument("--dry-run", action="store_true", help="normalize but write no staging file")
    parser.add_argument("--refresh", action="store_true", help="refetch even if cached")
    parser.add_argument("--timeout", type=int, default=120, help="HTTP timeout in seconds")
    parser.add_argument("--ca-bundle", default=None,
                        help="PEM CA bundle to verify TLS with (fixes local "
                             "CERTIFICATE_VERIFY_FAILED without disabling verification)")
    parser.add_argument("--verbose", action="store_true", help="report every skipped row")
    args = parser.parse_args()

    sources = load_sources()

    if args.list:
        for source in sources:
            produces = ", ".join(source.get("produces") or [])
            if source.get("unprobed"):
                status = "PROBE FIRST"
            else:
                status = f"confirmed {source.get('probe_confirmed', '?')}"
            print(f"{source['id']:<28} {status:<22} -> {produces}")
        return 0

    if args.all:
        selected = sources
    elif args.source:
        selected = [s for s in sources if s["id"] == args.source]
        if not selected:
            raise SystemExit(f"error: no source with id {args.source!r}. "
                             f"Run --list to see the options.")
    else:
        parser.error("choose --source <id>, --all, or --list")

    existing_ids = set()
    if CATALOGUE.is_file():
        catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
        existing_ids = {r["id"] for r in catalogue if isinstance(r, dict) and "id" in r}
        print(f"production catalogue: {len(catalogue)} record(s)")

    failures = sum(import_source(s, args, existing_ids) != 0 for s in selected)

    if args.probe or args.dry_run:
        return 1 if failures else 0

    print(f"\n{len(selected) - failures}/{len(selected)} source(s) staged successfully")
    if not failures:
        print("Review the staged files, then run:  python3 tools/promote_staging.py")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
