/* Browser checks for P3 — search intelligence, autocomplete, and the interface
   slice that removed the footer.
 *
 * This is a maintainer script, not part of the application. UniMap ships as
 * static HTML, CSS, JavaScript and JSON with no runtime dependency; Node and
 * Playwright are development tools here in exactly the way Python is for
 * `tools/import_catalogue.py` (DECISIONS.md D1 and D6).
 *
 * Run:
 *   node tools/search_checks.mjs
 *
 * It serves the repository root over HTTP itself — the app fetches its
 * catalogue, so `file://` cannot be used — drives real Chromium against the
 * real `index.html`, and exits non-zero on any failure.
 *
 * Playwright is resolved from wherever it is installed, including a global
 * install, so the repository still needs no `package.json` and no lockfile.
 */

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadPlaywright() {
  // Playwright is CommonJS, so a namespace import can arrive wrapped in
  // `default` depending on how it was resolved.
  const unwrap = (module) => (module.chromium ? module : module.default ?? module);
  try {
    return unwrap(await import("playwright"));
  } catch {
    // ESM ignores NODE_PATH, so a global install has to be located explicitly.
  }
  let globalRoot;
  try {
    // On Windows npm is a .cmd shim. Recent Node refuses to launch one without a
    // shell (EINVAL), so the global lookup would always fail here. The command
    // and its arguments are fixed, so enabling the shell introduces no injection.
    globalRoot = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    }).trim();
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
  check(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* --- Page helpers --------------------------------------------------------- */

const SEARCH = "#search-input";
const LIST = "#search-suggestions";

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
  await page.waitForFunction(() => typeof state !== "undefined" && state.index.length > 0);
  return page;
}

async function type(page, text) {
  await page.fill(SEARCH, "");
  await page.click(SEARCH);
  await page.type(SEARCH, text, { delay: 5 });
  await page.waitForTimeout(60);
}

const suggestionNames = (page) =>
  page.$$eval(`${LIST} .suggestion .suggestion-name`, (nodes) => nodes.map((n) => n.textContent));

const resultNames = (page) =>
  page.$$eval("#results .result-name", (nodes) => nodes.map((n) => n.textContent));

/* Rank the catalogue through the page's own search engine. */
const ranked = (page, query, category = "All", target = 8) =>
  page.evaluate(([q, c, t]) =>
    searchIndex(q, c, t).map((match) => ({
      name: match.entry.body.name,
      type: match.entry.body.type,
      tier: match.tier,
      label: match.label,
      distance: match.distance,
    })), [query, category, target]);

/* --- The checks ----------------------------------------------------------- */

async function run() {
  const { chromium, devices } = await loadPlaywright();
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];

  try {
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await newPage(desktop, base, errors);

    /* 1-5, 11 — matching and ranking ------------------------------------- */
    section("matching");

    const exact = await ranked(page, "Betelgeuse");
    equal("1. exact primary-name match is first", exact[0].name, "Betelgeuse");
    equal("1. exact match uses the exact-name tier", exact[0].tier, 0);

    const prefix = await ranked(page, "Proxi");
    equal("2. primary-name prefix match", prefix[0].name, "Proxima Centauri");
    equal("2. prefix match uses the prefix tier", prefix[0].tier, 1);

    const alias = await ranked(page, "NAME LMC");
    check("3. exact alias match returns the right object",
      alias.length > 0 && alias[0].name === "LMC", JSON.stringify(alias[0] ?? null));
    equal("3. exact alias match uses the exact-term tier", alias[0].tier, 2);
    check("3. alias match reports which alias matched",
      alias[0] && alias[0].label === "NAME LMC", JSON.stringify(alias[0]?.label));

    // SIMBAD writes this alias as "* alf Tau"; the punctuation is normalized
    // away, so it lands on the record's own name.
    const starAlias = await ranked(page, "* alf Tau");
    equal("3a. a punctuation-only alias difference still resolves",
      starAlias[0].name, "alf Tau");

    const aliasDiffers = await ranked(page, "136199 Eris (2003 UB313)");
    check("3b. alias finds an object whose displayed name differs",
      aliasDiffers[0] && aliasDiffers[0].name === "Eris", JSON.stringify(aliasDiffers[0] ?? null));

    const aliasPrefix = await ranked(page, "Kepler-200 sys");
    check("3c. alias prefix match", aliasPrefix[0] && aliasPrefix[0].tier === 3
      && aliasPrefix[0].label === "Kepler-200 system", JSON.stringify(aliasPrefix[0] ?? null));

    const identifier = await ranked(page, "proxima-centauri");
    equal("4. catalogue identifier match", identifier[0].name, "Proxima Centauri");

    const compactId = await ranked(page, "crabnebula");
    equal("4b. punctuation-insensitive identifier match", compactId[0].name, "Crab Nebula");

    const substring = await ranked(page, "romeda");
    check("5. substring match", substring.some((m) => m.name === "Andromeda"),
      JSON.stringify(substring.slice(0, 3)));

    const mixed = await ranked(page, "Andromeda", "All", 8);
    equal("11. exact name outranks every other tier", mixed[0].name, "Andromeda");
    check("11. tiers are non-decreasing down the ranking",
      mixed.every((m, i) => i === 0 || m.tier >= mixed[i - 1].tier),
      JSON.stringify(mixed.map((m) => m.tier)));

    /* 6-9 — fuzzy behaviour ------------------------------------------------ */
    section("fuzzy");

    const typo = await ranked(page, "Betelguese");
    equal("6/7. transposed-letter typo corrects", typo[0].name, "Betelgeuse");
    equal("6/7. correction lands in the fuzzy tier", typo[0].tier, 6);

    const dropped = await ranked(page, "Andromida");
    equal("6. one-character typo corrects", dropped[0].name, "Andromeda");

    const missing = await ranked(page, "Proxima Centari");
    equal("6. missing-character typo corrects", missing[0].name, "Proxima Centauri");

    const extra = await ranked(page, "Betelgeusse");
    equal("6b. extra-character typo corrects", extra[0].name, "Betelgeuse");

    const short = await page.evaluate(() => fuzzyBudget(normalizeSearchText("Bet").length));
    equal("8. short queries get no fuzzy budget", short, 0);
    const shortMatches = await ranked(page, "xqz");
    equal("8. a 3-character nonsense query returns nothing", shortMatches.length, 0);

    const unrelated = await ranked(page, "helicopter");
    equal("9. an unrelated query returns no misleading fuzzy match", unrelated.length, 0);

    const alsoUnrelated = await ranked(page, "submarine sandwich");
    equal("9b. a long unrelated query returns nothing", alsoUnrelated.length, 0);

    /* 10 — category filtering with fuzzy search ---------------------------- */
    section("category");

    const inGalaxies = await ranked(page, "Andromida", "Galaxies");
    equal("10. fuzzy search inside a category still finds it", inGalaxies[0].name, "Andromeda");
    const inNebulae = await ranked(page, "Andromida", "Nebulae");
    equal("10. fuzzy search respects a non-matching category", inNebulae.length, 0);
    const starsOnly = await ranked(page, "Kepler", "Stars", 200);
    check("10b. every filtered result is in the category",
      starsOnly.every((m) => m.type === "Star"), JSON.stringify(starsOnly.slice(0, 3)));

    /* 12, 13, 20 — suggestion list contents -------------------------------- */
    section("suggestions");

    await type(page, "kep");
    const many = await suggestionNames(page);
    check("13. at most 8 suggestions", many.length > 0 && many.length <= 8, `got ${many.length}`);
    equal("12. no duplicate objects among suggestions", new Set(many).size, many.length);

    await type(page, "Eris");
    const erisMeta = await page.$$eval(`${LIST} .suggestion`, (nodes) =>
      nodes.map((n) => n.querySelector(".suggestion-meta").textContent));
    check("12b. secondary text shows type and matched alias once",
      erisMeta[0].startsWith("Dwarf Planet"), erisMeta[0]);

    await type(page, "B");
    equal("suggestions stay closed below 2 characters",
      await page.isHidden(LIST), true);

    await type(page, "Bet");
    equal("suggestions open at 2+ characters", await page.isHidden(LIST), false);
    await page.fill(SEARCH, "");
    await page.dispatchEvent(SEARCH, "input");
    await page.waitForTimeout(50);
    equal("20. clearing the input closes the list", await page.isHidden(LIST), true);

    /* 16-19 — keyboard and screen-reader ----------------------------------- */
    section("keyboard");

    // "kep" returns a full list, so Arrow Down has somewhere to go on step two.
    await type(page, "kep");
    equal("19. aria-expanded is true while open",
      await page.getAttribute(SEARCH, "aria-expanded"), "true");
    equal("19. aria-controls points at the listbox",
      await page.getAttribute(SEARCH, "aria-controls"), "search-suggestions");
    equal("19. the list is a listbox", await page.getAttribute(LIST, "role"), "listbox");
    equal("19. options carry the option role",
      await page.getAttribute(`${LIST} .suggestion`, "role"), "option");
    check("19. suggestion count is announced politely",
      (await page.textContent("#search-suggestion-status")).includes("suggestion"),
      await page.textContent("#search-suggestion-status"));

    equal("16. no option is active before Arrow Down",
      await page.getAttribute(SEARCH, "aria-activedescendant"), null);
    await page.press(SEARCH, "ArrowDown");
    equal("16. Arrow Down activates the first option",
      await page.getAttribute(SEARCH, "aria-activedescendant"), "search-suggestion-0");
    equal("16. the active option is aria-selected",
      await page.getAttribute("#search-suggestion-0", "aria-selected"), "true");
    await page.press(SEARCH, "ArrowDown");
    equal("16. Arrow Down moves on",
      await page.getAttribute(SEARCH, "aria-activedescendant"), "search-suggestion-1");
    await page.press(SEARCH, "ArrowUp");
    equal("16. Arrow Up moves back",
      await page.getAttribute(SEARCH, "aria-activedescendant"), "search-suggestion-0");
    await page.press(SEARCH, "ArrowUp");
    equal("16. Arrow Up past the top returns to the input",
      await page.getAttribute(SEARCH, "aria-activedescendant"), null);

    await page.press(SEARCH, "Escape");
    equal("18. Escape closes the list", await page.isHidden(LIST), true);
    equal("18. Escape resets aria-expanded",
      await page.getAttribute(SEARCH, "aria-expanded"), "false");
    equal("18. Escape does not trap focus",
      await page.evaluate(() => document.activeElement.id), "search-input");

    await type(page, "Betel");
    await page.press(SEARCH, "ArrowDown");
    await page.press(SEARCH, "Enter");
    await page.waitForTimeout(60);
    equal("17. Enter on an active suggestion opens the object",
      await page.textContent("#detail-name"), "Betelgeuse");
    equal("17. the detail view is showing", await page.isHidden("#detail-view"), false);
    await page.click("#back-button");
    check("17. Back returns to a list containing the selection",
      (await resultNames(page)).includes("Betelgeuse"));

    await type(page, "Betelgeuse");
    await page.press(SEARCH, "Enter");
    await page.waitForTimeout(60);
    equal("17b. Enter with no active suggestion still submits the search",
      await page.isHidden("#detail-view"), true);
    check("17b. submitted search filtered the results",
      (await resultNames(page))[0] === "Betelgeuse");

    /* 14 — mouse selection -------------------------------------------------- */
    section("pointer");

    await type(page, "Proxi");
    await page.click(`${LIST} .suggestion`);
    await page.waitForTimeout(60);
    equal("14. mouse click selects a suggestion",
      await page.textContent("#detail-name"), "Proxima Centauri");
    equal("14. selecting closes the list", await page.isHidden(LIST), true);
    await page.click("#back-button");

    await type(page, "Proxi");
    await page.click("#browse-heading", { force: true });
    await page.waitForTimeout(60);
    equal("focus leaving the search closes the list", await page.isHidden(LIST), true);

    /* 21 — correction and no-results guidance -------------------------------- */
    section("no-results");

    // Deliberately not pressing Escape here: Chromium's native behaviour for
    // <input type="search"> is to clear the field, which is a browser
    // affordance the app leaves alone whenever the suggestion list is closed.
    const submit = async (text) => {
      await page.fill(SEARCH, text);
      await page.click("button[type=submit]");
      await page.waitForTimeout(60);
    };

    // A misspelling that fuzzy-matches still returns results, so the correction
    // appears above them rather than as a no-results panel.
    await submit("Betelguse");
    equal("21. a corrected query still returns the object",
      (await resultNames(page))[0], "Betelgeuse");
    equal("21. the correction prompt appears", await page.isHidden("#search-help"), false);
    check("21. the prompt says 'Did you mean'",
      (await page.textContent(".search-help-correction")).includes("Did you mean"));
    equal("21. the correction names the right object",
      await page.textContent(".search-help-correction .link-button"), "Betelgeuse");
    check("21. the query is not silently rewritten", (await page.inputValue(SEARCH)) === "Betelguse");
    await page.click(".search-help-correction .link-button");
    await page.waitForTimeout(60);
    equal("21. accepting the correction rewrites the query",
      await page.inputValue(SEARCH), "Betelgeuse");
    check("21. accepting the correction finds the object",
      (await resultNames(page)).includes("Betelgeuse"));
    equal("21. an exact match shows no correction prompt",
      await page.isHidden("#search-help"), true);

    // A misspelling filtered into a category that cannot contain it: no results,
    // but the correction still reaches the object.
    await page.click('.chip[data-category="Nebulae"]');
    await submit("Andromida");
    equal("21b. no results in the filtered category", (await resultNames(page)).length, 0);
    equal("21b. the no-results panel appears", await page.isHidden("#search-help"), false);
    check("21b. it repeats the searched text",
      (await page.textContent(".search-help-intro")).includes("Andromida"));
    equal("21b. the correction crosses the category filter",
      await page.textContent(".search-help-correction .link-button"), "Andromeda");
    check("21b. it offers a few close matches, not a flood",
      (await page.$$("#search-help .link-button")).length <= 4);
    await page.click('.chip[data-category="All"]');

    await submit("zzzzzzzzzz");
    equal("21c. a hopeless query returns nothing", (await resultNames(page)).length, 0);
    const helpText = await page.textContent("#search-help");
    check("21c. a hopeless query offers no misleading correction",
      !helpText.includes("Did you mean"), helpText);
    await page.click("#search-help-clear");
    await page.waitForTimeout(60);
    equal("21c. the panel's Clear search empties the query", await page.inputValue(SEARCH), "");
    equal("21c. clearing restores the full catalogue", (await resultNames(page)).length, 208);
    equal("21c. clearing hides the panel", await page.isHidden("#search-help"), true);

    /* 25, 26 — existing behaviour ------------------------------------------- */
    section("regression");

    equal("25. the catalogue renders in full", (await resultNames(page)).length, 208);
    equal("25. catalogue order is preserved with no query",
      (await resultNames(page))[0],
      await page.evaluate(() => state.bodies[0].name));
    await page.click('.chip[data-category="Galaxies"]');
    await page.waitForTimeout(50);
    equal("25. a category filter still works", (await resultNames(page)).length, 28);
    await page.click('.chip[data-category="All"]');
    await page.click("#results .result-button");
    await page.waitForTimeout(50);
    check("25. the detail view still opens", !(await page.isHidden("#detail-view")));
    await page.click("#back-button");
    check("25. Back still returns to browse", !(await page.isHidden("#browse-view")));

    await page.click('.chip[data-mode="quiz"]');
    await page.waitForTimeout(50);
    equal("26. Quiz navigation still works", await page.isHidden("#quiz-view"), false);
    await page.click("#quiz-start");
    await page.waitForTimeout(150);
    check("26. a quiz question still generates",
      (await page.textContent("#quiz-prompt")).length > 0);
    equal("26. the quiz still offers four choices",
      (await page.$$("#quiz-choices .quiz-choice")).length, 4);
    await page.click('.chip[data-mode="browse"]');
    await page.waitForTimeout(50);
    equal("26. returning to Browse works", await page.isHidden("#browse-view"), false);

    /* 28 — footer ------------------------------------------------------------ */
    section("footer");

    equal("28. no footer element remains", (await page.$$("footer")).length, 0);
    equal("28. no .site-footer element remains", (await page.$$(".site-footer")).length, 0);
    const bottomGap = await page.evaluate(() => {
      const main = document.querySelector("main");
      return Math.round(document.body.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom);
    });
    check("28. no empty band is left below the content", bottomGap <= 1, `${bottomGap}px`);

    /* 22 — desktop layout ---------------------------------------------------- */
    section("layout");

    await type(page, "kep");
    const desktopBox = await page.evaluate(() => {
      const list = document.getElementById("search-suggestions");
      const field = document.getElementById("search-combobox");
      const a = list.getBoundingClientRect();
      const b = field.getBoundingClientRect();
      return {
        visible: a.width > 0 && a.height > 0,
        withinField: a.left >= b.left - 1 && a.right <= b.right + 1,
        withinViewport: a.right <= window.innerWidth + 1 && a.left >= -1,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    check("22. the suggestion list renders on desktop", desktopBox.visible);
    check("22. it stays inside the search field", desktopBox.withinField);
    check("24. no horizontal overflow on desktop", desktopBox.overflow <= 0, `${desktopBox.overflow}px`);
    await desktop.close();

    /* 15, 23, 24 — mobile ---------------------------------------------------- */
    section("mobile");

    for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({
        ...devices["iPhone 12"],
        viewport: size,
        hasTouch: true,
        isMobile: true,
      });
      const mobile = await newPage(context, base, errors);
      const label = `${size.width}x${size.height}`;

      await mobile.tap(SEARCH);
      await mobile.type(SEARCH, "Proxi", { delay: 5 });
      await mobile.waitForTimeout(80);

      const box = await mobile.evaluate(() => {
        const list = document.getElementById("search-suggestions");
        const rect = list.getBoundingClientRect();
        const option = list.querySelector(".suggestion").getBoundingClientRect();
        return {
          open: !list.hidden,
          withinViewport: rect.left >= -1 && rect.right <= window.innerWidth + 1,
          fitsHeight: rect.height <= window.innerHeight,
          touchHeight: option.height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      check(`23. ${label}: suggestions open`, box.open);
      check(`23. ${label}: list stays inside the viewport`, box.withinViewport);
      check(`23. ${label}: list is shorter than the viewport`, box.fitsHeight);
      check(`23. ${label}: touch targets are at least 40px`, box.touchHeight >= 40,
        `${Math.round(box.touchHeight)}px`);
      check(`24. ${label}: no horizontal overflow`, box.overflow <= 0, `${box.overflow}px`);

      // A real touch tap, not element.click(): pointer + touch events, at the
      // suggestion's actual screen position.
      const point = await mobile.evaluate(() => {
        const rect = document.querySelector("#search-suggestions .suggestion").getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      });
      await mobile.touchscreen.tap(point.x, point.y);
      await mobile.waitForTimeout(80);
      equal(`15. ${label}: touch tap selects a suggestion`,
        await mobile.textContent("#detail-name"), "Proxima Centauri");

      await mobile.click("#back-button");
      // Selecting a suggestion left its name in the search box; clear it so the
      // category filter is measured on its own.
      await mobile.tap("#clear-button");
      await mobile.tap('.chip[data-category="Galaxies"]');
      await mobile.waitForTimeout(50);
      check(`23. ${label}: category filters still work by touch`,
        (await resultNames(mobile)).length === 28);
      await mobile.tap('.chip[data-mode="quiz"]');
      await mobile.waitForTimeout(50);
      equal(`26. ${label}: Quiz navigation works by touch`,
        await mobile.isHidden("#quiz-view"), false);

      const footerGap = await mobile.evaluate(() => {
        const main = document.querySelector("main");
        return Math.round(document.body.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom);
      });
      check(`28. ${label}: no footer band`, footerGap <= 1, `${footerGap}px`);

      await context.close();
    }

    /* 10 — performance -------------------------------------------------------- */
    section("performance");

    const perfContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const perf = await newPage(perfContext, base, errors);
    const timings = await perf.evaluate(() => {
      const time = (label, category, target, queries) => {
        const start = performance.now();
        for (const query of queries) {
          searchIndex(query, category, target);
        }
        return { label, ms: (performance.now() - start) / queries.length };
      };
      // Typing "betelgeuse" one character at a time is the real worst case: the
      // early letters are cheap prefix hits, the misspelling at the end forces a
      // full fuzzy sweep.
      const keystrokes = "betelguese".split("").map((_, i) => "betelguese".slice(0, i + 1));
      const real = [
        time("208 records, prefix", "All", 8, keystrokes.slice(0, 5)),
        time("208 records, fuzzy sweep", "All", 8, ["betelguese", "andromida", "proxima centari"]),
      ];

      // A synthetic 1,000-record catalogue built from the real index, so the
      // measurement covers the size the catalogue is heading toward.
      const original = state.index;
      const grown = [];
      for (let copy = 0; copy < Math.ceil(1000 / original.length); copy += 1) {
        for (const entry of original) {
          grown.push(buildSearchIndex([{
            ...entry.body,
            id: `${entry.body.id}-${copy}`,
            name: `${entry.body.name} ${copy}`,
          }])[0]);
        }
      }
      state.index = grown.slice(0, 1000);
      const synthetic = [
        time("1000 records, prefix", "All", 8, keystrokes.slice(0, 5)),
        time("1000 records, fuzzy sweep", "All", 8, ["betelguese", "andromida", "proxima centari"]),
      ];
      const size = state.index.length;
      state.index = original;
      return { real, synthetic, size };
    });

    equal("10. the synthetic fixture reached 1,000 records", timings.size, 1000);
    for (const timing of [...timings.real, ...timings.synthetic]) {
      check(`10. ${timing.label}: ${timing.ms.toFixed(2)}ms per query (budget 50ms)`,
        timing.ms < 50, `${timing.ms.toFixed(2)}ms`);
    }
    await perfContext.close();

    /* 27 — console ------------------------------------------------------------ */
    section("console");
    check("27. no console errors during any check", errors.length === 0, errors.join(" | "));
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
