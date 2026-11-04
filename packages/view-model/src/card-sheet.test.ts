import { describe, expect, it } from "vitest";
import {
  canOfferInTrade,
  cardRun,
  comeBackIn,
  copiesLabel,
  masteryView,
  reviewLabel,
} from "./card-sheet";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const DAY = 86_400_000;

describe("mastery of a card", () => {
  const word = (
    level: "blank" | "sketch" | "ink" | "gilded",
    due: number,
    lastReviewedAt: number,
  ) => ({
    level,
    due,
    stability: 1,
    lastReviewedAt,
  });

  it("says what it takes to climb the next level", () => {
    const unanswered = masteryView(undefined, NOW);
    expect(unanswered.text).toBe(
      "Tu n'as pas encore révisé ce mot. Une bonne réponse en révision le fera passer à l'Esquisse.",
    );
    expect(unanswered.steps.map((step) => step.label)).toEqual(["Esquisse", "Encre", "Dorure"]);
    expect(unanswered.steps.some((step) => step.reached)).toBe(false);
    // Missed so far: any right answer draws the sketch, with no wait and no typing.
    const missed = masteryView(word("blank", NOW + 2 * DAY, NOW - DAY), NOW);
    expect(missed.text).toBe("Réponds juste à la prochaine révision pour passer à l'Esquisse.");
    expect(missed.steps.some((step) => step.reached)).toBe(false);
    const sketch = masteryView(word("sketch", NOW + 2 * DAY, NOW - DAY), NOW);
    expect(sketch.text).toBe(
      "Écris ce mot de mémoire 7 jours après une révision pour passer à l'Encre.",
    );
    expect(sketch.steps.map((step) => step.reached)).toEqual([true, false, false]);
    expect(masteryView(word("sketch", NOW + 4 * DAY, NOW - 3 * DAY), NOW).text).toBe(
      "Écris-le de mémoire à la prochaine révision pour passer à l'Encre.",
    );
    expect(masteryView(word("ink", NOW + 10 * DAY, NOW - 4 * DAY), NOW).text).toBe(
      "Écris ce mot de mémoire 30 jours après une révision pour passer à la Dorure.",
    );
    // Overdue: the time already waited counts.
    expect(masteryView(word("ink", NOW - DAY, NOW - 31 * DAY), NOW).text).toBe(
      "Écris-le de mémoire à la prochaine révision pour passer à la Dorure.",
    );
    const gilded = masteryView(word("gilded", NOW, NOW - 60 * DAY), NOW);
    expect(gilded.text).toBe("Ce mot a atteint la Dorure, le dernier palier.");
    expect(gilded.steps.every((step) => step.reached)).toBe(true);
  });
});

describe("copies and actions", () => {
  it("counts the doubles", () => {
    expect(copiesLabel(1)).toBe("1 exemplaire");
    expect(copiesLabel(2)).toBe("2 exemplaires · 1 double");
    expect(copiesLabel(4)).toBe("4 exemplaires · 3 doubles");
  });

  it("offers a double in trade from level 5 only", () => {
    expect(canOfferInTrade(2, 4, NOW)).toBe(false);
    expect(canOfferInTrade(2, 5, NOW)).toBe(true);
    expect(canOfferInTrade(1, 20, NOW)).toBe(false);
  });

  it("says where the word stands in the challenges", () => {
    expect(reviewLabel(undefined, NOW)).toBeNull();
    const memory = {
      level: "sketch" as const,
      stability: 1,
      lastReviewedAt: NOW - DAY,
    };
    expect(reviewLabel({ ...memory, due: NOW - 1 }, NOW)).toBe(
      "Ce mot est à réviser dans les défis.",
    );
    expect(reviewLabel({ ...memory, due: NOW + 3 * DAY }, NOW)).toBe(
      "Prochaine révision dans 3 jours.",
    );
    expect(comeBackIn(30 * 60_000)).toBe("dans 30 min");
    expect(comeBackIn(DAY)).toBe("demain");
  });
});

describe("turning from card to card", () => {
  it("gives the neighbours and the place among the cards", () => {
    expect(cardRun(["a", "b", "c"], "b")).toEqual({ previous: "a", next: "c", place: "2 sur 3" });
    expect(cardRun(["a", "b", "c"], "a")).toEqual({ previous: null, next: "b", place: "1 sur 3" });
    expect(cardRun(["a", "b", "c"], "c")).toEqual({ previous: "b", next: null, place: "3 sur 3" });
  });

  it("counts a card drawn twice once", () => {
    expect(cardRun(["a", "b", "a", "c"], "c")).toEqual({
      previous: "b",
      next: null,
      place: "3 sur 3",
    });
  });

  it("has nothing to turn to for a card alone or outside the list", () => {
    expect(cardRun(["a"], "a")).toBeNull();
    expect(cardRun(["a", "b"], "z")).toBeNull();
    expect(cardRun([], "a")).toBeNull();
  });
});
