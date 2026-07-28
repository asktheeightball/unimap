/* Browser checks for P4 — quiz expansion and leaderboard persistence.
 *
 * This is a maintainer script, not part of the application. UniMap ships as
 * static HTML, CSS, JavaScript and JSON with no runtime dependency; Node and
 * Playwright are development tools here in exactly the way Python is for
 * `tools/import_catalogue.py` (DECISIONS.md D1 and D6).
 *
 * Run:
 *   node tools/quiz_checks.mjs
 *
 * It serves the repository root over HTTP itself — the app fetches its
 * catalogue, so `file://` cannot be used — drives real Chromium against the
 * real `index.html`, and exits non-zero on any failure.
 *
 * The question-generation checks call `window.unimapQuiz` directly and repeat
 * each difficulty many times, because generation is randomised: a single game
 * proves nothing about a family that only fires occasionally.
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

const DIFFICULTY_IDS = ["effortless", "easy", "medium", "hard", "impossible"];
const ROUNDS = 40;

async function newPage(context, base, errors) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof state !== "undefined" && state.index.length > 0);
  // The quiz only receives the catalogue through the `unimap:data` event, so
  // wait until it has actually arrived.
  await page.waitForFunction(() => window.unimapQuiz && quiz.bodies.length > 0);
  return page;
}

async function openQuiz(page) {
  await page.click('.chip[data-mode="quiz"]');
  await page.waitForSelector("#quiz-view:not([hidden])");
}

/* Generate `rounds` games for a difficulty and return everything the checks
   need to judge them, flattened out of the browser. */
const sample = (page, difficulty, rounds) =>
  page.evaluate(([id, count]) => {
    const games = [];
    for (let i = 0; i < count; i += 1) {
      const questions = window.unimapQuiz.buildQuestions(quiz.bodies, id);
      games.push({
        questions: questions.map((question) => ({
          prompt: question.prompt,
          options: question.options,
          answer: question.options[question.answerIndex],
          answerIndex: question.answerIndex,
          explanation: question.explanation,
          subjectId: question.subjectId,
          family: question.family,
        })),
        diagnostics: JSON.parse(JSON.stringify(window.unimapQuiz.diagnostics)),
      });
    }
    return games;
  }, [difficulty, rounds]);

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
    await openQuiz(page);

    /* 1 — modes and timers ------------------------------------------------ */
    section("modes");

    const difficulties = await page.evaluate(() => window.unimapQuiz.DIFFICULTIES);
    equal("1. five difficulties are defined", difficulties.length, 5);
    for (const [id, seconds] of [
      ["effortless", 20], ["easy", 15], ["medium", 10], ["hard", 7], ["impossible", 5],
    ]) {
      const found = difficulties.find((item) => item.id === id);
      equal(`1. ${id} allows ${seconds}s per question`, found && found.seconds, seconds);
    }

    const chips = await page.$$eval("#quiz-difficulty .chip",
      (nodes) => nodes.map((node) => node.dataset.difficulty));
    check("1. every difficulty has a chip", DIFFICULTY_IDS.every((id) => chips.includes(id)),
      chips.join(","));
    equal("1. Effortless is the default selection",
      await page.getAttribute('.chip[data-difficulty="effortless"]', "aria-pressed"), "true");

    /* 2 — every difficulty fills a full game ------------------------------ */
    section("generation");

    const samples = {};
    for (const id of DIFFICULTY_IDS) {
      samples[id] = await sample(page, id, ROUNDS);
    }

    for (const id of DIFFICULTY_IDS) {
      const short = samples[id].filter((game) => game.questions.length !== 10);
      equal(`2. ${id} produced 10 questions in all ${ROUNDS} games`, short.length, 0);
    }

    /* 3 — answer-set integrity ------------------------------------------- */
    section("answers");

    let totalQuestions = 0;
    const problems = { choices: 0, duplicates: 0, answer: 0, subject: 0, prompt: 0, blank: 0 };
    for (const id of DIFFICULTY_IDS) {
      for (const game of samples[id]) {
        const subjects = new Set();
        const prompts = new Set();
        for (const question of game.questions) {
          totalQuestions += 1;
          if (question.options.length !== 4) problems.choices += 1;
          if (new Set(question.options.map((o) => o.toLowerCase())).size !== 4) {
            problems.duplicates += 1;
          }
          if (question.answerIndex < 0 || question.answerIndex > 3) problems.answer += 1;
          if (question.options.some((option) => !String(option).trim())) problems.blank += 1;
          if (subjects.has(question.subjectId)) problems.subject += 1;
          if (prompts.has(question.prompt)) problems.prompt += 1;
          subjects.add(question.subjectId);
          prompts.add(question.prompt);
        }
      }
    }
    check(`3. sampled ${totalQuestions} questions across five difficulties`,
      totalQuestions === ROUNDS * 10 * 5, String(totalQuestions));
    equal("3. every question offers exactly four choices", problems.choices, 0);
    equal("3. no question repeats a choice", problems.duplicates, 0);
    equal("3. no choice is blank", problems.blank, 0);
    equal("3. every question has a valid answer index", problems.answer, 0);
    equal("3. no object is the subject of two questions in a game", problems.subject, 0);
    equal("3. no prompt repeats within a game", problems.prompt, 0);

    /* 4 — the answer is never given away by the prompt --------------------- */
    section("fairness");

    let leaks = 0;
    const leakExamples = [];
    for (const id of DIFFICULTY_IDS) {
      for (const game of samples[id]) {
        for (const question of game.questions) {
          // A prompt that contains its own answer verbatim is not a question.
          // "What kind of object is X?" is exempt only when the answer is a
          // type, which never appears in the prompt anyway.
          if (question.prompt.includes(question.answer)) {
            leaks += 1;
            if (leakExamples.length < 3) leakExamples.push(question.prompt);
          }
        }
      }
    }
    equal("4. no prompt contains its own answer", leaks, 0);
    if (leakExamples.length) console.log(`      examples: ${leakExamples.join(" | ")}`);

    /* 5 — Effortless content rules ---------------------------------------- */
    section("effortless");

    const effortlessFamilies = new Set();
    const effortlessSubjects = new Set();
    for (const game of samples.effortless) {
      for (const question of game.questions) {
        effortlessFamilies.add(question.family);
        effortlessSubjects.add(question.subjectId);
      }
    }
    const forbidden = ["discoveryYear", "spectralOfStar", "starOfSpectral",
      "coordinatesOfObject", "objectAtCoordinates", "distance", "size", "classification"];
    const used = [...effortlessFamilies];
    check("5. Effortless uses only identity and type families",
      used.every((family) => !forbidden.includes(family)), used.join(","));

    const wellKnown = await page.evaluate(() =>
      window.unimapQuiz.wellKnownPool(quiz.bodies).map((body) => body.id));
    const effortlessPool = await page.evaluate(() =>
      window.unimapQuiz.effortlessPool(quiz.bodies).map((body) => body.id));
    check(`5. the Effortless pool is ${effortlessPool.length} common-named well-known records`,
      effortlessPool.length >= 10, String(effortlessPool.length));
    check(`5. the well-known pool is ${wellKnown.length} records`,
      wellKnown.length >= effortlessPool.length, String(wellKnown.length));
    check("5. every Effortless subject is well-known",
      [...effortlessSubjects].every((id) => wellKnown.includes(id)),
      [...effortlessSubjects].filter((id) => !wellKnown.includes(id)).join(","));
    check("5. Effortless never needed a fallback tier",
      samples.effortless.every((game) => game.diagnostics.tiersUsed === 1),
      String(samples.effortless.filter((g) => g.diagnostics.tiersUsed > 1).length));

    /* 6 — Hard and Impossible differ by content, not only by clock --------- */
    section("difficulty");

    const familiesFor = (id) => {
      const counts = {};
      for (const game of samples[id]) {
        for (const [family, n] of Object.entries(game.diagnostics.families)) {
          counts[family] = (counts[family] || 0) + n;
        }
      }
      return counts;
    };

    const hardFamilies = familiesFor("hard");
    const impossibleFamilies = familiesFor("impossible");
    const easyFamilies = familiesFor("easy");

    const hardSignature = ["discoveryYear", "spectralOfStar", "classification"];
    check("6. Hard draws on discovery, spectral and classification families",
      hardSignature.some((family) => hardFamilies[family] > 0),
      JSON.stringify(hardFamilies));

    const impossibleSignature = ["starOfSpectral", "coordinatesOfObject", "objectAtCoordinates"];
    check("6. Impossible draws on exact-identifier and coordinate families",
      impossibleSignature.some((family) => impossibleFamilies[family] > 0),
      JSON.stringify(impossibleFamilies));

    check("6. Easy never asks a coordinate question",
      !easyFamilies.coordinatesOfObject && !easyFamilies.objectAtCoordinates,
      JSON.stringify(easyFamilies));
    check("6. Easy never asks a discovery question", !easyFamilies.discoveryYear,
      JSON.stringify(easyFamilies));
    check("6. Easy asks more than Effortless does",
      (easyFamilies.distance || 0) + (easyFamilies.size || 0) > 0, JSON.stringify(easyFamilies));
    const mediumFamilies = familiesFor("medium");
    check("6. Medium leads with the source classification",
      (mediumFamilies.classification || 0) > 0, JSON.stringify(mediumFamilies));

    const share = (counts, names) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const hit = names.reduce((sum, name) => sum + (counts[name] || 0), 0);
      return total ? hit / total : 0;
    };
    const hardShare = share(hardFamilies, hardSignature);
    const impossibleShare = share(impossibleFamilies, impossibleSignature);
    check(`6. Hard is mostly its preferred families (${(hardShare * 100).toFixed(0)}%)`,
      hardShare >= 0.8, String(hardShare));
    check(`6. Impossible is mostly its preferred families (${(impossibleShare * 100).toFixed(0)}%)`,
      impossibleShare >= 0.8, String(impossibleShare));

    /* 7 — same-category distractors on the hardest modes ------------------- */
    section("distractors");

    const objectAnswerFamilies = new Set(["objectAtCoordinates", "starOfSpectral"]);
    const typesByName = await page.evaluate(() =>
      Object.fromEntries(quiz.bodies.map((body) => [body.name, body.type])));

    let tight = 0;
    let tightTotal = 0;
    for (const game of samples.impossible) {
      for (const question of game.questions) {
        if (!objectAnswerFamilies.has(question.family)) continue;
        const types = question.options.map((option) => typesByName[option]).filter(Boolean);
        if (types.length !== 4) continue;
        tightTotal += 1;
        if (new Set(types).size === 1) tight += 1;
      }
    }
    check(`7. Impossible keeps object choices in one category (${tight}/${tightTotal})`,
      tightTotal === 0 || tight / tightTotal >= 0.9, `${tight}/${tightTotal}`);

    /* 8 — fallback preserves the timer and is reported --------------------- */
    section("fallback");

    const fallback = await page.evaluate(() => {
      // Ten records with no optional fields at all: enough for type and
      // membership questions, nothing else. Every difficulty must still fill a
      // game by falling back, and must report that it did.
      const bare = [];
      const types = ["Star", "Galaxy", "Nebula", "Black Hole"];
      for (let i = 0; i < 12; i += 1) {
        bare.push({ id: `bare-${i}`, name: `Bare ${i}`, type: types[i % types.length] });
      }
      const out = {};
      for (const difficulty of window.unimapQuiz.DIFFICULTIES) {
        const questions = window.unimapQuiz.buildQuestions(bare, difficulty.id);
        out[difficulty.id] = {
          count: questions.length,
          seconds: difficulty.seconds,
          diagnostics: JSON.parse(JSON.stringify(window.unimapQuiz.diagnostics)),
        };
      }
      return out;
    });

    for (const id of DIFFICULTY_IDS) {
      equal(`8. ${id} still fills a game from a bare catalogue`, fallback[id].count, 10);
      check(`8. ${id} reports the fallback it used`,
        fallback[id].diagnostics.tiersUsed >= 1 && fallback[id].diagnostics.produced === 10,
        JSON.stringify(fallback[id].diagnostics));
    }
    check("8. the hardest modes report falling back on a bare catalogue",
      fallback.impossible.diagnostics.fellBack && fallback.hard.diagnostics.fellBack,
      JSON.stringify({ hard: fallback.hard.diagnostics.fellBack,
        impossible: fallback.impossible.diagnostics.fellBack }));
    equal("8. Impossible keeps its 5s timer while falling back", fallback.impossible.seconds, 5);
    equal("8. Effortless keeps its 20s timer", fallback.effortless.seconds, 20);

    /* 9 — explanations ----------------------------------------------------- */
    section("explanations");

    let missing = 0;
    let unattributed = 0;
    let mentionsAnswer = 0;
    const sampledExplanations = [];
    for (const id of DIFFICULTY_IDS) {
      for (const game of samples[id]) {
        for (const question of game.questions) {
          if (!question.explanation || question.explanation.length < 12) missing += 1;
          if (question.explanation.includes("undefined") ||
              question.explanation.includes("null")) unattributed += 1;
          if (question.explanation.includes(question.answer)) mentionsAnswer += 1;
          if (sampledExplanations.length < 5 && id === "impossible") {
            sampledExplanations.push(`${question.prompt} -> ${question.explanation}`);
          }
        }
      }
    }
    equal("9. every question has an explanation", missing, 0);
    equal("9. no explanation leaks an absent value", unattributed, 0);
    check(`9. explanations restate the answer (${mentionsAnswer}/${totalQuestions})`,
      mentionsAnswer / totalQuestions >= 0.9, String(mentionsAnswer));
    for (const example of sampledExplanations) console.log(`      ${example}`);

    /* 10 — leaderboard storage schema -------------------------------------- */
    section("storage");

    const stored = await page.evaluate(() => {
      const q = window.unimapQuiz;
      localStorage.clear();
      q.writeLeaderboard("hard", [{
        name: "Ada", score: 850, difficulty: "hard", questions: 10, maximumScore: 1000,
        date: "2026-07-27", completedAt: "2026-07-27T20:15:00.000Z", durationMs: 54213,
      }]);
      return {
        key: q.leaderboardKey("hard"),
        raw: JSON.parse(localStorage.getItem(q.leaderboardKey("hard"))),
        version: q.STORAGE_VERSION,
      };
    });
    equal("10. the storage key is per difficulty", stored.key, "unimap.leaderboard.hard");
    equal("10. stored data carries a version", stored.raw.version, 1);
    check("10. stored data holds an entries array", Array.isArray(stored.raw.entries));
    const entry = stored.raw.entries[0];
    check("10. an entry carries the documented fields",
      ["name", "score", "difficulty", "questions", "maximumScore", "date", "completedAt",
        "durationMs"].every((field) => field in entry), Object.keys(entry).join(","));

    /* 11 — migration from the unversioned shape ----------------------------- */
    const migrated = await page.evaluate(() => {
      const q = window.unimapQuiz;
      localStorage.clear();
      // The pre-P4 shape: a bare array, no envelope, no difficulty, no time.
      localStorage.setItem(q.leaderboardKey("easy"), JSON.stringify([
        { name: "Old", score: 640, questions: 10, date: "2026-07-01" },
      ]));
      const read = q.readLeaderboard("easy");
      return {
        entries: read.entries,
        migrated: read.migrated,
        rewritten: JSON.parse(localStorage.getItem(q.leaderboardKey("easy"))),
      };
    });
    equal("11. legacy entries survive migration", migrated.entries.length, 1);
    equal("11. the legacy score is preserved", migrated.entries[0].score, 640);
    equal("11. migration fills in the difficulty", migrated.entries[0].difficulty, "easy");
    equal("11. migration fills in the maximum score", migrated.entries[0].maximumScore, 1000);
    equal("11. migration is reported", migrated.migrated, true);
    equal("11. storage is rewritten in the versioned shape", migrated.rewritten.version, 1);

    /* 12 — corruption recovery ---------------------------------------------- */
    const corrupt = await page.evaluate(() => {
      const q = window.unimapQuiz;
      localStorage.clear();
      localStorage.setItem(q.leaderboardKey("medium"), "{not json at all");
      const read = q.readLeaderboard("medium");
      return {
        entries: read.entries.length,
        recovered: read.recovered,
        quarantined: localStorage.getItem(`${q.leaderboardKey("medium")}.corrupt`),
        cleared: localStorage.getItem(q.leaderboardKey("medium")),
      };
    });
    equal("12. unreadable storage yields no entries", corrupt.entries, 0);
    equal("12. unreadable storage is reported as recovered", corrupt.recovered, true);
    equal("12. the unreadable bytes are quarantined, not destroyed",
      corrupt.quarantined, "{not json at all");
    equal("12. the bad key is cleared", corrupt.cleared, null);

    const partial = await page.evaluate(() => {
      const q = window.unimapQuiz;
      localStorage.clear();
      localStorage.setItem(q.leaderboardKey("hard"), JSON.stringify({
        version: 1,
        entries: [
          { name: "Good", score: 500, questions: 10 },
          null,
          { name: "NoScore" },
          { name: "Negative", score: -5 },
          "nonsense",
        ],
      }));
      const read = q.readLeaderboard("hard");
      return { names: read.entries.map((e) => e.name), recovered: read.recovered };
    });
    check("12. valid entries survive alongside invalid ones",
      partial.names.length === 1 && partial.names[0] === "Good", partial.names.join(","));
    equal("12. dropping invalid entries is reported", partial.recovered, true);

    /* 13 — export and import ------------------------------------------------ */
    section("backup");

    const backup = await page.evaluate(() => {
      const q = window.unimapQuiz;
      localStorage.clear();
      q.writeLeaderboard("hard", [{
        name: "Ada", score: 850, difficulty: "hard", questions: 10, maximumScore: 1000,
        date: "2026-07-27", completedAt: "2026-07-27T20:15:00.000Z", durationMs: 54213,
      }]);
      const bundle = q.exportBundle();

      // A different device's backup, plus a repeat of one we already hold.
      const other = JSON.parse(JSON.stringify(bundle));
      other.leaderboards.hard.entries.push({
        name: "Grace", score: 900, difficulty: "hard", questions: 10, maximumScore: 1000,
        date: "2026-07-26", completedAt: "2026-07-26T10:00:00.000Z", durationMs: 40000,
      });

      const first = q.importBundle(other);
      const second = q.importBundle(other);
      const after = q.readLeaderboard("hard").entries;

      let refused = "";
      try {
        q.importBundle({ kind: "something-else", leaderboards: {} });
      } catch (error) {
        refused = error.message;
      }

      return {
        kind: bundle.kind,
        version: bundle.version,
        boards: Object.keys(bundle.leaderboards),
        exportedEntries: bundle.leaderboards.hard.entries.length,
        first,
        second,
        names: after.map((e) => e.name),
        top: after[0],
        refused,
      };
    });

    equal("13. the export is tagged", backup.kind, "unimap.leaderboards");
    equal("13. the export is versioned", backup.version, 1);
    equal("13. the export covers all five modes", backup.boards.length, 5);
    equal("13. the export carries the stored scores", backup.exportedEntries, 1);
    equal("13. importing adds the new score", backup.first, 1);
    equal("13. re-importing the same backup adds nothing", backup.second, 0);
    check("13. importing merges rather than replaces",
      backup.names.includes("Ada") && backup.names.includes("Grace"), backup.names.join(","));
    equal("13. the merged board is ranked by score", backup.top.name, "Grace");
    check("13. a foreign file is refused with a readable message",
      backup.refused.includes("not a UniMap leaderboard backup"), backup.refused);

    /* 14 — the leaderboard interface ---------------------------------------- */
    section("interface");

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => window.unimapQuiz && quiz.bodies.length > 0);
    await openQuiz(page);

    check("14. the device-only note is visible",
      (await page.textContent(".quiz-storage-note")).includes("stored on this device"));
    for (const id of ["quiz-export", "quiz-import", "quiz-clear"]) {
      check(`14. #${id} is present and reachable`,
        await page.isVisible(`#${id}`));
    }
    equal("14. Clear is disabled while the board is empty",
      await page.isDisabled("#quiz-clear"), true);
    equal("14. the empty state is shown",
      await page.isVisible("#quiz-leaderboard-empty"), true);

    // Selecting a difficulty must swap the board.
    await page.click('.chip[data-difficulty="impossible"]');
    check("14. the heading follows the selected difficulty",
      (await page.textContent("#quiz-leaderboard-title")).startsWith("Impossible"));
    await page.click('.chip[data-difficulty="effortless"]');
    check("14. the heading follows back",
      (await page.textContent("#quiz-leaderboard-title")).startsWith("Effortless"));

    /* 15 — a full game, end to end ------------------------------------------ */
    section("gameplay");

    await page.fill("#quiz-name", "Checker");
    await page.click("#quiz-start");
    await page.waitForSelector("#quiz-play:not([hidden])");
    check("15. the leaderboard is hidden during play",
      await page.isHidden("#quiz-leaderboard"));
    equal("15. the first question is shown",
      await page.textContent("#quiz-progress"), "Question 1 of 10");

    for (let i = 0; i < 10; i += 1) {
      await page.waitForSelector(".quiz-choice:not([disabled])");
      // Answer correctly every time, using the keyboard for half the game so
      // both input paths are exercised in a real game.
      const answerIndex = await page.evaluate(() =>
        quiz.questions[quiz.index].answerIndex);
      if (i % 2 === 0) {
        await page.click(`.quiz-choice[data-position="${answerIndex}"]`);
      } else {
        await page.keyboard.press(String(answerIndex + 1));
      }
      await page.waitForSelector("#quiz-feedback:not([hidden])");
      if (i === 0) {
        check("15. the correct choice is marked",
          await page.isVisible(`.quiz-choice[data-position="${answerIndex}"].is-correct`));
        check("15. feedback names the answer",
          (await page.textContent(".quiz-result")).includes("The answer is"));
        check("15. feedback carries an explanation",
          (await page.textContent(".quiz-explanation")).length > 12);
      }
      await page.click("#quiz-next");
    }

    await page.waitForSelector("#quiz-results:not([hidden])");
    const finalScore = await page.textContent("#quiz-results-score");
    check(`15. a full game finishes with a score (${finalScore})`, finalScore.includes("of 1000"),
      finalScore);
    check("15. the results line names the mode and timer",
      (await page.textContent("#quiz-results-detail")).includes("20 seconds per question"));

    const saved = await page.evaluate(() =>
      window.unimapQuiz.readLeaderboard("effortless").entries);
    equal("15. the score reached the leaderboard", saved.length, 1);
    equal("15. the player name was stored", saved[0].name, "Checker");
    equal("15. the entry records its difficulty", saved[0].difficulty, "effortless");
    check("15. the entry records how long the game took", saved[0].durationMs > 0,
      String(saved[0].durationMs));
    check("15. the entry carries a completion timestamp",
      /^\d{4}-\d{2}-\d{2}T/.test(saved[0].completedAt), saved[0].completedAt);
    check("15. the leaderboard is visible again after the game",
      await page.isVisible("#quiz-leaderboard"));
    equal("15. Clear is enabled once a score exists",
      await page.isDisabled("#quiz-clear"), false);

    /* 16 — scores survive a reload ------------------------------------------ */
    section("persistence");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => window.unimapQuiz && quiz.bodies.length > 0);
    await openQuiz(page);
    const rows = await page.$$eval("#quiz-leaderboard-body tr",
      (nodes) => nodes.map((node) => node.textContent));
    check("16. the score is still listed after a reload",
      rows.length === 1 && rows[0].includes("Checker"), JSON.stringify(rows));
    check("16. the score is shown out of its maximum", rows[0].includes("/ 1000"), rows[0]);

    /* 17 — mobile ------------------------------------------------------------ */
    section("mobile");

    const mobile = await browser.newContext({ ...devices["Pixel 5"] });
    const small = await newPage(mobile, base, errors);
    await openQuiz(small);
    await small.fill("#quiz-name", "Phone");
    await small.click("#quiz-start");
    await small.waitForSelector("#quiz-play:not([hidden])");

    const overflow = await small.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check("17. the quiz does not scroll sideways on a phone", overflow <= 0, String(overflow));

    const box = await small.evaluate(() => {
      const button = document.querySelector(".quiz-choice");
      const rect = button.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
    check(`17. choices are a usable touch target (${box.height.toFixed(0)}px tall)`,
      box.height >= 40, JSON.stringify(box));

    await small.tap(".quiz-choice[data-position='0']");
    await small.waitForSelector("#quiz-feedback:not([hidden])");
    check("17. tapping a choice answers the question", await small.isVisible("#quiz-next"));

    await small.click('.chip[data-mode="browse"]');
    await small.waitForSelector("#browse-view:not([hidden])");
    const stoppedTimer = await small.evaluate(() => quiz.frame);
    equal("17. leaving the quiz stops the timer", stoppedTimer, 0);
    await mobile.close();

    /* 18 — console ----------------------------------------------------------- */
    section("console");
    check("18. no console errors during any check", errors.length === 0, errors.join(" | "));
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
