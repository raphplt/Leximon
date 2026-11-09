import type { JoustSummary, JoustsResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { joustsHalf, joustsWaiting, trainingHalfLine } from "./challenge-halves";

function joust(overrides: Partial<JoustSummary>): JoustSummary {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    kind: "ranked",
    launched: true,
    opponent: null,
    state: "waiting",
    replyBy: null,
    outcome: null,
    forfeit: false,
    mine: null,
    theirs: null,
    createdAt: "2026-11-10T14:00:00Z",
    seen: true,
    ...overrides,
  };
}

function response(overrides: Partial<JoustsResponse>): JoustsResponse {
  return {
    access: "open",
    opensAtLevel: 8,
    deckReady: true,
    deckSaved: true,
    guideDone: true,
    waiting: 0,
    maxWaiting: 3,
    answerSeconds: 8,
    questions: 5,
    jousts: [],
    standing: {
      week: { index: 1, firstDay: "2026-11-09", lastDay: "2026-11-15" },
      league: "chevalier",
      group: { place: 4, points: 9, size: 30, move: "stay" },
      rankedLeft: 3,
      rankedPerDay: 5,
      rewardsWaiting: 0,
    },
    ...overrides,
  };
}

describe("training half", () => {
  it("counts the words to review, once read", () => {
    expect(trainingHalfLine(null)).toBeNull();
    expect(trainingHalfLine(0)).toBe("Aucun mot à revoir pour l'instant.");
    expect(trainingHalfLine(1)).toBe("1 mot à revoir.");
    expect(trainingHalfLine(12)).toBe("12 mots à revoir.");
  });
});

describe("jousts half", () => {
  const sealed = joust({ state: "ended", outcome: "won", seen: false });
  const opened = joust({ state: "ended", outcome: "lost", seen: true });
  const toAnswer = joust({ state: "play", launched: false, kind: "friendly" });
  const mine = joust({ state: "play", launched: true });

  it("counts the sealed results and the jousts to answer, not the player's own", () => {
    expect(joustsWaiting([sealed, opened, toAnswer, mine])).toBe(2);
  });

  it("gives the place in the league, then what waits", () => {
    expect(joustsHalf(response({ jousts: [sealed, sealed, toAnswer] }))).toEqual({
      league: "chevalier",
      lockedAt: null,
      lines: ["Tu es 4e sur 30 en Chevalier.", "2 plis à ouvrir."],
      waiting: 3,
    });
    expect(joustsHalf(response({ jousts: [toAnswer] })).lines[1]).toBe("1 joute attend ta partie.");
  });

  it("falls back on the ranked jousts left today", () => {
    expect(joustsHalf(response({})).lines[1]).toBe("Encore 3 joutes classées aujourd'hui.");
    const played = response({});
    const done = joustsHalf({ ...played, standing: { ...played.standing, rankedLeft: 0 } });
    expect(done.lines[1]).toBe("Tes joutes classées du jour sont jouées.");
  });

  it("names the league alone before the first ranked joust of the week", () => {
    const fresh = response({});
    expect(joustsHalf({ ...fresh, standing: { ...fresh.standing, group: null } }).lines[0]).toBe(
      "Tu joutes en Chevalier.",
    );
  });

  it("says what keeps them closed", () => {
    expect(joustsHalf(response({ access: "level_too_low" }))).toEqual({
      league: null,
      lockedAt: 8,
      lines: ["Elles ouvrent au niveau 8."],
      waiting: 0,
    });
    expect(joustsHalf(response({ access: "account_required" })).lines).toEqual([
      "Crée un compte pour jouter.",
    ]);
    expect(joustsHalf(null).lines).toEqual([]);
  });
});
