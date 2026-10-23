// k6 load test of the game's critical paths, against a local API or the staging one (never the
// production one without the owner's explicit consent). Procedure and results: docs/rnd/charge.md.
//
//   infra/load/run.sh                                        # every scenario, local API
//   BASE_URL=https://… SCENARIOS=open RATE=50 infra/load/run.sh
//
// Players come from `pnpm load:players` (players.json): members with a started collection and a
// full reserve, so that each one opens 16 boosters before its stock runs out.
//
//   open        a member opens a booster                 budget: 150 ms at the 95th percentile
//   answer      a member asks for a challenge session, then answers each question
//   collection  a member opens the album: every page of their cards, then their mastery
//   arrival     a guest arrives from a stream link and opens its two boosters
import { check } from "k6";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const ORIGIN = __ENV.ORIGIN || "http://localhost:3000";
/** Iterations per second of each scenario at its peak. */
const RATE = Number(__ENV.RATE || 10);
const HOLD = __ENV.HOLD || "1m";
const SELECTED = (__ENV.SCENARIOS || "open,answer,collection").split(",");

const data = JSON.parse(open(__ENV.PLAYERS || "./players.json"));
const players = new SharedArray("players", () => data.players);
const STARTER = data.starterCollection;

function arrivalRate(exec, rate) {
  return {
    executor: "ramping-arrival-rate",
    exec,
    startRate: 1,
    timeUnit: "1s",
    preAllocatedVUs: Math.max(10, rate * 2),
    maxVUs: Math.max(50, rate * 10),
    stages: [
      { duration: "20s", target: rate },
      { duration: HOLD, target: rate },
      { duration: "10s", target: 0 },
    ],
  };
}

const ALL = {
  open: arrivalRate("openBooster", RATE),
  answer: arrivalRate("answerChallenges", RATE),
  collection: arrivalRate("readCollection", RATE),
  arrival: arrivalRate("guestArrival", Math.max(1, Math.round(RATE / 5))),
};

export const options = {
  scenarios: Object.fromEntries(SELECTED.map((name) => [name, ALL[name]])),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{name:open}": ["p(95)<150"],
    "http_req_duration{name:guest-open}": ["p(95)<150"],
    "http_req_duration{name:challenges}": ["p(95)<300"],
    "http_req_duration{name:answer}": ["p(95)<300"],
    "http_req_duration{name:cards}": ["p(95)<300"],
    "http_req_duration{name:mastery}": ["p(95)<300"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// An empty stock (409) is an expected answer, not a failure: it is counted by its own check.
http.setResponseCallback(http.expectedStatuses(200, 409));

/** RFC 4122 version 4 UUID; Math.random is enough for test idempotency keys. */
function uuidV4() {
  const hex = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Players taken in turn: two iterations rarely lock the same wallet at once. */
function nextPlayer() {
  return players[exec.scenario.iterationInTest % players.length];
}

/** This VU's cookie jar of each player, as a browser keeps it between two requests. */
const jars = new Map();

/**
 * A member's request with the player's own jar: Better Auth's signed session cookie, refreshed
 * by the responses, spares most requests the session lookup, as in a browser.
 */
function asPlayer(player, name, extra = {}) {
  let jar = jars.get(player.userId);
  if (jar === undefined) {
    jar = new http.CookieJar();
    for (const pair of player.cookie.split("; ")) {
      const separator = pair.indexOf("=");
      jar.set(BASE_URL, pair.slice(0, separator), pair.slice(separator + 1));
    }
    jars.set(player.userId, jar);
  }
  return {
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...extra },
    jar,
    tags: { name },
  };
}

export function openBooster() {
  const response = http.post(
    `${BASE_URL}/boosters/open`,
    JSON.stringify({ kind: "collection", collectionId: STARTER }),
    asPlayer(nextPlayer(), "open", { "Idempotency-Key": uuidV4() }),
  );
  check(response, {
    "booster opened": (r) => r.status === 200,
  });
}

export function answerChallenges() {
  const player = nextPlayer();
  const session = http.get(`${BASE_URL}/challenges?limit=5`, asPlayer(player, "challenges"));
  check(session, { "session given": (r) => r.status === 200 });
  if (session.status !== 200) return;
  for (const question of session.json("questions")) {
    // The right choice is the card asked; a typed word is only asked once a level can be won.
    const answer =
      question.format === "typed"
        ? { cardId: question.cardId, format: "typed", typed: "inconnu" }
        : { cardId: question.cardId, format: question.format, chosenCardId: question.cardId };
    const response = http.post(
      `${BASE_URL}/challenges/answer`,
      JSON.stringify(answer),
      asPlayer(player, "answer", { "Idempotency-Key": uuidV4() }),
    );
    check(response, { "answer taken": (r) => r.status === 200 });
  }
}

export function readCollection() {
  const player = nextPlayer();
  let cursor = null;
  do {
    const query = cursor === null ? "limit=500" : `limit=500&cursor=${encodeURIComponent(cursor)}`;
    const page = http.get(`${BASE_URL}/me/cards?${query}`, asPlayer(player, "cards"));
    check(page, { "cards read": (r) => r.status === 200 });
    cursor = page.status === 200 ? page.json("nextCursor") : null;
  } while (cursor !== null);
  const mastery = http.get(`${BASE_URL}/me/mastery`, asPlayer(player, "mastery"));
  check(mastery, { "mastery read": (r) => r.status === 200 });
}

export function guestArrival() {
  // A new jar per arrival: each guest is a new browser.
  http.cookieJar().clear(BASE_URL);
  const signIn = http.post(`${BASE_URL}/api/auth/sign-in/anonymous`, "{}", {
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    tags: { name: "sign-in" },
  });
  check(signIn, { "guest signed in": (r) => r.status === 200 });
  if (signIn.status !== 200) return;
  // k6 keeps the session cookie in this VU's jar; it is sent with the opens below.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = http.post(
      `${BASE_URL}/boosters/open`,
      JSON.stringify({ kind: "collection", collectionId: STARTER }),
      {
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/json",
          "Idempotency-Key": uuidV4(),
        },
        tags: { name: "guest-open" },
      },
    );
    check(response, { "guest booster opened": (r) => r.status === 200 });
  }
}
