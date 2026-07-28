/* UniMap — quiz mode.

   Questions are generated only from structured catalogue fields that are
   actually present on a record. Nothing is fetched during gameplay: the
   catalogue is handed over once, already loaded, by app.js.

   Two rules govern everything below.

   1. A question family exists only where the catalogue can answer it. Each
      family declares an eligibility predicate, and a family that cannot produce
      four distinct choices with exactly one defensible answer produces nothing
      at all rather than producing something ambiguous.

   2. Difficulty changes the questions, not only the clock. Each difficulty has
      an ordered ladder of families; if its preferred families cannot fill a
      game, it falls back down the ladder while keeping its own timer. */

const DIFFICULTIES = [
  { id: "effortless", label: "Effortless", seconds: 20 },
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
const STORAGE_VERSION = 1;
const EXPORT_KIND = "unimap.leaderboards";

/* Types that overlap in ordinary usage. A pulsar IS a neutron star and an
   exoplanet IS a planet, so pairing them would produce a question with two
   defensible answers. They are never used as distractors for one another. */
const CONFLICTING_TYPES = {
  "Neutron Star": ["Pulsar"],
  Pulsar: ["Neutron Star"],
  Planet: ["Exoplanet"],
  Exoplanet: ["Planet"],
};

/* A name that is a bare catalogue designation — "M 74", "NGC 1300",
   "PSR B0531+21" — is not a common name. Effortless prefers common names, so it
   draws only from well-known records whose name is not one of these. The same
   rule is implemented in tools/derive_quiz_fields.py, which sets `wellKnown`. */
const CATALOGUE_DESIGNATION =
  /^(?:M|NGC|IC|UGCA|PSR|SGR|RX|KOI|HD|HIP|GJ|Gl|TOI|K2|EPIC|3C|4U|GRO|GRS|GS|XTE)[\s-]?[\dBJ]/i;

/* SIMBAD writes an object's own catalogue designation as an alias, often as a
   lightly decorated form of the name UniMap displays ("* 51 Peg" for "51 Peg").
   Those are useless as questions — the answer is visible in the prompt — so an
   alias only counts when it is genuinely different from the name. */
const ALIAS_DECORATION = /^(?:NAME|V\*|Cl\*|\*\*|\*)\s+/;

/* The name a player sees while browsing. A question must ask about the same
   name the catalogue shows, or a player who just read "Helvetios" is asked
   about "51 Peg" and cannot connect the two. `name` remains the formal
   designation in the data; only what is asked and answered changes. */
function quizName(body) {
  const common = typeof body?.commonName === "string" ? body.commonName.trim() : "";
  return common || (typeof body?.name === "string" ? body.name.trim() : "");
}
const quiz = {
  bodies: [],
  difficulty: DIFFICULTIES[0],
  playerName: "",
  questions: [],
  index: 0,
  score: 0,
  answered: false,
  questionStart: 0,
  gameStart: 0,
  frame: 0,
};

/* Written by buildQuestions on every game and read by tools/quiz_checks.mjs.
   It is diagnostic only — no gameplay reads it — and it is what makes fallback
   usage observable instead of silent. */
const diagnostics = {
  difficulty: null,
  families: {},
  tiersUsed: 0,
  tiersAvailable: 0,
  fellBack: false,
  requested: QUESTIONS_PER_GAME,
  produced: 0,
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

/* Compare two display strings the way a player would: an option that differs
   only in decoration or capitalisation is not a distinct choice. */
function comparable(value) {
  return text(value).replace(ALIAS_DECORATION, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function coordinateLabel(body) {
  return `RA ${text(body.rightAscension)}°, Dec ${text(body.declination)}°`;
}

function hasCoordinates(body) {
  return Boolean(text(body.rightAscension) && text(body.declination));
}

/* --- explanations -------------------------------------------------------- */

/* A short factual explanation assembled only from fields the record carries,
   led by the fact the question actually turned on. Unrelated measurements are
   left out: the point is to explain this answer, not to dump the record.

   Distance is stated as a labelled value rather than "from Earth", because the
   quantity differs by type — light years for deep-sky objects, mean orbital
   distance in AU for dwarf planets. */
function explain(body, leading) {
  const parts = [];
  for (const sentence of leading || []) {
    if (text(sentence)) {
      parts.push(text(sentence));
    }
  }
  if (!parts.length) {
    parts.push(`${quizName(body)} is catalogued as a ${body.type}.`);
  }
  if (text(body.sourceName)) {
    parts.push(`Source: ${text(body.sourceName)}.`);
  }
  return parts.join(" ");
}

/* --- question construction ----------------------------------------------- */

/* Reject a question the player can answer without knowing anything.

   Astronomical naming makes this a real hazard rather than a theoretical one,
   in two directions:

   (a) the prompt already contains the answer — "What kind of object is the
       Sombrero Galaxy?" answered by "Galaxy";
   (b) the answer contains the thing the prompt asked about, and the distractors
       do not — "Which star does Kepler-1176 b orbit?" answered by "Kepler-1176",
       or "Which object is also catalogued as 136472 Makemake (2005 FY9)?"
       answered by "Makemake".

   `subject` is whatever the prompt names: the object, the host, the alias, the
   coordinate pair. Comparison ignores case and punctuation, so "Kepler-1176 b"
   is recognised as carrying "Kepler-1176". */
function isGiveaway(prompt, answer, subject, distractors) {
  const promptKey = comparable(prompt);
  const answerKey = comparable(answer);
  if (answerKey && promptKey.includes(answerKey)) {
    return true;
  }
  const subjectKey = comparable(subject);
  if (!subjectKey || !answerKey.includes(subjectKey)) {
    return false;
  }
  // If every choice carries the subject, it distinguishes nothing and the
  // question is still fair.
  return !distractors.every((option) => comparable(option).includes(subjectKey));
}

/* Build a question, or return null if the choices cannot be made both distinct
   and unambiguous. Every rejection here is a family declining to ask rather
   than asking badly. */
function makeQuestion({ prompt, correct, distractors, body, family, explanation, subject }) {
  const answer = text(correct);
  if (!answer) {
    return null;
  }

  const seen = new Set([comparable(answer)]);
  const chosen = [];
  for (const candidate of distractors) {
    const value = text(candidate);
    if (!value) continue;
    const key = comparable(value);
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(value);
    if (chosen.length === CHOICE_COUNT - 1) break;
  }
  if (chosen.length < CHOICE_COUNT - 1) {
    return null;
  }
  if (isGiveaway(prompt, answer, subject, chosen)) {
    return null;
  }

  const options = shuffle([answer, ...chosen]);
  return {
    prompt,
    options,
    answerIndex: options.indexOf(answer),
    explanation,
    subjectId: body.id,
    family,
  };
}

/* Distractor objects for a question whose answer is an object name. `tight`
   restricts them to the subject's own type, which is what makes Hard and
   Impossible harder: the four names are then all the same kind of object. */
function distractorBodies(subject, pool, tight) {
  const candidates = pool.filter((other) => other.id !== subject.id);
  if (tight) {
    const sameType = candidates.filter((other) => other.type === subject.type);
    if (sameType.length >= CHOICE_COUNT - 1) {
      return shuffle(sameType);
    }
  }
  return shuffle(candidates.filter((other) => !conflicts(subject.type, other.type)));
}

/* --- question families ---------------------------------------------------

   Every family takes (records, context) and returns whatever it can generate.
   `records` is the subject pool for this difficulty tier; `context` carries the
   whole catalogue, because distractors may legitimately come from records that
   are not themselves eligible subjects. */

/* "What kind of object is X?" — type is a required field, so every record is
   eligible. The distractor types must not conflict with the answer. */
function typeQuestions(records, context) {
  const questions = [];
  for (const body of records) {
    const others = context.types.filter((type) => !conflicts(body.type, type));
    const question = makeQuestion({
      prompt: `What kind of object is ${quizName(body)}?`,
      correct: body.type,
      distractors: shuffle(others),
      body,
      family: "type",
      subject: quizName(body),
      explanation: explain(body, [`${quizName(body)} is catalogued as a ${body.type}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* "Which of these is a <type>?" — the choices are object names, so every
   distractor must be of a type that cannot also be a correct answer. */
function membershipQuestions(records, context) {
  const questions = [];
  for (const body of records) {
    const outsiders = context.all.filter((other) => !conflicts(body.type, other.type));
    const question = makeQuestion({
      prompt: `Which of these is a ${body.type}?`,
      correct: quizName(body),
      distractors: shuffle(outsiders).map((other) => quizName(other)),
      body,
      family: "membership",
      subject: body.type,
      explanation: explain(body, [`${quizName(body)} is catalogued as a ${body.type}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* Value questions compare a field only against the SAME field on objects of the
   SAME type. Distance in particular is not one quantity across the catalogue —
   light years for a galaxy, mean orbital distance in AU for a dwarf planet — so
   mixing types would produce answers that are not comparable. */
function valueQuestions(records, context, field, prompt, label) {
  const questions = [];
  for (const [type, members] of byType(records)) {
    const peers = (context.groups.get(type) || []).filter((body) => text(body[field]));
    const distinct = [...new Set(peers.map((body) => text(body[field])))];
    if (distinct.length < CHOICE_COUNT) {
      continue;
    }
    for (const body of members) {
      const value = text(body[field]);
      if (!value) continue;
      const question = makeQuestion({
        prompt: prompt(body),
        correct: value,
        distractors: shuffle(distinct.filter((candidate) => candidate !== value)),
        body,
        family: field,
        subject: quizName(body),
        explanation: explain(body, [`${label} of ${quizName(body)}: ${value}.`]),
      });
      if (question) questions.push(question);
    }
  }
  return questions;
}

/* SIMBAD's own gloss for what an object is. It lives in `classification` since
   P5; before that it was only reachable on the 66 records that happened to
   carry it as their measurement, because a star's measurement slot holds a
   parallax instead. Reading the field doubles the eligible pool to 132. The
   measurement is still accepted as a fallback so an older catalogue still
   works. */
function classificationOf(body) {
  const field = text(body.classification);
  if (field) {
    return field;
  }
  return text(body.measurementLabel) === "SIMBAD classification"
    ? text(body.measurementValue)
    : "";
}

/* "How is X classified in SIMBAD?" — the source's own classification gloss.
   Only this direction is safe. The reverse ("which object is a planetary
   nebula?") has nine correct answers in this catalogue, so it is not
   implemented. */
function classificationQuestions(records, context) {
  const distinct = [...new Set(context.classifications.map(classificationOf))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of records) {
    const value = classificationOf(body);
    if (!value) continue;
    const question = makeQuestion({
      prompt: `How is ${quizName(body)} classified in SIMBAD?`,
      correct: value,
      distractors: shuffle(distinct.filter((candidate) => candidate !== value)),
      body,
      family: "classification",
      subject: quizName(body),
      explanation: explain(body, [`SIMBAD classifies ${quizName(body)} as ${value}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* "What catalogue designation does X carry?" — pairs the recognisable name a
   player sees with the formal identifier the source uses.

   This became possible in P5: before `commonName`, a record had one name and
   there was nothing to pair it with. It is asked in one direction only. The
   reverse ("which object is 51 Peg?") would put the designation in the prompt
   and, for the many objects whose common name shares a word with it, hand over
   the answer.

   Six of the 91 named records pair names that share a word — Sirius/Sirius A,
   Crab/Crab Nebula — and `isGiveaway` discards each one rather than a rule
   here needing to enumerate them. */
function designationOfObjectQuestions(records, context) {
  const distinct = [...new Set(context.named.map((body) => text(body.name)))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of records) {
    const common = text(body.commonName);
    const formal = text(body.name);
    if (!common || !formal) continue;
    const question = makeQuestion({
      prompt: `Which catalogue designation belongs to ${common}?`,
      correct: formal,
      distractors: shuffle(distinct.filter((candidate) => candidate !== formal)),
      body,
      family: "designationOfObject",
      subject: common,
      explanation: explain(body, [`${common} is catalogued as ${formal}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* "In what year was X discovered?" — `discoveryYear` is a structured field on
   every record the NASA Exoplanet Archive supplied. */
function discoveryYearQuestions(records, context) {
  const distinct = [...new Set(context.discovered.map((body) => text(body.discoveryYear)))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of records) {
    const year = text(body.discoveryYear);
    if (!year) continue;
    const method = text(body.discoveryMethod);
    const host = text(body.hostName);
    const question = makeQuestion({
      prompt: `In what year was ${quizName(body)} discovered?`,
      correct: year,
      distractors: shuffle(distinct.filter((candidate) => candidate !== year)),
      body,
      family: "discoveryYear",
      subject: quizName(body),
      // The host and the method are the context that makes the year mean
      // something. Both come from the same fetched row as the year itself, and
      // each is stated only when the record actually carries it.
      explanation: explain(body, [
        `${quizName(body)} was discovered in ${year}` +
          (method ? ` using the ${method} method.` : "."),
        host ? `It orbits the host star ${host}.` : "",
      ]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* REJECTED FAMILY — "Which star does X orbit?" and "Which exoplanet orbits X?"

   Both directions were implemented and both were withdrawn. The NASA Exoplanet
   Archive names a planet after its host: KOI-1599.02 orbits KOI-1599,
   Kepler-1176 b orbits Kepler-1176. All 60 catalogued exoplanets follow that
   convention, so the prompt always spells out its own answer and a player who
   has never heard of either object still scores. `isGiveaway` catches every
   instance, which is the same thing as saying the catalogue cannot support the
   family. `hostName` is still stored and still used, below, to give discovery
   answers their system context. */

/* "What spectral type is X?" — SIMBAD's `sp_type`, stored as a field. */
function spectralOfStarQuestions(records, context) {
  const distinct = [...new Set(context.spectral.map((body) => text(body.spectralType)))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of records) {
    const spectral = text(body.spectralType);
    if (!spectral) continue;
    const question = makeQuestion({
      prompt: `What spectral type does SIMBAD give for ${quizName(body)}?`,
      correct: spectral,
      distractors: shuffle(distinct.filter((candidate) => candidate !== spectral)),
      body,
      family: "spectralOfStar",
      subject: quizName(body),
      explanation: explain(body, [`SIMBAD gives ${quizName(body)} the spectral type ${spectral}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* "Which star has spectral type X?" — only where exactly one record carries
   that exact spectral type, so the answer is unique. */
function starOfSpectralQuestions(records, context, tight) {
  const questions = [];
  for (const body of records) {
    const spectral = text(body.spectralType);
    if (!spectral) continue;
    if ((context.spectralCounts.get(spectral) || 0) !== 1) continue;
    const others = distractorBodies(body, context.spectral, tight);
    const question = makeQuestion({
      prompt: `Which of these stars has the spectral type ${spectral}?`,
      correct: quizName(body),
      distractors: others.map((other) => quizName(other)),
      body,
      family: "starOfSpectral",
      subject: spectral,
      explanation: explain(body, [`${quizName(body)} is the star SIMBAD types ${spectral}.`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* REJECTED FAMILY — "Which designation belongs to X?" and its reverse.

   Once the decorated spellings of an object's own name are discarded ("* 51 Peg"
   for 51 Peg), the only informative aliases left in this catalogue are the five
   minor-planet designations, and every one of them embeds the object's name:
   "136472 Makemake (2005 FY9)", "134340 Pluto (1930 BM)". Either direction hands
   the answer to the player. Five eligible records could not carry a difficulty
   tier in any case. The family becomes available when the catalogue gains
   aliases that are genuinely different words from the name. */

/* "Which coordinates belong to X?" — right ascension and declination are stored
   as a pair and are unique across the catalogue. */
function coordinatesOfObjectQuestions(records, context) {
  const distinct = [...new Set(context.located.map(coordinateLabel))];
  if (distinct.length < CHOICE_COUNT) {
    return [];
  }
  const questions = [];
  for (const body of records) {
    if (!hasCoordinates(body)) continue;
    const label = coordinateLabel(body);
    const question = makeQuestion({
      prompt: `Which coordinates does the catalogue give for ${quizName(body)}?`,
      correct: label,
      distractors: shuffle(distinct.filter((candidate) => candidate !== label)),
      body,
      family: "coordinatesOfObject",
      subject: quizName(body),
      explanation: explain(body, [`${quizName(body)} lies at ${label} (J2000).`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* "Which object lies at these coordinates?" — the reverse direction. */
function objectAtCoordinatesQuestions(records, context, tight) {
  const questions = [];
  for (const body of records) {
    if (!hasCoordinates(body)) continue;
    const label = coordinateLabel(body);
    const others = distractorBodies(body, context.located, tight);
    const question = makeQuestion({
      prompt: `Which object lies at ${label} (J2000)?`,
      correct: quizName(body),
      distractors: others.map((other) => quizName(other)),
      body,
      family: "objectAtCoordinates",
      subject: label,
      explanation: explain(body, [`${quizName(body)} is catalogued at ${label} (J2000).`]),
    });
    if (question) questions.push(question);
  }
  return questions;
}

/* --- difficulty tiers -----------------------------------------------------

   Each difficulty is an ordered list of tiers. A tier names its subject pool
   and its families. Tiers are consumed in order until the game is full, so a
   difficulty degrades into simpler content rather than into a shorter game —
   and the timer never changes when it does. */

function wellKnownPool(bodies) {
  return bodies.filter((body) => body.wellKnown === true);
}

/* Effortless: well-known objects that also have a common name, so the prompt
   reads "Betelgeuse" rather than "NGC 1300". The test is on the *displayed*
   name, so a record whose designation now carries a sourced common name — "M 1"
   showing as "Crab" — qualifies where it previously could not. */
function effortlessPool(bodies) {
  return wellKnownPool(bodies).filter((body) => !CATALOGUE_DESIGNATION.test(quizName(body)));
}

const BASIC_FAMILIES = [typeQuestions, membershipQuestions];

const DISTANCE_FAMILY = (records, context) =>
  valueQuestions(records, context, "distance", (body) => `How far away is ${quizName(body)}?`,
    "Catalogued distance");

const SIZE_FAMILY = (records, context) =>
  valueQuestions(records, context, "size", (body) => `How large is ${quizName(body)}?`,
    "Catalogued size");

const TIERS = {
  /* No discovery facts, no coordinates, no aliases, no close measurements —
     only identity and type, on objects a visitor is likely to recognise. */
  effortless: [
    { pool: effortlessPool, families: BASIC_FAMILIES },
    { pool: wellKnownPool, families: BASIC_FAMILIES },
    // A catalogue with no well-known records at all would otherwise leave
    // Effortless with an empty pool and no game. The content rules still hold:
    // this tier is identity and type only, never discovery or coordinates.
    { pool: (bodies) => bodies, families: BASIC_FAMILIES },
  ],
  /* Easy stays on recognisable objects but adds the two direct measurements, so
     it is not merely Effortless with a shorter clock. */
  easy: [
    {
      pool: wellKnownPool,
      families: [...BASIC_FAMILIES, DISTANCE_FAMILY, SIZE_FAMILY],
    },
    { pool: (bodies) => bodies, families: [...BASIC_FAMILIES, DISTANCE_FAMILY, SIZE_FAMILY] },
  ],
  /* Medium opens the whole catalogue and leads with the source's own
     classification rather than with identity. */
  medium: [
    {
      pool: (bodies) => bodies,
      families: [classificationQuestions, DISTANCE_FAMILY, SIZE_FAMILY,
        designationOfObjectQuestions],
    },
    { pool: (bodies) => bodies, families: BASIC_FAMILIES },
  ],
  /* Hard trades identity for provenance: when an object was found, how the
     source types it, what spectral class it carries. */
  hard: [
    {
      pool: (bodies) => bodies,
      families: [discoveryYearQuestions, spectralOfStarQuestions, classificationQuestions,
        designationOfObjectQuestions],
    },
    { pool: (bodies) => bodies, families: [DISTANCE_FAMILY, SIZE_FAMILY] },
    { pool: (bodies) => bodies, families: BASIC_FAMILIES },
  ],
  /* Impossible asks for the values that identify one record and no other: an
     exact spectral type, an exact coordinate pair — with the object choices all
     drawn from one category. Every question still has exactly one correct
     answer; none of them is a trick. */
  impossible: [
    {
      pool: (bodies) => bodies,
      families: [
        (records, context) => starOfSpectralQuestions(records, context, true),
        coordinatesOfObjectQuestions,
        (records, context) => objectAtCoordinatesQuestions(records, context, true),
      ],
    },
    {
      pool: (bodies) => bodies,
      families: [discoveryYearQuestions, spectralOfStarQuestions],
    },
    { pool: (bodies) => bodies, families: BASIC_FAMILIES },
  ],
};

/* Precompute the catalogue-wide facts every family needs, once per game. */
function buildContext(bodies) {
  const spectral = bodies.filter((body) => text(body.spectralType));

  const spectralCounts = new Map();
  for (const body of spectral) {
    const value = text(body.spectralType);
    spectralCounts.set(value, (spectralCounts.get(value) || 0) + 1);
  }

  return {
    all: bodies,
    groups: byType(bodies),
    types: [...byType(bodies).keys()],
    classifications: bodies.filter((body) => classificationOf(body)),
    named: bodies.filter((body) => text(body.commonName) && text(body.name)),
    discovered: bodies.filter((body) => text(body.discoveryYear)),
    spectral,
    spectralCounts,
    located: bodies.filter(hasCoordinates),
  };
}

/* Choose a game's worth of questions for a difficulty.

   One question per subject object, so a single record cannot supply both a
   question and the answer to a later one, and no prompt is ever repeated. */
function buildQuestions(bodies, difficultyId) {
  const context = buildContext(bodies);
  const tiers = TIERS[difficultyId] || TIERS.medium;

  const chosen = [];
  const usedSubjects = new Set();
  const usedPrompts = new Set();
  const families = {};
  let tiersUsed = 0;

  for (const tier of tiers) {
    if (chosen.length >= QUESTIONS_PER_GAME) {
      break;
    }
    tiersUsed += 1;

    const records = shuffle(tier.pool(bodies));
    const candidates = [];
    for (const family of tier.families) {
      candidates.push(...family(records, context));
    }

    for (const question of shuffle(candidates)) {
      if (chosen.length >= QUESTIONS_PER_GAME) break;
      if (usedSubjects.has(question.subjectId)) continue;
      if (usedPrompts.has(question.prompt)) continue;
      usedSubjects.add(question.subjectId);
      usedPrompts.add(question.prompt);
      families[question.family] = (families[question.family] || 0) + 1;
      chosen.push(question);
    }
  }

  diagnostics.difficulty = difficultyId;
  diagnostics.families = families;
  diagnostics.tiersUsed = tiersUsed;
  diagnostics.tiersAvailable = tiers.length;
  diagnostics.fellBack = tiersUsed > 1;
  diagnostics.produced = chosen.length;

  return chosen;
}

/* --- leaderboard storage -------------------------------------------------

   Stored shape, one key per difficulty:

     { "version": 1, "entries": [ { name, score, difficulty, questions,
       maximumScore, date, completedAt, durationMs } ] }

   Before this there was no envelope at all — the value was a bare array, and a
   corrupt value was indistinguishable from an empty one. Reading now migrates
   the legacy shape in place, and quarantines anything unreadable under a
   `.corrupt` key instead of destroying it, so a player who lost scores to a bad
   write still has the original bytes to hand to a maintainer. */

function leaderboardKey(difficultyId) {
  return `${STORAGE_PREFIX}${difficultyId}`;
}

function storage() {
  try {
    return window.localStorage;
  } catch (error) {
    // Storage can be unavailable entirely (private browsing, disabled cookies).
    // The game must still be playable, so this means "no scores", not a crash.
    console.warn("UniMap cannot reach local storage:", error);
    return null;
  }
}

/* Coerce one stored entry into the current shape, or return null.

   `score` and `questions` are the only fields gameplay depends on; everything
   else is descriptive and is defaulted rather than causing a whole leaderboard
   to be discarded over one missing timestamp. */
function normaliseEntry(entry, difficultyId) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const score = Number(entry.score);
  if (!Number.isFinite(score) || score < 0) {
    return null;
  }
  const questions = Number(entry.questions);
  const questionCount = Number.isFinite(questions) && questions > 0
    ? Math.round(questions)
    : QUESTIONS_PER_GAME;
  const maximum = Number(entry.maximumScore);

  return {
    name: text(entry.name) || "Anonymous",
    score: Math.round(score),
    difficulty: text(entry.difficulty) || difficultyId,
    questions: questionCount,
    maximumScore: Number.isFinite(maximum) && maximum > 0
      ? Math.round(maximum)
      : questionCount * MAX_POINTS,
    date: text(entry.date) || text(entry.completedAt).slice(0, 10),
    completedAt: text(entry.completedAt),
    durationMs: Number.isFinite(Number(entry.durationMs)) && Number(entry.durationMs) >= 0
      ? Math.round(Number(entry.durationMs))
      : null,
  };
}

function sortEntries(entries) {
  return entries
    .slice()
    .sort((a, b) => b.score - a.score || String(a.completedAt).localeCompare(String(b.completedAt)));
}

function quarantine(key, raw) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(`${key}.corrupt`, raw);
    store.removeItem(key);
  } catch (error) {
    console.warn("UniMap could not quarantine the unreadable leaderboard:", error);
  }
}

/* Returns { entries, recovered, migrated }. `recovered` is true when stored
   data had to be quarantined, so the interface can say so out loud. */
function readLeaderboard(difficultyId) {
  const store = storage();
  if (!store) {
    return { entries: [], recovered: false, migrated: false };
  }

  const key = leaderboardKey(difficultyId);
  let raw;
  try {
    raw = store.getItem(key);
  } catch (error) {
    console.warn("UniMap could not read the leaderboard:", error);
    return { entries: [], recovered: false, migrated: false };
  }
  if (!raw) {
    return { entries: [], recovered: false, migrated: false };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("UniMap found unreadable leaderboard data and set it aside:", error);
    quarantine(key, raw);
    return { entries: [], recovered: true, migrated: false };
  }

  // A bare array is the pre-version-1 shape.
  let stored;
  let migrated = false;
  if (Array.isArray(parsed)) {
    stored = parsed;
    migrated = true;
  } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.entries)) {
    stored = parsed.entries;
    migrated = Number(parsed.version) !== STORAGE_VERSION;
  } else {
    console.warn("UniMap found leaderboard data in an unknown shape and set it aside.");
    quarantine(key, raw);
    return { entries: [], recovered: true, migrated: false };
  }

  const entries = [];
  let dropped = 0;
  for (const item of stored) {
    const entry = normaliseEntry(item, difficultyId);
    if (entry) {
      entries.push(entry);
    } else {
      dropped += 1;
    }
  }

  const sorted = sortEntries(entries).slice(0, LEADERBOARD_SIZE);
  if (migrated || dropped) {
    writeLeaderboard(difficultyId, sorted);
  }
  return { entries: sorted, recovered: dropped > 0, migrated };
}

function writeLeaderboard(difficultyId, entries) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(
      leaderboardKey(difficultyId),
      JSON.stringify({ version: STORAGE_VERSION, entries }),
    );
    return true;
  } catch (error) {
    console.warn("UniMap could not save the leaderboard:", error);
    return false;
  }
}

function recordScore(difficultyId, name, score, questionCount, durationMs) {
  const now = new Date();
  const entry = normaliseEntry(
    {
      name,
      score,
      difficulty: difficultyId,
      questions: questionCount,
      maximumScore: questionCount * MAX_POINTS,
      date: now.toISOString().slice(0, 10),
      completedAt: now.toISOString(),
      durationMs,
    },
    difficultyId,
  );
  const { entries } = readLeaderboard(difficultyId);
  const top = sortEntries([...entries, entry]).slice(0, LEADERBOARD_SIZE);
  writeLeaderboard(difficultyId, top);
  return top;
}

/* --- backup -------------------------------------------------------------- */

function exportBundle() {
  const leaderboards = {};
  for (const difficulty of DIFFICULTIES) {
    leaderboards[difficulty.id] = {
      version: STORAGE_VERSION,
      entries: readLeaderboard(difficulty.id).entries,
    };
  }
  return {
    kind: EXPORT_KIND,
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    leaderboards,
  };
}

/* Merge rather than replace: importing a backup from another browser should add
   that device's scores to this one, not silently delete what is already here.
   An entry is the same entry when its name, score and completion time all
   match, which is what stops a repeated import from duplicating rows. */
function importBundle(bundle) {
  if (!bundle || typeof bundle !== "object" || bundle.kind !== EXPORT_KIND) {
    throw new Error("That file is not a UniMap leaderboard backup.");
  }
  const leaderboards = bundle.leaderboards;
  if (!leaderboards || typeof leaderboards !== "object") {
    throw new Error("That backup contains no leaderboards.");
  }

  let added = 0;
  for (const difficulty of DIFFICULTIES) {
    const incoming = leaderboards[difficulty.id];
    const list = Array.isArray(incoming) ? incoming : incoming && incoming.entries;
    if (!Array.isArray(list)) continue;

    const { entries } = readLeaderboard(difficulty.id);
    const seen = new Set(entries.map((entry) => `${entry.name}|${entry.score}|${entry.completedAt}`));
    const merged = entries.slice();

    for (const item of list) {
      const entry = normaliseEntry(item, difficulty.id);
      if (!entry) continue;
      const key = `${entry.name}|${entry.score}|${entry.completedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
      added += 1;
    }
    writeLeaderboard(difficulty.id, sortEntries(merged).slice(0, LEADERBOARD_SIZE));
  }
  return added;
}

function clearLeaderboard(difficultyId) {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(leaderboardKey(difficultyId));
  } catch (error) {
    console.warn("UniMap could not clear the leaderboard:", error);
  }
}

/* --- leaderboard view ---------------------------------------------------- */

function setBackupStatus(message, isError) {
  ui.backupStatus.textContent = message;
  ui.backupStatus.classList.toggle("is-error", Boolean(isError));
  ui.backupStatus.hidden = !message;
}

function renderLeaderboard(difficultyId) {
  const { entries, recovered } = readLeaderboard(difficultyId);
  const difficulty = DIFFICULTIES.find((item) => item.id === difficultyId);
  ui.leaderboardTitle.textContent = `${difficulty ? difficulty.label : difficultyId} leaderboard`;
  ui.leaderboardBody.replaceChildren();
  ui.leaderboardRecovered.hidden = !recovered;

  if (!entries.length) {
    ui.leaderboardEmpty.hidden = false;
    ui.leaderboardTable.hidden = true;
    ui.clearButton.disabled = true;
    return;
  }

  ui.leaderboardEmpty.hidden = true;
  ui.leaderboardTable.hidden = false;
  ui.clearButton.disabled = false;

  entries.forEach((entry, position) => {
    const row = document.createElement("tr");
    for (const value of [
      String(position + 1),
      entry.name,
      `${entry.score} / ${entry.maximumScore}`,
      entry.date,
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
  const durationMs = Math.max(0, Math.round(performance.now() - quiz.gameStart));

  ui.resultsScore.textContent = `${quiz.score} of ${maxScore}`;
  ui.resultsDetail.textContent =
    `${quiz.difficulty.label} — ${quiz.difficulty.seconds} seconds per question, ` +
    `${quiz.questions.length} questions, finished in ${(durationMs / 1000).toFixed(1)}s.`;

  recordScore(
    quiz.difficulty.id,
    quiz.playerName,
    quiz.score,
    quiz.questions.length,
    durationMs,
  );
  renderLeaderboard(quiz.difficulty.id);

  showPanel(ui.results);
  ui.playAgainButton.focus();
}

function startGame() {
  quiz.playerName = ui.nameInput.value.trim().slice(0, 24);
  quiz.questions = buildQuestions(quiz.bodies, quiz.difficulty.id);

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
  quiz.gameStart = performance.now();
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
  setBackupStatus("", false);
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

function downloadBackup() {
  const bundle = exportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `unimap-leaderboards-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers, so let the
  // click be dispatched first.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  const total = Object.values(bundle.leaderboards).reduce(
    (count, board) => count + board.entries.length,
    0,
  );
  setBackupStatus(`Exported ${total} score(s) across all five modes.`, false);
}

async function uploadBackup(file) {
  if (!file) return;
  try {
    const added = importBundle(JSON.parse(await file.text()));
    renderLeaderboard(quiz.difficulty.id);
    setBackupStatus(
      added
        ? `Imported ${added} new score(s); existing scores were kept.`
        : "That backup added no new scores — they were already on this device.",
      false,
    );
  } catch (error) {
    setBackupStatus(error instanceof SyntaxError
      ? "That file is not valid JSON."
      : error.message, true);
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
    leaderboardRecovered: "quiz-leaderboard-recovered",
    exportButton: "quiz-export",
    importButton: "quiz-import",
    importInput: "quiz-import-file",
    clearButton: "quiz-clear",
    backupStatus: "quiz-backup-status",
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

  ui.exportButton.addEventListener("click", downloadBackup);
  ui.importButton.addEventListener("click", () => ui.importInput.click());
  ui.importInput.addEventListener("change", () => {
    uploadBackup(ui.importInput.files && ui.importInput.files[0]);
    // Clear the input so re-choosing the same file fires `change` again.
    ui.importInput.value = "";
  });
  ui.clearButton.addEventListener("click", () => {
    const label = DIFFICULTIES.find((item) => item.id === quiz.difficulty.id).label;
    if (!window.confirm(`Delete every ${label} score stored on this device?`)) {
      return;
    }
    clearLeaderboard(quiz.difficulty.id);
    renderLeaderboard(quiz.difficulty.id);
    setBackupStatus(`Cleared the ${label} leaderboard on this device.`, false);
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

/* Maintainer checks (tools/quiz_checks.mjs) drive question generation directly
   so they can assert eligibility and fallback behaviour without playing 10
   games per difficulty. Nothing in the application reads this. */
window.unimapQuiz = {
  DIFFICULTIES,
  QUESTIONS_PER_GAME,
  buildQuestions,
  buildContext,
  effortlessPool,
  wellKnownPool,
  quizName,
  classificationOf,
  designationOfObjectQuestions,
  diagnostics,
  readLeaderboard,
  writeLeaderboard,
  exportBundle,
  importBundle,
  leaderboardKey,
  STORAGE_VERSION,
};
