import { createSeededRandom } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  answerTitle,
  bonusLines,
  dailyView,
  escapingWords,
  feedbackLine,
  levelUpLine,
  memoryCounts,
  memoryNote,
  nextDueLabel,
  questionKicker,
  recapLine,
  reviewQuestion,
  sessionBonusLine,
  sessionXpLine,
} from "./challenges";
import { SACHET_NOUN } from "./format";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const at = (ms: number) => new Date(NOW + ms).toISOString();
const PLI = { one: "pli", many: "plis" };
const NO_BONUS = { daily: 0, gilded: 0, credited: 0, reserve: 0 };
const PROGRESS = { xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 100, levelUp: false };
const NO_XP = { ...PROGRESS, xpGained: 0 };

describe("nextDueLabel", () => {
  it("says when the next word comes back", () => {
    expect(nextDueLabel(null, NOW)).toBeNull();
    expect(nextDueLabel(at(-1), NOW)).toBe("maintenant");
    expect(nextDueLabel(at(10 * 60_000), NOW)).toBe("dans 10 min");
    expect(nextDueLabel(at(3 * 3_600_000), NOW)).toBe("dans 3 h");
    expect(nextDueLabel(at(26 * 3_600_000), NOW)).toBe("demain");
    expect(nextDueLabel(at(5 * 86_400_000), NOW)).toBe("dans 5 jours");
  });
});

describe("recapLine", () => {
  const answer = (correct: boolean, levelUp = false) =>
    ({ cardId: "x", correct, levelUp, level: "sketch", bonus: NO_BONUS, progress: NO_XP }) as const;

  it("counts right answers and level ups", () => {
    expect(recapLine([answer(true), answer(false)])).toBe("1 bonne réponse sur 2");
    expect(recapLine([answer(false)])).toBe("Aucune bonne réponse sur 1");
    expect(recapLine([answer(true, true), answer(true, true), answer(true)])).toBe(
      "3 bonnes réponses sur 3, 2 cartes montées de niveau",
    );
  });
});

describe("lines", () => {
  it("names the new level with its article", () => {
    expect(levelUpLine("galimatias", "ink")).toBe("galimatias passe à l'Encre !");
    expect(levelUpLine("galimatias", "gilded")).toBe("galimatias passe à la Dorure !");
  });

  it("encourages", () => {
    expect(feedbackLine(true)).toBe("Bien vu.");
    expect(feedbackLine(false)).toContain("Raté");
  });
});

describe("bonus lines", () => {
  it("celebrates each bonus earned", () => {
    expect(bonusLines(NO_BONUS, PLI)).toEqual([]);
    expect(bonusLines({ daily: 1, gilded: 0, credited: 1, reserve: 1 }, PLI)).toEqual([
      "Un pli bonus pour le défi du jour !",
    ]);
    expect(bonusLines({ daily: 1, gilded: 2, credited: 3, reserve: 4 }, PLI)).toEqual([
      "Un pli bonus pour le défi du jour !",
      "2 plis bonus pour la Dorure !",
    ]);
  });

  it("says when the full reserve lost a bonus", () => {
    expect(bonusLines({ daily: 0, gilded: 1, credited: 0, reserve: 10 }, PLI)).toEqual([
      "Un pli bonus pour la Dorure !",
      "Réserve pleine, ce pli bonus est perdu.",
    ]);
  });

  it("sums the session's bonus boosters for the recap", () => {
    const answer = (credited: number) => ({
      cardId: "x",
      correct: true,
      levelUp: false,
      level: "sketch" as const,
      bonus: { ...NO_BONUS, daily: credited, credited },
      progress: NO_XP,
    });
    expect(sessionBonusLine([answer(0), answer(0)])).toBeNull();
    expect(sessionBonusLine([answer(1)], PLI)).toMatch(/^1 pli bonus gagné,/);
    expect(sessionBonusLine([answer(1), answer(1)], PLI)).toMatch(/^2 plis bonus gagnés,/);
    expect(sessionBonusLine([answer(1)], SACHET_NOUN)).toBe("1 sachet bonus gagné, en réserve.");
  });
});

describe("sessionXpLine", () => {
  const answer = (xpGained: number) => ({
    cardId: "x",
    correct: xpGained > 0,
    levelUp: false,
    level: "sketch" as const,
    bonus: NO_BONUS,
    progress: { ...PROGRESS, xpGained },
  });

  it("adds up the XP of the session, and says nothing without any", () => {
    expect(sessionXpLine([answer(15), answer(0), answer(40)])).toBe("+55 XP");
    expect(sessionXpLine([answer(0)])).toBeNull();
  });
});

describe("défis screen", () => {
  const goal = { answers: 5, correct: 3 };

  it("shows the daily goal and what is left", () => {
    const fresh = dailyView({ goal, answers: 0, correct: 0, awarded: false });
    expect(fresh).toMatchObject({
      title: "5 questions, 3 bonnes",
      action: "Commencer le défi",
      done: false,
      ratio: 0,
    });
    expect(fresh.text).toBe("Trois bonnes réponses sur cinq, et un sachet bonus file en réserve.");
    const going = dailyView({ goal, answers: 2, correct: 1, awarded: false });
    expect(going.bars).toEqual(["right", "wrong", "empty", "empty", "empty"]);
    expect(going.text).toBe("Encore 3 questions.");
    expect(going.action).toBe("Continuer le défi");
    expect(dailyView({ goal, answers: 6, correct: 2, awarded: false }).text).toBe(
      "Encore 1 bonne réponse.",
    );
    expect(dailyView({ goal, answers: 5, correct: 4, awarded: true })).toMatchObject({
      title: "Sachet gagné",
      action: "Reviens demain",
      done: true,
      ratio: 1,
    });
    expect(dailyView({ goal, answers: 5, correct: 4, awarded: true }, PLI).title).toBe("Pli gagné");
  });

  it("states the level thresholds in force", () => {
    expect(memoryNote(NOW)).toBe(
      "Un mot retenu 7 jours passe à l'Encre, 30 jours à la Dorure. Un mot raté revient le lendemain.",
    );
  });

  it("builds a one-word question, wrong choices from the same collection", () => {
    const random = createSeededRandom("0123456789abcdef0123456789abcdef");
    const home = { cards: ["a", "b", "c", "d", "e"].map((id) => ({ id })) };
    const other = { cards: ["x", "y"].map((id) => ({ id })) };
    const question = reviewQuestion(random, "a", [other, home]);
    expect(question?.cardId).toBe("a");
    expect(question?.choices).toHaveLength(4);
    expect(question?.choices).toContain("a");
    expect(question?.choices.every((id) => home.cards.some((card) => card.id === id))).toBe(true);
    expect(reviewQuestion(random, "unknown", [home])).toBeNull();
  });

  it("counts words at each level, owned words starting as sketches", () => {
    expect(memoryCounts(["a", "b", "c"], new Map([["b", "ink" as const]]))).toEqual({
      sketch: 2,
      ink: 1,
      gilded: 0,
    });
  });

  it("lists the words slipping away, most overdue first", () => {
    const now = Date.parse("2026-10-21T12:00:00Z");
    const memory = new Map([
      ["late", { due: now - 3_600_000 }],
      ["later", { due: now - 60_000 }],
      ["soon", { due: now + 3 * 3_600_000 }],
      ["far", { due: now + 5 * 86_400_000 }],
      ["traded", { due: now - 1 }],
    ]);
    const words = escapingWords(memory, new Set(["late", "later", "soon", "far"]), now);
    expect(words).toEqual([
      { cardId: "late", due: true, when: "À revoir maintenant" },
      { cardId: "later", due: true, when: "À revoir maintenant" },
      { cardId: "soon", due: false, when: "Revient dans 3 h" },
    ]);
  });

  it("words the question and the answer", () => {
    expect(questionKicker("word")).toBe("Quel mot se cache là-dessous ?");
    expect(answerTitle(true, 15)).toBe("Juste. +15 XP");
    expect(answerTitle(false, 0)).toBe("Raté.");
  });
});
