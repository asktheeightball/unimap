/**
 * Browser checks for the P5 enriched detail view.
 *
 * Optional maintainer tooling. UniMap itself has no dependencies; these checks
 * drive the real `index.html` over HTTP with Playwright, exactly as
 * `tools/search_checks.mjs` and `tools/quiz_checks.mjs` do. They are not a test
 * framework the application needs (DECISIONS.md D1 and D6).
 *
 * Usage:
 *     node tools/detail_checks.mjs
 *
 * Numbered against the P5 validation list:
 *
 *   1  new fields render under human-readable labels
 *   2  no raw field names, nulls or empty strings reach the page
 *   3  empty sections are never rendered
 *   4  discoverer rendering
 *   5  discovery year and date do not both appear
 *   6  common name and formal designation display
 *   7  hand-written summary takes precedence over the generated one
 *   8  generated summary is used as the fallback
 *   9  notability is shown apart from the description
 *  10  editorial records show their attribution and claim no source URL
 *  11  related objects render as working links
 *  12  related navigation reaches the target record
 *  13  no self-relations and no duplicate relations reach the page
 *  14  the generic measurement slot is not duplicated by its named field
 *  15  an unnamed measurement label still renders (backward compatibility)
 *  16  constellation is shown, and never on a moving solar-system body
 *  17  keyboard navigation reaches and operates related links
 *  18  visible focus is preserved
 *  19  detail rendering stays cheap as the catalogue grows
 *  20  320x568, 375x667 and 390x844 with no horizontal overflow
 *  21  no console errors
 */

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadPlaywright() {
  const unwrap = (module) => (module.chromium ? module : module.default ?? module);
  try {
    return unwrap(await import("playwright"));
  } catch {
    // ESM ignores NODE_PATH, so a global install has to be located explicitly.
  }
  let globalRoot;
  try {
    globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  } catch {
    globalRoot = "";
  }
  if (globalRoot) {
    try {
      return unwrap(await import(pathToFileURL(join(globalRoot, "playwright", "index.js")).href));
    } catch {
      // fall through to the explanation below
    }
  }
  throw new Error(
    "Playwright is not available. These are optional maintainer checks; the " +
      "application itself has no dependencies. Install it globally with " +
      "`npm install -g playwright` (or locally outside this repository) and rerun.",
  );
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startServer() {
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = normalize(path === "/" ? "index.html" : path.replace(/^\/+/, ""));
    if (relative.startsWith("..")) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const body = await readFile(join(ROOT, relative));
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extname(relative)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* --- Tiny assertion harness ---------------------------------------------- */

const results = [];
let group = "";

function section(name) {
  group = name;
}

function check(name, condition, detail = "") {
  results.push({ group, name, ok: Boolean(condition), detail });
  const mark = condition ? "  ok  " : "FAIL  ";
  console.log(`${mark}${group} — ${name}${condition || !detail ? "" : `  [${detail}]`}`);
}

function equal(name, actual, expected) {
  check(name, Object.is(actual, expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* --- Page helpers --------------------------------------------------------- */

async function newPage(context, base, errors) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "networkidle" });
  // `state` is a top-level `const` in a classic script, so it lives in the
  // global lexical scope rather than on `window` — reference it bare.
  await page.waitForFunction(() => typeof state !== "undefined" && state.byId.size > 0);
  return page;
}

/* Open a record's detail view through the application's own renderer rather
   than by driving search, so a check targets exactly the record it names. */
async function open(page, id) {
  await page.evaluate((wanted) => renderDetails(state.byId.get(wanted)), id);
  await page.waitForSelector("#detail-view:not([hidden])");
}

/* The detail view as a reader sees it: section titles, and the label/value
   pairs under each. */
const sections = (page) =>
  page.$$eval(".detail-section", (nodes) => nodes.map((node) => ({
    title: node.querySelector("h3").textContent,
    rows: [...node.querySelectorAll(".detail-row")].map((row) => [
      row.querySelector("dt").textContent,
      row.querySelector("dd").textContent,
    ]),
    links: [...node.querySelectorAll(".detail-related .link-button")]
      .map((button) => button.textContent),
  })));

const rowsOf = (found, title) => (found.find((s) => s.title === title)?.rows) ?? [];
const valueOf = (found, title, label) =>
  rowsOf(found, title).find(([term]) => term === label)?.[1];

async function run() {
  const { chromium } = await loadPlaywright();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const errors = [];

  try {
    const context = await browser.newContext();
    const page = await newPage(context, base, errors);

    /* 1, 2, 3 — structure ---------------------------------------------------- */
    section("structure");

    await open(page, "bet-ori");
    let found = await sections(page);
    const titles = found.map((s) => s.title);

    check("1. sections are titled for a reader, not for the schema",
      titles.every((title) => /^[A-Z][a-z]/.test(title) && !title.includes("_")),
      titles.join(" | "));
    check("1. Location groups the sky position", titles.includes("Location"));
    check("1. Physical details groups the measurements",
      titles.includes("Physical details"));

    const everyRow = found.flatMap((s) => s.rows);
    check("2. no row is empty",
      everyRow.every(([label, value]) => label.trim() !== "" && value.trim() !== ""),
      JSON.stringify(everyRow.filter(([l, v]) => !l.trim() || !v.trim())));
    check("2. no row prints a raw field name",
      !everyRow.some(([label]) => /^[a-z]+[A-Z]/.test(label.trim())),
      everyRow.map(([l]) => l).join(" | "));
    check("2. no row prints a null, undefined or empty literal",
      !everyRow.some(([, value]) => /^(null|undefined|NaN|\[object)/.test(value.trim())),
      everyRow.map(([, v]) => v).join(" | "));

    check("3. no section is rendered without rows",
      found.every((s) => s.rows.length > 0 || s.links.length > 0),
      titles.join(" | "));

    // A record with almost nothing on it must not sprout empty headings.
    await open(page, "m-16");
    const sparse = await sections(page);
    check("3. a sparse record renders no Discovery section",
      !sparse.some((s) => s.title === "Discovery"),
      sparse.map((s) => s.title).join(" | "));
    check("3. a sparse record still renders its Overview",
      sparse.some((s) => s.title === "Overview"));

    /* 4, 5 — discovery -------------------------------------------------------- */
    section("discovery");

    await open(page, "psr-b1919-21");
    found = await sections(page);
    equal("4. the discoverer is shown under a readable label",
      valueOf(found, "Discovery", "Discovered by"), "Jocelyn Bell Burnell");
    equal("4. the discovery year is shown", valueOf(found, "Discovery", "Discovered"), "1967");

    await open(page, "koi-1599-02");
    found = await sections(page);
    equal("4. an exoplanet shows its method", valueOf(found, "Discovery", "Method"), "Transit");
    equal("4. an exoplanet with no discoverer shows no discoverer row",
      valueOf(found, "Discovery", "Discovered by"), undefined);

    // A record carrying both must show the precise one only, never a year that
    // silently disagrees with the date beside it.
    const bothShown = await page.evaluate(() => {
      const body = { ...state.byId.get("psr-b1919-21"), discoveryDate: "1967-11-28" };
      renderDetails(body);
      return [...document.querySelectorAll(".detail-section")]
        .filter((node) => node.querySelector("h3").textContent === "Discovery")
        .flatMap((node) => [...node.querySelectorAll(".detail-row dt")]
          .map((term) => term.textContent));
    });
    check("5. a precise date replaces the bare year rather than joining it",
      bothShown.includes("Discovery date") && !bothShown.includes("Discovered"),
      bothShown.join(" | "));

    /* 6 — names --------------------------------------------------------------- */
    section("names");

    await open(page, "bet-ori");
    equal("6. a record with no common name is headed by its designation",
      await page.textContent("#detail-name"), "bet Ori");
    equal("6. and shows no redundant designation line",
      await page.isHidden("#detail-designation"), true);
    equal("6. its catalogue identifier is listed",
      valueOf(await sections(page), "Names and identifiers", "Also known as"), "* bet Ori");

    // commonName is not yet populated anywhere in the catalogue (no source for
    // it survives offline), so the display rule is exercised directly.
    const named = await page.evaluate(() => {
      renderDetails({ ...state.byId.get("bet-ori"), commonName: "Betelgeuse (test)" });
      return {
        heading: document.querySelector("#detail-name").textContent,
        designation: document.querySelector("#detail-designation").textContent,
        hidden: document.querySelector("#detail-designation").hidden,
      };
    });
    equal("6. a common name becomes the heading", named.heading, "Betelgeuse (test)");
    equal("6. the formal designation stays visible", named.designation, "bet Ori");
    equal("6. the designation line is shown", named.hidden, false);

    /* 7, 8, 9, 10 — prose ------------------------------------------------------ */
    section("prose");

    await open(page, "earth");
    const editorial = await page.textContent("#detail-summary");
    check("7. a hand-written summary is shown",
      editorial.startsWith("Earth is the third planet from the Sun"), editorial);
    check("7. the generated summary is not appended to it",
      !editorial.includes("classified by SIMBAD"), editorial);

    await open(page, "koi-1599-02");
    const generated = await page.textContent("#detail-summary");
    check("8. a record with no hand-written text falls back to the generated one",
      generated.startsWith("KOI-1599.02 is a confirmed exoplanet"), generated);

    await open(page, "earth");
    equal("9. notability is shown", await page.isHidden("#detail-notability"), false);
    check("9. notability is separate from the description",
      (await page.textContent("#detail-notability")) !== editorial);

    await open(page, "koi-1599-02");
    equal("9. a record with no notability shows no notability block",
      await page.isHidden("#detail-notability"), true);

    await open(page, "earth");
    found = await sections(page);
    equal("10. editorial prose names its author",
      valueOf(found, "Source", "Description"), "UniMap editorial");
    equal("10. and records when it was reviewed",
      valueOf(found, "Source", "Description reviewed"), "2026-07-28");
    check("10. an editorial record claims no source link",
      (await page.$$(".detail-section a[href]")).length === 0);

    await open(page, "koi-1599-02");
    found = await sections(page);
    equal("10. an imported record attributes its source",
      valueOf(found, "Source", "Data from"), "NASA Exoplanet Archive");
    check("10. and links to it",
      (await page.getAttribute(".detail-section a[href]", "href"))
        .startsWith("https://exoplanetarchive.ipac.caltech.edu"));

    /* 11, 12, 13 — relations --------------------------------------------------- */
    section("relations");

    await open(page, "earth");
    found = await sections(page);
    const related = found.find((s) => s.title === "Related objects");
    check("11. a related section is rendered", Boolean(related));
    equal("11. it lists the parent body", JSON.stringify(related?.links), JSON.stringify(["Sol"]));
    equal("11. and the relationship is also stated as a field",
      valueOf(found, "Overview", "Orbits"), "Sol");

    await page.click(".detail-related .link-button");
    await page.waitForTimeout(80);
    equal("12. following a relation opens that record",
      await page.textContent("#detail-name"), "Sol");
    equal("12. the target lists its own relations back",
      JSON.stringify((await sections(page)).find((s) => s.title === "Related objects")?.links),
      JSON.stringify(["Earth", "Mars", "Jupiter"]));

    await open(page, "koi-1599-02");
    check("11. a record with no relations renders no related section",
      !(await sections(page)).some((s) => s.title === "Related objects"));

    // The validator rejects these, so this proves the renderer is also safe
    // against a hand-edited catalogue rather than relying on validation alone.
    const hostile = await page.evaluate(() => {
      renderDetails({
        ...state.byId.get("earth"),
        relatedObjectIds: ["earth", "sol", "sol", "not-a-record"],
      });
      return [...document.querySelectorAll(".detail-related .link-button")]
        .map((button) => button.dataset.id);
    });
    check("13. a self-relation is not rendered", !hostile.includes("earth"), hostile.join());
    check("13. a missing target is not rendered",
      !hostile.includes("not-a-record"), hostile.join());
    equal("13. a duplicate relation renders once per listing, not as a dead link",
      hostile.every((id) => id === "sol"), true);

    /* 14, 15, 16 — measurements and location ----------------------------------- */
    section("measurements");

    await open(page, "koi-1599-02");
    found = await sections(page);
    const physical = rowsOf(found, "Physical details").map(([label]) => label);
    equal("14. the named radius is shown",
      valueOf(found, "Physical details", "Radius"), "1.90 × Earth");
    check("14. the generic slot is not shown beside it",
      !physical.includes("Radius (Earth radii)"), physical.join(" | "));
    equal("14. the recovered mass is shown",
      valueOf(found, "Physical details", "Mass"), "9.00 × Earth");

    await open(page, "alf-cen-a");
    equal("14. a star shows its parallax with its unit",
      valueOf(await sections(page), "Physical details", "Parallax"), "742.1200 mas");

    const legacy = await page.evaluate(() => {
      renderDetails({
        ...state.byId.get("alf-cen-a"),
        measurementLabel: "Rotation period (days)",
        measurementValue: "28",
      });
      return [...document.querySelectorAll(".detail-row")].map((row) => [
        row.querySelector("dt").textContent, row.querySelector("dd").textContent]);
    });
    check("15. a measurement with no named field of its own still renders",
      legacy.some(([label, value]) => label === "Rotation period (days)" && value === "28"),
      JSON.stringify(legacy));

    await open(page, "bet-ori");
    equal("16. a star shows its constellation",
      valueOf(await sections(page), "Location", "Constellation"), "Orion");

    const moving = await page.evaluate(() => {
      const ids = ["earth", "mars", "jupiter", "pluto", "eris", "haumea", "makemake"];
      return ids.filter((id) => state.byId.get(id))
        .filter((id) => Boolean(state.byId.get(id).constellation));
    });
    equal("16. no moving solar-system body carries a constellation",
      JSON.stringify(moving), "[]");

    /* 17, 18 — keyboard and focus ---------------------------------------------- */
    section("keyboard");

    await open(page, "earth");
    // Back is focused on open; one Tab must reach the related-object link.
    equal("17. Back takes focus when the detail view opens",
      await page.evaluate(() => document.activeElement.id), "back-button");

    let hops = 0;
    while (hops < 12) {
      await page.keyboard.press("Tab");
      hops += 1;
      const cls = await page.evaluate(() => document.activeElement.className);
      if (cls.includes("link-button")) break;
    }
    check("17. a related link is reachable by Tab", hops < 12, `${hops} hops`);

    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    check("18. the focused link has a visible outline",
      outline.style !== "none" && parseFloat(outline.width) > 0, JSON.stringify(outline));

    await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
    equal("17. Enter follows the relation", await page.textContent("#detail-name"), "Sol");

    await page.keyboard.press("Shift+Tab");
    await page.evaluate(() => document.getElementById("back-button").click());
    await page.waitForTimeout(60);
    equal("17. Back returns to the browse view",
      await page.isHidden("#detail-view"), true);

    /* 19 — performance --------------------------------------------------------- */
    section("performance");

    await open(page, "earth");
    const timing = await page.evaluate(() => {
      const sample = ["earth", "koi-1599-02", "bet-ori", "m-16", "sol"]
        .map((id) => state.byId.get(id));

      const time = (label) => {
        const started = performance.now();
        for (let run = 0; run < 100; run += 1) {
          for (const body of sample) renderDetails(body);
        }
        return { label, ms: (performance.now() - started) / (100 * sample.length) };
      };

      const real = time(`${state.bodies.length} records`);

      // Grow the lookup map tenfold: a render that scans the catalogue to
      // resolve a relation would slow down here, one that uses the map will not.
      const original = state.byId;
      const grown = new Map(original);
      for (let copy = 0; copy < 10; copy += 1) {
        for (const body of state.bodies) {
          grown.set(`${body.id}-copy${copy}`, { ...body, id: `${body.id}-copy${copy}` });
        }
      }
      state.byId = grown;
      const large = time(`${grown.size} records`);
      state.byId = original;
      return { real, large, size: grown.size };
    });

    check(`19. the growth fixture reached ${timing.size} records`, timing.size > 2000);
    for (const entry of [timing.real, timing.large]) {
      check(`19. detail render, ${entry.label}: ${entry.ms.toFixed(3)}ms (budget 5ms)`,
        entry.ms < 5, `${entry.ms.toFixed(3)}ms`);
    }
    check("19. a tenfold catalogue does not slow rendering materially",
      timing.large.ms < timing.real.ms * 3 + 0.5,
      `${timing.real.ms.toFixed(3)}ms -> ${timing.large.ms.toFixed(3)}ms`);

    await context.close();

    /* 20 — mobile -------------------------------------------------------------- */
    section("mobile");

    for (const [width, height] of [[320, 568], [375, 667], [390, 844]]) {
      const mobileContext = await browser.newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
      });
      const mobile = await newPage(mobileContext, base, errors);
      await open(mobile, "earth");

      const overflow = await mobile.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      check(`20. ${width}x${height}: no horizontal overflow`,
        overflow.scroll <= overflow.client, JSON.stringify(overflow));

      const inside = await mobile.evaluate((w) =>
        [...document.querySelectorAll(".detail-section")]
          .every((node) => node.getBoundingClientRect().right <= w + 1), width);
      check(`20. ${width}x${height}: every section fits the viewport`, inside);

      const tappable = await mobile.evaluate(() =>
        [...document.querySelectorAll(".detail-related .link-button")]
          .every((node) => node.getBoundingClientRect().height >= 20));
      check(`20. ${width}x${height}: related links are tappable`, tappable);

      await mobile.tap(".detail-related .link-button");
      await mobile.waitForTimeout(80);
      equal(`20. ${width}x${height}: a related link works by touch`,
        await mobile.textContent("#detail-name"), "Sol");

      await mobileContext.close();
    }

    /* 21 — console ------------------------------------------------------------- */
    section("console");
    check("21. no console errors during any check", errors.length === 0, errors.join(" | "));
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const failure of failed) {
      console.log(`  ${failure.group} — ${failure.name}  ${failure.detail}`);
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
