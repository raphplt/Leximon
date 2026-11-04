import type { ReviewQuestion, ReviewSummaryResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import type { AnsweredQuestion } from "./challenges";
import {
  choiceIndexOfKey,
  comingBackLine,
  comingBackTomorrow,
  formatOptions,
  memoryLine,
  memoryParts,
  playable,
  reviewAction,
  reviewLine,
  reviewShelf,
  reviewWells,
  scoredAnswers,
  seriesOf,
  streakLine,
  withCatchUp,
} from "./review";

const NOW = Date.parse("2026-11-05T10:00:00Z");
const HOUR = 3_600_000;

function summary(overrides: Partial<ReviewSummaryResponse> = {}): ReviewSummaryResponse {
  return {
    due: 12,
    fresh: 5,
    rising: 2,
    nextDueAt: null,
    levels: { blank: 31, sketch: 53, ink: 9, gilded: 3 },
    settings: {
      length: 10,
      newWordsPerDay: 10,
      lengths: [5, 10, 20],
      newWordsPerDayChoices: [5, 10, 20],
      listen: true,
      pairs: false,
      difficulty: "normal",
    },
    scopes: [],
    xp: { today: 0, cap: 100 },
    streak: { current: 0, total: 0, playedToday: false },
    ...overrides,
  };
}

describe("what waits", () => {
  it("says the three counters with their agreements", () => {
    expect(reviewWells(summary()).map((w) => [w.figure, w.label])).toEqual([
      [12, "à revoir"],
      [5, "nouveaux"],
      [2, "peuvent monter"],
    ]);
    expect(reviewWells(summary({ fresh: 1, rising: 1 })).map((w) => w.label)).toEqual([
      "à revoir",
      "nouveau",
      "peut monter",
    ]);
    expect(reviewWells(summary({ fresh: 0, rising: 0 })).map((w) => w.label)).toEqual([
      "à revoir",
      "nouveau",
      "peut monter",
    ]);
    expect(reviewWells(summary()).find((w) => w.key === "rising")?.gilt).toBe(true);
  });

  it("says what waits in a sentence", () => {
    expect(reviewLine(summary(), NOW)).toBe(
      "12 mots sont à revoir, dont 2 peuvent monter d'un palier. 5 nouveaux mots attendent leur première question.",
    );
    expect(reviewLine(summary({ due: 1, rising: 1, fresh: 1 }), NOW)).toBe(
      "1 mot est à revoir, dont 1 peut monter d'un palier. 1 nouveau mot attend sa première question.",
    );
    expect(reviewLine(summary({ due: 3, rising: 0, fresh: 0 }), NOW)).toBe("3 mots sont à revoir.");
    expect(reviewLine(summary({ due: 0, rising: 0, fresh: 2 }), NOW)).toBe(
      "2 nouveaux mots attendent leur première question.",
    );
  });

  it("stays calm when nothing waits, and after a long absence", () => {
    const calm = summary({
      due: 0,
      fresh: 0,
      rising: 0,
      nextDueAt: new Date(NOW + 3 * HOUR).toISOString(),
    });
    expect(reviewLine(calm, NOW)).toBe(
      "Tes mots tiennent bon. Le prochain revient dans 3 h. Tu peux t'entraîner en attendant.",
    );
    expect(reviewLine(summary({ due: 140, fresh: 10, rising: 6 }), NOW)).toBe(
      "140 mots sont à revoir. Les plus urgents passent d'abord. 10 nouveaux mots attendent leur première question.",
    );
    const empty = summary({ levels: { blank: 0, sketch: 0, ink: 0, gilded: 0 }, due: 0, fresh: 0 });
    expect(reviewLine(empty, NOW)).toBe("Ouvre des sachets pour trouver tes premiers mots.");
    expect(reviewAction(empty).disabled).toBe(true);
  });

  it("starts a series, or practice when nothing waits, with its duration", () => {
    expect(reviewAction(summary())).toEqual({
      label: "Commencer",
      count: 10,
      estimate: "10 questions, environ 3 minutes",
      disabled: false,
    });
    const calm = reviewAction(summary({ due: 0, fresh: 0, rising: 0 }));
    expect(calm.label).toBe("S'entraîner");
    expect(calm.estimate).toBe("10 questions sur tes mots les plus fragiles, environ 3 minutes");
    const short = summary({ rising: 0, settings: { ...summary().settings, length: 5 } });
    expect(reviewAction(short).estimate).toBe("5 questions, environ 1 minute");
  });
});

describe("settings and streak", () => {
  it("lists the formats the player keeps", () => {
    expect(formatOptions(summary()).map((o) => [o.key, o.on])).toEqual([
      ["listen", true],
      ["pairs", false],
    ]);
  });

  it("says the days played first, then those in a row", () => {
    const streak = (current: number, total: number) =>
      streakLine({ current, total, playedToday: true });
    expect(streak(0, 0)).toBeNull();
    expect(streak(1, 1)).toBe("1 jour joué.");
    expect(streak(1, 12)).toBe("12 jours joués.");
    expect(streak(5, 5)).toBe("5 jours joués, tous à la suite.");
    expect(streak(5, 12)).toBe("12 jours joués, dont 5 à la suite.");
  });

  it("shows a word to listen to when the sound is off", () => {
    const heard = seriesOf([
      {
        cardId: "a",
        format: "listen",
        choices: ["a", "b", "c", "d"],
        counted: true,
        fresh: false,
        retry: null,
      },
    ])[0];
    if (heard === undefined) throw new Error("no question");
    expect(playable(heard, true).format).toBe("listen");
    expect(playable(heard, false).format).toBe("definition");
  });
});

describe("the shelf", () => {
  const scopes: ReviewSummaryResponse["scopes"] = [
    { scope: { kind: "recent" }, words: 30, due: 2, rising: 0, levels: summary().levels },
    { scope: { kind: "rising" }, words: 1, due: 1, rising: 1, levels: summary().levels },
    {
      scope: { kind: "collection", id: "fondateurs" },
      words: 48,
      due: 6,
      rising: 1,
      levels: summary().levels,
    },
    {
      scope: { kind: "theme", id: "nature" },
      words: 4,
      due: 0,
      rising: 0,
      levels: summary().levels,
    },
  ];

  it("puts the words ready to rise first, then the collections and themes", () => {
    const shelf = reviewShelf(summary({ scopes }), () => "Les Fondateurs", null);
    expect(shelf.shortcuts.map((c) => c.name)).toEqual(["Prêts à monter", "Mes mots récents"]);
    expect(shelf.collections).toEqual([
      expect.objectContaining({
        name: "Les Fondateurs",
        words: "48 mots",
        due: 6,
        go: "10 questions",
      }),
    ]);
    expect(shelf.shortcuts[0]).toMatchObject({ words: "1 mot", go: "1 question" });
    expect(shelf.themes[0]).toMatchObject({ name: "Nature", lockedAt: null, go: "4 questions" });
  });

  it("keeps the themes closed below their level", () => {
    const shelf = reviewShelf(summary({ scopes }), () => "", 3);
    expect(shelf.themes[0]?.lockedAt).toBe(3);
  });
});

describe("ta mémoire", () => {
  it("shows the four levels and their shares", () => {
    const parts = memoryParts({ blank: 1, sketch: 2, ink: 1, gilded: 0 });
    expect(parts.map((p) => [p.label, p.count, p.share])).toEqual([
      ["Page blanche", 1, 0.25],
      ["Esquisse", 2, 0.5],
      ["Encre", 1, 0.25],
      ["Dorure", 0, 0],
    ]);
  });

  it("says when the next word comes back", () => {
    const calm = summary({ due: 0, nextDueAt: new Date(NOW + 3 * HOUR).toISOString() });
    expect(memoryLine(calm, NOW)).toBe("Le prochain mot revient dans 3 h.");
    expect(memoryLine(summary({ due: 1 }), NOW)).toBe("1 mot attend sa révision.");
    expect(memoryLine(summary(), NOW)).toBe("12 mots attendent leur révision.");
  });
});

describe("the series", () => {
  const question = (cardId: string): ReviewQuestion => ({
    cardId,
    format: "definition",
    choices: [cardId, "x", "y", "z"],
    counted: true,
    fresh: false,
    retry: { format: "word", choices: ["x", cardId, "y", "z"] },
  });
  const series = seriesOf(["a", "b", "c", "d", "e"].map(question));

  it("asks a missed word again three questions later, the other way round", () => {
    const next = withCatchUp(series, 0, NOW);
    expect(next.map((q) => q.cardId)).toEqual(["a", "b", "c", "a", "d", "e"]);
    expect(next[3]).toMatchObject({ format: "word", counted: false, catchUp: true, retry: null });
  });

  it("puts a catch-up last near the end, once per word, three at most", () => {
    expect(withCatchUp(series, 4, NOW).map((q) => q.cardId)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "e",
    ]);
    let caught = withCatchUp(series, 0, NOW);
    expect(withCatchUp(caught, 3, NOW)).toBe(caught);
    caught = withCatchUp(withCatchUp(caught, 1, NOW), 2, NOW);
    expect(caught.filter((q) => q.catchUp)).toHaveLength(3);
    expect(withCatchUp(caught, 5, NOW)).toBe(caught);
  });

  it("scores the series without its catch-ups", () => {
    const caught = withCatchUp(series, 0, NOW);
    const answers = caught.map((q, index) => ({ cardId: q.cardId, correct: index === 3 }));
    expect(scoredAnswers(caught, answers as never)).toHaveLength(5);
  });

  it("reads the keys of the choices", () => {
    expect(["1", "4", "a", "D", "5", "Enter"].map(choiceIndexOfKey)).toEqual([
      0,
      3,
      0,
      3,
      null,
      null,
    ]);
  });
});

describe("the recap", () => {
  const answered = (cardId: string, correct: boolean, free = false): AnsweredQuestion => ({
    cardId,
    correct,
    levelUp: false,
    level: "sketch",
    bonus: { daily: 0, gilded: 0, credited: 0, reserve: 0 },
    progress: { xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 150, xpGained: 0, levelUp: false },
    free,
  });

  it("names the words that come back tomorrow, not the practice ones", () => {
    const words = comingBackTomorrow([
      answered("a", false),
      answered("b", true),
      answered("a", false, true),
      answered("c", false, true),
    ]);
    expect(words).toEqual(["a"]);
    expect(comingBackLine(0)).toBeNull();
    expect(comingBackLine(1)).toBe("Ce mot reviendra demain.");
    expect(comingBackLine(2)).toBe("Ces 2 mots reviendront demain.");
  });
});
