/* UniMap — quiz mode.

   Questions are generated only from validated catalogue fields that are
   actually present on a record. Nothing is fetched during gameplay: the
   catalogue is handed over once, already loaded, by app.js. */

const DIFFICULTIES = [
  { id: "easy", label: "Easy", seconds: 15 },
  { id: "medium", label: "Medium", seconds: 10 },
  { id: "hard", label: "Hard", seconds: 7 },
  { id: "impossible", label: "Impossible", seconds: 5 },
];

const QUESTIONS_PER_GAME = 10;
const CHOICE_COUNT = 4;
const MAX_POINTS = 100;
const LEADERBOARD_SIZE = 10;
const STORAGE_PREFIX = "unimap.leaderboard.";

/* Types that overlap in ordinary usage. A pulsar IS a neutron star and an
   exoplanet IS a planet, so pairing them would produce a question with two
   defensible answers. They are never used as distractors for one another. */
const CONFLICTING_TYPES = {
  "Neutron Star": ["Pulsar"],
  Pulsar: ["Neutron Star"],
  Planet: ["Exoplanet"],
  Exoplanet: ["Planet"],
};

const quiz = {
  bodies: [],
  difficulty: DIFFICULTIES[0],
  playerName: "",
  questions: [],
  index: 0,
  score: 0,
  answered: false,
  questionStart: 0,
  frame: 0,
};

const ui = {};

/* --- helpers ------------------------------------------------------------- */

function shuffle(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function conflicts(typeA, typeB) {
  if (typeA === typeB) {
    return true;
  }
  return (CONFLICTING_TYPES[typeA] || []).includes(typeB);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

/* A short factual explanation assembled only from fields the record carries.
   Distance is stated as a labelled value rather than "from Earth", because the
   quantity differs by type: light years for deep-sky objects, mean orbital
   distance in AU for dwarf planets. */
function explain(body) {
  const parts = [`${body.name} is catalogued as a ${body.type}.`];
  if (text(body.distance)) {
    parts.push(`Distance: ${text(body.distance)}.`);
  }
  if (text(body.size)) {
    parts.push(`Size: ${text(body.size)}.`);
  }
  if (text(body.measurementLabel) && text(body.measurementValue)) {
    parts.push(`${text(body.measurementLabel)}: ${text(body.measurementValue)}.`);
  }
  if (text(body.sourceName)) {
    parts.push(`Source: ${text(body.sourceName)}.`);
  }
  return parts.join(" ");
}

function makeQuestion(prompt, correct, distractors, body) {
  if (distractors.length < CHOICE_COUNT - 1) {
    return null;
  }
  const options = shuffle([correct, ...distractors.slice(0, CHOICE_COUNT - 1)]);
  return {
    prompt,
    options,
    answerIndex: options.indexOf(correct),
    explanation: explain(body),
    subjectId: body.id,
  };
}

/* --- question generation ------------------------------------------------- */

function byType(bodies) {
  const groups = new Map();
  for (const body of bodies) {
    if (!groups.has(body.type)) {
      groups.set(body.type, []);
    }
    groups.get(body.type).push(body);
  }
  return groups;
}

/* "What kind of object is X?" — available for every record, since type is a
   required field. */
function typeQuestions(bodies, types) {
  const questions = [];
  for (const body of bodies) {
    const others = types.filter((type) => !conflicts(body.type, type));
    if (others.length < CHOICE_COUNT - 1) {
      continue;
    }
    const question = makeQuestion(
      `What kind of object is ${body.name}?`,
      body.type,
      shuffle(others),
      body,
    );
    if (question) {
      questions.push(question);
    }
  }
  return questions;
}

/* "Which of these is a <type>?" — the distractors are object names, so every
   distractor must be of a type that cannot also be the answer. */
function membershipQuestions(bodies, groups) {
  const questions = [];
  for (const body of bodies) {
    const outsiders = bodies.filter((other) => !conflicts(body.type, other.type));
    if (outsiders.length < CHOICE_COUNT - 1) {
      continue;
    }
    const names = shuffle(outsiders).map((other) => other.name);
    const question = makeQuestion(
      `Which of these is a ${body.type}?`,
      body.name,
      names,
      body,
    );
    if (question) {
      questions.push(question);
    }
  }
  return questions;
}

/* Value questions compare a field only against the SAME field on objects of the
   SAME type. Distance in particular is not one quantity across the catalogue —
   light years for a galaxy, mean orbital distance in AU for a dwarf planet — so
   mixing types would produce answers that are not comparable. */
function valueQuestions(groups, field, prompt) {
  const questions = [];
  for (const [, members] of groups) {
    const withValue = members.filter((body) => text(body[field]));
    const distinct = [...new Set(withValue.map((body) => text(body[field])))];
    if (distinct.length < CHOICE_COUNT) {
      continue;
    }
    for (const body of withValue) {
      const value = text(body[field]);
      const others = distinct.filter((candidate) => candidate !== value);
      const question = makeQuestion(prompt(body), value, shuffle(others), body);
      if (question) {
        questions.push(question);
      }
    }
  }
  return questions;
}

/* "How does SIMBAD classify X?" — uses the source's own classification gloss,
   which is stored as a labelled measurement on imported deep-sky records. */
function classificationQuestions(bodies) {
  const labelled = bodies.filter(
    (body) => text(body.measurementLabel) === "SIMBAD classification" &&
      text(body.measurementValue),
  );
  const distinct = [...new Set(labelled.map((body) => text(body.measurementValue)))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of labelled) {
    const value = text(body.measurementValue);
    const others = distinct.filter((candidate) => candidate !== value);
    const question = makeQuestion(
      `How is ${body.name} classified in SIMBAD?`,
      value,
      shuffle(others),
      body,
    );
    if (question) {
      questions.push(question);
    }
  }
  return questions;
}

function buildQuestions(bodies) {
  const groups = byType(bodies);
  const types = [...groups.keys()];

  const pool = [
    ...typeQuestions(bodies, types),
    ...membershipQuestions(bodies, groups),
    ...valueQuestions(groups, "distance", (body) => `How far away is ${body.name}?`),
    ...valueQuestions(groups, "size", (body) => `How large is ${body.name}?`),
    ...classificationQuestions(bodies),
  ];

  // One question per object per game, so a single record cannot supply both the
  // question and the answer to a later one.
  const chosen = [];
  const usedSubjects = new Set();
  for (const question of shuffle(pool)) {
    if (chosen.length >= QUESTIONS_PER_GAME) {
      break;
    }
    if (usedSubjects.has(question.subjectId)) {
      continue;
    }
    usedSubjects.add(question.subjectId);
    chosen.push(question);
  }
  return chosen;
}

/* --- leaderboard --------------------------------------------------------- */

function leaderboardKey(difficultyId) {
  return `${STORAGE_PREFIX}${difficultyId}`;
}

function readLeaderboard(difficultyId) {
  try {
    const raw = window.localStorage.getItem(leaderboardKey(difficultyId));
    const entries = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries.filter((entry) => entry && typeof entry === "object") : [];
  } catch (error) {
    // Storage can be unavailable (private browsing, disabled cookies). The game
    // must still be playable, so a failure means "no scores", not a crash.
    console.warn("UniMap could not read the leaderboard:", error);
    return [];
  }
}

function writeLeaderboard(difficultyId, entries) {
  try {
    window.localStorage.setItem(leaderboardKey(difficultyId), JSON.stringify(entries));
    return true;
  } catch (error) {
    console.warn("UniMap could not save the leaderboard:", error);
    return false;
  }
}

function recordScore(difficultyId, name, score, questionCount) {
  const entries = readLeaderboard(difficultyId);
  entries.push({
    name: name || "Anonymous",
    score,
    questions: questionCount,
    date: new Date().toISOString().slice(0, 10),
  });
  entries.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const top = entries.slice(0, LEADERBOARD_SIZE);
  writeLeaderboard(difficultyId, top);
  return top;
}

function renderLeaderboard(difficultyId) {
  const entries = readLeaderboard(difficultyId);
  const difficulty = DIFFICULTIES.find((item) => item.id === difficultyId);
  ui.leaderboardTitle.textContent = `${difficulty ? difficulty.label : difficultyId} leaderboard`;
  ui.leaderboardBody.replaceChildren();

  if (!entries.length) {
    ui.leaderboardEmpty.hidden = false;
    ui.leaderboardTable.hidden = true;
    return;
  }

  ui.leaderboardEmpty.hidden = true;
  ui.leaderboardTable.hidden = false;

  entries.forEach((entry, position) => {
    const row = document.createElement("tr");
    for (const value of [
      String(position + 1),
      String(entry.name ?? "Anonymous"),
      String(entry.score ?? 0),
      String(entry.date ?? ""),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    ui.leaderboardBody.append(row);
  });
}

/* --- gameplay ------------------------------------------------------------ */

function availablePoints() {
  const limit = quiz.difficulty.seconds * 1000;
  const elapsed = performance.now() - quiz.questionStart;
  const remaining = Math.max(0, limit - elapsed);
  return { points: Math.round(MAX_POINTS * (remaining / limit)), remaining, limit };
}

function stopTimer() {
  if (quiz.frame) {
    cancelAnimationFrame(quiz.frame);
    quiz.frame = 0;
  }
}

function tick() {
  const { points, remaining, limit } = availablePoints();
  ui.timerBar.style.width = `${(remaining / limit) * 100}%`;
  ui.timerValue.textContent = `${(remaining / 1000).toFixed(1)}s`;
  ui.pointsValue.textContent = String(points);

  if (remaining <= 0) {
    revealAnswer(null);
    return;
  }
  quiz.frame = requestAnimationFrame(tick);
}

function currentQuestion() {
  return quiz.questions[quiz.index];
}

function renderQuestion() {
  const question = currentQuestion();
  quiz.answered = false;

  ui.progress.textContent = `Question ${quiz.index + 1} of ${quiz.questions.length}`;
  ui.scoreValue.textContent = String(quiz.score);
  ui.prompt.textContent = question.prompt;
  ui.feedback.hidden = true;
  ui.feedback.className = "quiz-feedback";
  ui.nextButton.hidden = true;
  ui.choices.replaceChildren();

  question.options.forEach((option, position) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-choice";
    button.dataset.position = String(position);

    const key = document.createElement("span");
    key.className = "quiz-choice-key";
    key.textContent = String(position + 1);
    key.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "quiz-choice-label";
    label.textContent = option;

    button.append(key, label);
    button.addEventListener("click", () => revealAnswer(position));
    item.append(button);
    ui.choices.append(item);
  });

  // Paint the full clock before the first animation frame. Without this the
  // readout keeps the previous question's final "0" and the bar stays collapsed
  // until tick() first runs, so a new question briefly shows no time left.
  ui.pointsValue.textContent = String(MAX_POINTS);
  ui.timerValue.textContent = `${quiz.difficulty.seconds.toFixed(1)}s`;
  ui.timerBar.style.width = "100%";

  quiz.questionStart = performance.now();
  stopTimer();
  quiz.frame = requestAnimationFrame(tick);

  const first = ui.choices.querySelector(".quiz-choice");
  if (first) {
    first.focus();
  }
}

function revealAnswer(position) {
  if (quiz.answered) {
    return;
  }
  quiz.answered = true;
  stopTimer();

  const question = currentQuestion();
  const { points } = availablePoints();
  const correct = position === question.answerIndex;
  const earned = correct ? points : 0;
  quiz.score += earned;

  ui.timerBar.style.width = "0%";
  ui.pointsValue.textContent = "0";
  ui.scoreValue.textContent = String(quiz.score);

  for (const button of ui.choices.querySelectorAll(".quiz-choice")) {
    const index = Number(button.dataset.position);
    button.disabled = true;
    if (index === question.answerIndex) {
      button.classList.add("is-correct");
    } else if (index === position) {
      button.classList.add("is-wrong");
    }
  }

  let headline;
  if (correct) {
    headline = `Correct — ${earned} points.`;
  } else if (position === null) {
    headline = "Time expired — 0 points.";
  } else {
    headline = "Incorrect — 0 points.";
  }

  ui.feedback.className = `quiz-feedback ${correct ? "is-correct" : "is-wrong"}`;
  ui.feedback.replaceChildren();

  const result = document.createElement("p");
  result.className = "quiz-result";
  result.textContent = `${headline} The answer is ${question.options[question.answerIndex]}.`;

  const detail = document.createElement("p");
  detail.className = "quiz-explanation";
  detail.textContent = question.explanation;

  ui.feedback.append(result, detail);
  ui.feedback.hidden = false;

  const last = quiz.index === quiz.questions.length - 1;
  ui.nextButton.textContent = last ? "See results" : "Next question";
  ui.nextButton.hidden = false;
  ui.nextButton.focus();
}

function nextQuestion() {
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index += 1;
    renderQuestion();
    return;
  }
  finishGame();
}

function finishGame() {
  stopTimer();
  const maxScore = quiz.questions.length * MAX_POINTS;
  ui.resultsScore.textContent = `${quiz.score} of ${maxScore}`;
  ui.resultsDetail.textContent =
    `${quiz.difficulty.label} — ${quiz.difficulty.seconds} seconds per question, ` +
    `${quiz.questions.length} questions.`;

  recordScore(quiz.difficulty.id, quiz.playerName, quiz.score, quiz.questions.length);
  renderLeaderboard(quiz.difficulty.id);

  showPanel(ui.results);
  ui.playAgainButton.focus();
}

function startGame() {
  quiz.playerName = ui.nameInput.value.trim().slice(0, 24);
  quiz.questions = buildQuestions(quiz.bodies);

  if (quiz.questions.length < QUESTIONS_PER_GAME) {
    ui.setupError.textContent =
      `The catalogue can only supply ${quiz.questions.length} unambiguous ` +
      `question(s) right now; ${QUESTIONS_PER_GAME} are needed for a game.`;
    ui.setupError.hidden = false;
    return;
  }

  ui.setupError.hidden = true;
  quiz.index = 0;
  quiz.score = 0;
  showPanel(ui.play);
  renderQuestion();
}

/* --- view plumbing ------------------------------------------------------- */

function showPanel(panel) {
  for (const candidate of [ui.setup, ui.play, ui.results]) {
    candidate.hidden = candidate !== panel;
  }
  // The leaderboard belongs to setup and results, not to a question in play.
  ui.leaderboard.hidden = panel === ui.play;
}

function setDifficulty(difficultyId) {
  const found = DIFFICULTIES.find((item) => item.id === difficultyId);
  if (!found) {
    return;
  }
  quiz.difficulty = found;
  for (const button of ui.difficultyButtons.querySelectorAll(".chip")) {
    const isActive = button.dataset.difficulty === difficultyId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  renderLeaderboard(difficultyId);
}

function handleKeys(event) {
  if (ui.play.hidden || quiz.answered) {
    return;
  }
  const position = Number(event.key) - 1;
  if (Number.isInteger(position) && position >= 0 && position < CHOICE_COUNT) {
    const button = ui.choices.querySelector(`.quiz-choice[data-position="${position}"]`);
    if (button) {
      event.preventDefault();
      button.click();
    }
  }
}

function cacheElements() {
  const ids = {
    view: "quiz-view",
    setup: "quiz-setup",
    play: "quiz-play",
    results: "quiz-results",
    difficultyButtons: "quiz-difficulty",
    nameInput: "quiz-name",
    startButton: "quiz-start",
    setupError: "quiz-setup-error",
    progress: "quiz-progress",
    scoreValue: "quiz-score-value",
    pointsValue: "quiz-points-value",
    timerBar: "quiz-timer-bar",
    timerValue: "quiz-timer-value",
    prompt: "quiz-prompt",
    choices: "quiz-choices",
    feedback: "quiz-feedback",
    nextButton: "quiz-next",
    resultsScore: "quiz-results-score",
    resultsDetail: "quiz-results-detail",
    playAgainButton: "quiz-play-again",
    leaderboard: "quiz-leaderboard",
    leaderboardTitle: "quiz-leaderboard-title",
    leaderboardTable: "quiz-leaderboard-table",
    leaderboardBody: "quiz-leaderboard-body",
    leaderboardEmpty: "quiz-leaderboard-empty",
  };
  for (const [key, id] of Object.entries(ids)) {
    ui[key] = document.getElementById(id);
  }
}

function attachQuizHandlers() {
  ui.difficultyButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".chip");
    if (button) {
      setDifficulty(button.dataset.difficulty);
    }
  });

  ui.startButton.addEventListener("click", startGame);
  ui.nextButton.addEventListener("click", nextQuestion);
  ui.playAgainButton.addEventListener("click", () => {
    showPanel(ui.setup);
    ui.nameInput.focus();
  });
  document.addEventListener("keydown", handleKeys);
}

/* app.js hands the catalogue over once it has loaded, so the quiz never fetches
   anything of its own and gameplay makes no network request at all. */
document.addEventListener("unimap:data", (event) => {
  quiz.bodies = Array.isArray(event.detail) ? event.detail : [];
});

/* Leaving the quiz must stop the running timer, or it keeps counting down (and
   can auto-reveal an answer) while the browse view is on screen. */
document.addEventListener("unimap:mode", (event) => {
  if (event.detail !== "quiz") {
    stopTimer();
  }
});

cacheElements();
attachQuizHandlers();
setDifficulty(DIFFICULTIES[0].id);
showPanel(ui.setup);
