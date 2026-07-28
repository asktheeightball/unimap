/* UniMap quiz — timed multiple-choice questions built from catalogue fields.

   Every question is generated from stored, validated values. Nothing is parsed
   out of prose and nothing is inferred: if a field is absent, the question
   family that needs it simply is not offered for that record (DECISIONS.md D7).
*/

const QUIZ_MODES = {
  easy: { label: "Easy", seconds: 15 },
  medium: { label: "Medium", seconds: 10 },
  hard: { label: "Hard", seconds: 7 },
  impossible: { label: "Impossible", seconds: 5 },
};

const QUESTION_COUNT = 10;
const OPTION_COUNT = 4;
const MAX_LEADERBOARD_ENTRIES = 10;
const STORAGE_KEY = "unimap.leaderboards.v1";

/* Distractors must be far enough from the answer that the question has one
   defensible answer rather than a coin flip between two near-identical values. */
const VALUE_SEPARATION = 2.0; // "how far away is X" — options differ by >= 2x
const ORDER_SEPARATION = 1.25; // "which is closest" — winner beats runner-up by >= 25%
const MEASUREMENT_SEPARATION = 1.25;

const LIGHT_YEARS_PER_LIGHT_MINUTE = 1 / 525600;
const LIGHT_YEARS_PER_AU = 1.58125e-5;

const quizState = {
  catalogue: [],
  mode: null,
  playerName: "",
  questions: [],
  index: 0,
  totalScore: 0,
  question: null,
  answered: false,
  frame: 0,
  questionStart: 0,
  storageWorks: true,
};

const qel = {};

/* --- catalogue field readers -------------------------------------------- */

/* Parse a published distance string into light-years for comparison only.
   The original string is what gets displayed; this value never reaches the
   interface, so no rounded or converted number is presented as a source value.

   `kind` matters: a dwarf planet's "distance" is a mean orbital distance from
   the Sun, which is not the same quantity as a deep-sky object's distance from
   Earth. Mixing them in one question would be ambiguous, so the distance
   families accept only `earth`. */
function parseDistance(value) {
  const match = /^~?\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?\s*(ly|light-years?|light-minutes?|AU)\b/i
    .exec(String(value ?? "").trim());
  if (!match) {
    return null;
  }

  const scales = { thousand: 1e3, million: 1e6, billion: 1e9 };
  const amount = Number(match[1].replace(/,/g, "")) * (scales[(match[2] || "").toLowerCase()] || 1);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unit = match[3].toLowerCase();
  if (unit.startsWith("ly") || unit.startsWith("light-year")) {
    return { lightYears: amount, kind: "earth" };
  }
  if (unit.startsWith("light-minute")) {
    return { lightYears: amount * LIGHT_YEARS_PER_LIGHT_MINUTE, kind: "earth" };
  }
  return { lightYears: amount * LIGHT_YEARS_PER_AU, kind: "orbital" };
}

/* A catalogue designation such as "* bet UMi" or "136199 Eris (2003 UB313)".
   Spectral types and host-system aliases are descriptions, not designations,
   so they are not usable as "which identifier is this object" answers. */
function designationOf(body) {
  const aliases = Array.isArray(body.aliases) ? body.aliases : [];
  return aliases.find((alias) => {
    const text = String(alias ?? "").trim();
    return text !== "" && !text.startsWith("Spectral type") && !text.endsWith(" system");
  }) || null;
}

function measurementOf(body) {
  const label = String(body.measurementLabel ?? "").trim();
  const raw = String(body.measurementValue ?? "").trim();
  const amount = Number(raw);
  if (!label || !raw || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return { label, display: raw, amount };
}

/* --- random helpers ------------------------------------------------------ */

function randomInt(limit) {
  return Math.floor(Math.random() * limit);
}

function shuffled(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickSome(items, count) {
  return shuffled(items).slice(0, count);
}

/* --- question families ---------------------------------------------------

   Each family returns a question or null when the chosen record cannot support
   one. Returning null is normal: it is how a record with a missing or
   too-similar field is excluded, rather than by inventing a value.

   Every family must produce exactly OPTION_COUNT options, exactly one of which
   is correct, with no two option labels equal.
*/

function distinctLabels(options) {
  const seen = new Set(options.map((option) => option.label.trim().toLowerCase()));
  return seen.size === options.length;
}

function finish(prompt, options, explanation, family) {
  if (options.length !== OPTION_COUNT || !distinctLabels(options)) {
    return null;
  }
  if (options.filter((option) => option.correct).length !== 1) {
    return null;
  }
  const ordered = shuffled(options);
  return {
    family,
    prompt,
    explanation,
    options: ordered,
    answerIndex: ordered.findIndex((option) => option.correct),
  };
}

/* "What type of object is Kochab?" — answer is the record's stored type. */
function askObjectType(body, catalogue) {
  const others = [...new Set(catalogue.map((item) => item.type))]
    .filter((type) => type !== body.type);
  if (others.length < OPTION_COUNT - 1) {
    return null;
  }

  const options = [
    { label: body.type, correct: true },
    ...pickSome(others, OPTION_COUNT - 1).map((type) => ({ label: type, correct: false })),
  ];

  return finish(
    `What kind of object is ${body.name}?`,
    options,
    `${body.name} is catalogued as a ${body.type}.`,
    "object-type",
  );
}

/* "Which of these is a Nebula?" — distractors must not share the answer's type. */
function askWhichIsType(body, catalogue) {
  const others = catalogue.filter((item) => item.type !== body.type && item.name !== body.name);
  if (others.length < OPTION_COUNT - 1) {
    return null;
  }

  const distractors = pickSome(others, OPTION_COUNT - 1);
  const options = [
    { label: body.name, correct: true },
    ...distractors.map((item) => ({ label: item.name, correct: false })),
  ];

  const named = distractors.map((item) => `${item.name} is a ${item.type}`).join(", ");
  return finish(
    `Which of these is a ${body.type}?`,
    options,
    `${body.name} is a ${body.type}. By comparison, ${named}.`,
    "which-is-type",
  );
}

/* "Which of these is closest to Earth?" — the answer must beat every distractor
   by ORDER_SEPARATION, so the ordering does not hinge on rounding. */
function askDistanceOrder(body, catalogue) {
  const own = parseDistance(body.distance);
  if (!own || own.kind !== "earth") {
    return null;
  }

  const wantClosest = Math.random() < 0.5;
  const candidates = catalogue.filter((item) => {
    if (item.id === body.id) {
      return false;
    }
    const other = parseDistance(item.distance);
    if (!other || other.kind !== "earth") {
      return false;
    }
    return wantClosest
      ? other.lightYears >= own.lightYears * ORDER_SEPARATION
      : other.lightYears <= own.lightYears / ORDER_SEPARATION;
  });

  if (candidates.length < OPTION_COUNT - 1) {
    return null;
  }

  const distractors = pickSome(candidates, OPTION_COUNT - 1);
  const options = [
    { label: body.name, correct: true },
    ...distractors.map((item) => ({ label: item.name, correct: false })),
  ];

  return finish(
    `Which of these lies ${wantClosest ? "closest to" : "farthest from"} Earth?`,
    options,
    `${body.name} is ${body.distance} away.`,
    "distance-order",
  );
}

/* "About how far from Earth is Canopus?" — options are published distance
   strings, kept at least VALUE_SEPARATION apart from each other. */
function askDistanceValue(body, catalogue) {
  const own = parseDistance(body.distance);
  if (!own || own.kind !== "earth") {
    return null;
  }

  const chosen = [];
  const pool = shuffled(catalogue.filter((item) => item.id !== body.id));

  for (const item of pool) {
    const other = parseDistance(item.distance);
    if (!other || other.kind !== "earth") {
      continue;
    }
    const spreadFromAnswer = Math.max(own.lightYears, other.lightYears)
      / Math.min(own.lightYears, other.lightYears);
    if (spreadFromAnswer < VALUE_SEPARATION) {
      continue;
    }
    const clashes = chosen.some((picked) => {
      const ratio = Math.max(picked.lightYears, other.lightYears)
        / Math.min(picked.lightYears, other.lightYears);
      return ratio < VALUE_SEPARATION;
    });
    if (clashes) {
      continue;
    }
    chosen.push({ label: item.distance, lightYears: other.lightYears });
    if (chosen.length === OPTION_COUNT - 1) {
      break;
    }
  }

  if (chosen.length < OPTION_COUNT - 1) {
    return null;
  }

  const options = [
    { label: body.distance, correct: true },
    ...chosen.map((item) => ({ label: item.label, correct: false })),
  ];

  return finish(
    `About how far from Earth is ${body.name}?`,
    options,
    `${body.name} lies ${body.distance} away, according to ${body.sourceName || "the catalogue"}.`,
    "distance-value",
  );
}

/* "Which catalogue designation refers to Kochab?" — each designation belongs to
   exactly one object, so the wrong options cannot accidentally be right. */
function askDesignation(body, catalogue) {
  const own = designationOf(body);
  if (!own) {
    return null;
  }

  const others = catalogue
    .filter((item) => item.id !== body.id)
    .map(designationOf)
    .filter((value) => value && value !== own);

  if (others.length < OPTION_COUNT - 1) {
    return null;
  }

  const options = [
    { label: own, correct: true },
    ...pickSome([...new Set(others)], OPTION_COUNT - 1)
      .map((value) => ({ label: value, correct: false })),
  ];

  return finish(
    `Which catalogue designation refers to ${body.name}?`,
    options,
    `${body.name} is catalogued as ${own}.`,
    "designation",
  );
}

/* "What is the parallax (mas) of Kochab?" — distractors come only from records
   sharing the same measurement label, so the units are always comparable. */
function askMeasurement(body, catalogue) {
  const own = measurementOf(body);
  if (!own) {
    return null;
  }

  const chosen = [];
  const pool = shuffled(catalogue.filter((item) => item.id !== body.id));

  for (const item of pool) {
    const other = measurementOf(item);
    if (!other || other.label !== own.label) {
      continue;
    }
    const spread = Math.max(own.amount, other.amount) / Math.min(own.amount, other.amount);
    if (spread < MEASUREMENT_SEPARATION) {
      continue;
    }
    const clashes = chosen.some((picked) => {
      const ratio = Math.max(picked.amount, other.amount) / Math.min(picked.amount, other.amount);
      return ratio < MEASUREMENT_SEPARATION;
    });
    if (clashes) {
      continue;
    }
    chosen.push(other);
    if (chosen.length === OPTION_COUNT - 1) {
      break;
    }
  }

  if (chosen.length < OPTION_COUNT - 1) {
    return null;
  }

  const readable = own.label.charAt(0).toLowerCase() + own.label.slice(1);
  const options = [
    { label: own.display, correct: true },
    ...chosen.map((item) => ({ label: item.display, correct: false })),
  ];

  return finish(
    `What is the ${readable} of ${body.name}?`,
    options,
    `${body.name} has a ${readable} of ${own.display}.`,
    "measurement",
  );
}

const QUESTION_FAMILIES = [
  askObjectType,
  askWhichIsType,
  askDistanceOrder,
  askDistanceValue,
  askDesignation,
  askMeasurement,
];

/* Build one quiz. A record is used as the subject at most once, so a single
   round cannot ask about the same object twice. */
function buildQuiz(catalogue, count) {
  const subjects = shuffled(catalogue);
  const questions = [];

  for (const body of subjects) {
    if (questions.length === count) {
      break;
    }
    for (const family of shuffled(QUESTION_FAMILIES)) {
      const question = family(body, catalogue);
      if (question) {
        questions.push(question);
        break;
      }
    }
  }

  return questions;
}

/* --- scoring -------------------------------------------------------------

   score = round(100 * remaining ms / total ms), clamped to 0..100 (ROADMAP R2).
   A correct answer scores whatever remains; an incorrect or expired answer
   scores 0.
*/
function pointsAvailable(remainingMs, totalMs) {
  if (totalMs <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((100 * remainingMs) / totalMs)));
}

/* --- leaderboard storage ------------------------------------------------- */

function emptyBoards() {
  return Object.fromEntries(Object.keys(QUIZ_MODES).map((mode) => [mode, []]));
}

function validEntry(entry) {
  return Boolean(entry)
    && typeof entry === "object"
    && !Array.isArray(entry)
    && typeof entry.name === "string"
    && Number.isFinite(Number(entry.score))
    && Number.isFinite(Number(entry.questions));
}

/* Stored data is untrusted: it may be absent, unparseable, the wrong shape, or
   edited by hand. Anything that does not match the expected shape is dropped
   rather than allowed to break the quiz. */
function readBoards() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    quizState.storageWorks = false;
    return emptyBoards();
  }
  if (!raw) {
    return emptyBoards();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return emptyBoards();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return emptyBoards();
  }

  const boards = emptyBoards();
  for (const mode of Object.keys(QUIZ_MODES)) {
    const entries = Array.isArray(parsed[mode]) ? parsed[mode] : [];
    boards[mode] = entries
      .filter(validEntry)
      .map((entry) => ({
        name: String(entry.name).slice(0, 24) || "Anonymous",
        score: Math.max(0, Math.round(Number(entry.score))),
        questions: Math.max(0, Math.round(Number(entry.questions))),
        date: typeof entry.date === "string" ? entry.date : "",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  }
  return boards;
}

function writeBoards(boards) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
    return true;
  } catch (error) {
    quizState.storageWorks = false;
    return false;
  }
}

function recordScore(mode, name, score, questions) {
  const boards = readBoards();
  boards[mode] = [...boards[mode], {
    name: name || "Anonymous",
    score,
    questions,
    date: new Date().toISOString().slice(0, 10),
  }]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
  writeBoards(boards);
  return boards;
}

/* --- rendering ----------------------------------------------------------- */

function renderLeaderboards() {
  const boards = readBoards();
  qel.leaderboards.replaceChildren();

  for (const [mode, config] of Object.entries(QUIZ_MODES)) {
    const section = document.createElement("section");
    section.className = "leaderboard";

    const heading = document.createElement("h4");
    heading.textContent = `${config.label} — ${config.seconds}s per question`;
    section.append(heading);

    const entries = boards[mode];
    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "leaderboard-empty";
      empty.textContent = "No scores yet.";
      section.append(empty);
    } else {
      const list = document.createElement("ol");
      list.className = "leaderboard-list";
      for (const entry of entries) {
        const item = document.createElement("li");
        const who = document.createElement("span");
        who.className = "leaderboard-name";
        who.textContent = entry.name;
        const detail = document.createElement("span");
        detail.className = "leaderboard-detail";
        detail.textContent = `${entry.score} pts · ${entry.questions} questions${entry.date ? ` · ${entry.date}` : ""}`;
        item.append(who, detail);
        list.append(item);
      }
      section.append(list);
    }

    qel.leaderboards.append(section);
  }
}

function paintPoints(points, totalMs, remainingMs) {
  qel.pointsValue.textContent = String(points);
  qel.meter.value = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;
}

function renderQuestion() {
  const question = quizState.questions[quizState.index];
  quizState.question = question;
  quizState.answered = false;

  qel.progress.textContent = `Question ${quizState.index + 1} of ${quizState.questions.length}`;
  qel.total.textContent = `Score ${quizState.totalScore}`;
  qel.prompt.textContent = question.prompt;
  qel.feedback.hidden = true;
  qel.answers.replaceChildren();

  question.options.forEach((option, position) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-answer";
    button.dataset.position = String(position);

    const key = document.createElement("span");
    key.className = "quiz-answer-key";
    key.textContent = String(position + 1);

    const label = document.createElement("span");
    label.className = "quiz-answer-label";
    label.textContent = option.label;

    button.append(key, label);
    button.addEventListener("click", () => answer(position));
    item.append(button);
    qel.answers.append(item);
  });

  startTimer();
  qel.answers.querySelector(".quiz-answer")?.focus();
}

/* The full 100 is painted synchronously before the first tick, so a question
   never renders showing 0 points and then jumping back up.

   The countdown runs on an interval rather than requestAnimationFrame: rAF stops
   entirely when the page is not compositing (a background tab, or a hidden
   window). That would freeze the displayed points while real time kept running,
   and a question would not expire until the tab was looked at again. An interval
   is throttled in a background tab but keeps firing.

   Elapsed time always comes from performance.now(), never from counting ticks,
   so a throttled or delayed interval cannot inflate a score. */
const TICK_MS = 50;

function startTimer() {
  const totalMs = quizState.mode.seconds * 1000;
  quizState.questionStart = performance.now();
  paintPoints(100, totalMs, totalMs);

  quizState.frame = window.setInterval(() => {
    const remaining = remainingMs(totalMs);
    paintPoints(pointsAvailable(remaining, totalMs), totalMs, remaining);
    if (remaining <= 0) {
      answer(null);
    }
  }, TICK_MS);
}

function remainingMs(totalMs) {
  return Math.max(0, totalMs - (performance.now() - quizState.questionStart));
}

function stopTimer() {
  if (quizState.frame) {
    window.clearInterval(quizState.frame);
    quizState.frame = 0;
  }
}

/* `position` is the chosen option, or null when the timer expired. */
function answer(position) {
  if (quizState.answered) {
    return;
  }
  quizState.answered = true;
  stopTimer();

  const totalMs = quizState.mode.seconds * 1000;
  const remaining = remainingMs(totalMs);
  const question = quizState.question;
  const correct = position !== null && position === question.answerIndex;
  const earned = correct ? pointsAvailable(remaining, totalMs) : 0;

  quizState.totalScore += earned;
  paintPoints(earned, totalMs, correct ? remaining : 0);
  qel.total.textContent = `Score ${quizState.totalScore}`;

  for (const button of qel.answers.querySelectorAll(".quiz-answer")) {
    const at = Number(button.dataset.position);
    button.disabled = true;
    if (at === question.answerIndex) {
      button.classList.add("is-correct");
    } else if (at === position) {
      button.classList.add("is-wrong");
    }
  }

  if (correct) {
    qel.verdict.textContent = `Correct — ${earned} points.`;
  } else if (position === null) {
    qel.verdict.textContent = "Time expired — 0 points.";
  } else {
    qel.verdict.textContent = `Not quite — 0 points. The answer is ${question.options[question.answerIndex].label}.`;
  }

  qel.explanation.textContent = question.explanation;
  qel.next.textContent = quizState.index === quizState.questions.length - 1
    ? "See final score"
    : "Next question";
  qel.feedback.hidden = false;
  qel.next.focus();
}

function nextQuestion() {
  if (quizState.index >= quizState.questions.length - 1) {
    finishQuiz();
    return;
  }
  quizState.index += 1;
  renderQuestion();
}

function finishQuiz() {
  stopTimer();
  const answered = quizState.index + 1;
  const boards = recordScore(
    quizState.modeKey,
    quizState.playerName,
    quizState.totalScore,
    answered,
  );

  qel.play.hidden = true;
  qel.results.hidden = false;
  qel.resultsScore.textContent = String(quizState.totalScore);
  qel.resultsDetail.textContent =
    `${QUIZ_MODES[quizState.modeKey].label} · ${answered} question${answered === 1 ? "" : "s"} · `
    + `${quizState.playerName || "Anonymous"}`;
  qel.resultsStorage.hidden = quizState.storageWorks;

  const best = boards[quizState.modeKey][0];
  qel.resultsBest.textContent = best
    ? `Best ${QUIZ_MODES[quizState.modeKey].label} score: ${best.score} by ${best.name}.`
    : "";
  qel.resultsBest.hidden = !best;
}

function startQuiz(modeKey) {
  const mode = QUIZ_MODES[modeKey];
  if (!mode) {
    return;
  }

  const questions = buildQuiz(quizState.catalogue, QUESTION_COUNT);
  if (questions.length === 0) {
    qel.setupError.textContent =
      "The catalogue does not currently have enough validated data to build a quiz.";
    qel.setupError.hidden = false;
    return;
  }

  qel.setupError.hidden = true;
  quizState.modeKey = modeKey;
  quizState.mode = mode;
  quizState.playerName = qel.name.value.trim().slice(0, 24);
  quizState.questions = questions;
  quizState.index = 0;
  quizState.totalScore = 0;

  qel.setup.hidden = true;
  qel.results.hidden = true;
  qel.play.hidden = false;
  qel.modeLabel.textContent = `${mode.label} · ${mode.seconds}s`;
  renderQuestion();
}

function returnToSetup() {
  stopTimer();
  qel.play.hidden = true;
  qel.results.hidden = true;
  qel.setup.hidden = false;
  renderLeaderboards();
  qel.storageNote.hidden = quizState.storageWorks;
}

/* --- view switching ------------------------------------------------------

   The catalogue keeps its own state in app.js. Switching views only toggles
   visibility, so a search and its results survive a trip through the quiz.
   Leaving mid-question abandons that round rather than leaving a timer running
   behind a hidden view; a deliberate "End quiz" records the score instead.
*/
function showView(view) {
  const quiz = view === "quiz";
  if (!quiz) {
    stopTimer();
    if (!qel.play.hidden) {
      returnToSetup();
    }
  }

  qel.catalogueView.hidden = quiz;
  qel.quizView.hidden = !quiz;

  for (const button of qel.nav.querySelectorAll(".nav-button")) {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  if (quiz) {
    qel.quizHeading.focus();
  }
}

/* --- keyboard ------------------------------------------------------------ */

function handleKeys(event) {
  if (qel.quizView.hidden || qel.play.hidden || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (!quizState.answered) {
    const position = Number(event.key) - 1;
    if (Number.isInteger(position) && position >= 0 && position < OPTION_COUNT) {
      event.preventDefault();
      answer(position);
    }
    return;
  }

  if (event.key === "Enter" && document.activeElement !== qel.next) {
    event.preventDefault();
    nextQuestion();
  }
}

/* --- setup --------------------------------------------------------------- */

function collectElements() {
  const ids = {
    nav: "view-nav",
    catalogueView: "catalogue-view",
    quizView: "quiz-view",
    quizHeading: "quiz-heading",
    setup: "quiz-setup",
    setupError: "quiz-setup-error",
    modes: "quiz-modes",
    name: "quiz-name",
    leaderboards: "leaderboards",
    storageNote: "quiz-storage-note",
    play: "quiz-play",
    modeLabel: "quiz-mode-label",
    progress: "quiz-progress",
    pointsValue: "quiz-points-value",
    meter: "quiz-meter",
    total: "quiz-total",
    prompt: "quiz-prompt",
    answers: "quiz-answers",
    feedback: "quiz-feedback",
    verdict: "quiz-verdict",
    explanation: "quiz-explanation",
    next: "quiz-next",
    quit: "quiz-quit",
    results: "quiz-results",
    resultsScore: "quiz-results-score",
    resultsDetail: "quiz-results-detail",
    resultsBest: "quiz-results-best",
    resultsStorage: "quiz-results-storage",
    again: "quiz-again",
  };
  for (const [key, id] of Object.entries(ids)) {
    qel[key] = document.getElementById(id);
  }
}

async function initQuiz() {
  collectElements();

  qel.nav.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-button");
    if (button) {
      showView(button.dataset.view);
    }
  });

  qel.modes.addEventListener("click", (event) => {
    const button = event.target.closest(".quiz-mode");
    if (button) {
      startQuiz(button.dataset.mode);
    }
  });

  qel.next.addEventListener("click", nextQuestion);
  qel.quit.addEventListener("click", finishQuiz);
  qel.again.addEventListener("click", returnToSetup);
  document.addEventListener("keydown", handleKeys);

  try {
    const response = await fetch("celestial-bodies.json");
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const data = await response.json();
    quizState.catalogue = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("UniMap quiz could not load celestial body data:", error);
    quizState.catalogue = [];
  }

  readBoards(); // Surfaces an unavailable localStorage before the first game.
  renderLeaderboards();
  qel.storageNote.hidden = quizState.storageWorks;
}

initQuiz();
