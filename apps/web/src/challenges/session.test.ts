import { describe, expect, it } from "vitest";
import {
  bonusLines,
  feedbackLine,
  levelUpLine,
  nextDueLabel,
  recapLine,
  sessionBonusLine,
} from "./session";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const at = (ms: number) => new Date(NOW + ms).toISOString();
const NO_BONUS = { daily: 0, gilded: 0, credited: 0, reserve: 0 };

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
    ({ cardId: "x", correct, levelUp, level: "sketch", bonus: NO_BONUS }) as const;

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
    expect(feedbackLine(true)).toBe("Bien vu !");
    expect(feedbackLine(false)).toContain("bonne réponse");
  });
});

describe("bonus lines", () => {
  it("celebrates each bonus earned", () => {
    expect(bonusLines(NO_BONUS)).toEqual([]);
    expect(bonusLines({ daily: 1, gilded: 0, credited: 1, reserve: 1 })).toEqual([
      "Défi du jour réussi : un pli bonus !",
    ]);
    expect(bonusLines({ daily: 1, gilded: 2, credited: 3, reserve: 4 })).toEqual([
      "Défi du jour réussi : un pli bonus !",
      "Dorure atteinte : 2 plis bonus !",
    ]);
  });

  it("says when the full reserve lost a bonus", () => {
    expect(bonusLines({ daily: 0, gilded: 1, credited: 0, reserve: 10 })).toEqual([
      "Dorure atteinte : un pli bonus !",
      "Ta réserve est pleine : ce pli bonus est perdu.",
    ]);
  });

  it("sums the session's bonus boosters for the recap", () => {
    const answer = (credited: number) => ({
      cardId: "x",
      correct: true,
      levelUp: false,
      level: "sketch" as const,
      bonus: { ...NO_BONUS, daily: credited, credited },
    });
    expect(sessionBonusLine([answer(0), answer(0)])).toBeNull();
    expect(sessionBonusLine([answer(1)])).toMatch(/^1 pli bonus gagné,/);
    expect(sessionBonusLine([answer(1), answer(1)])).toMatch(/^2 plis bonus gagnés,/);
  });
});
