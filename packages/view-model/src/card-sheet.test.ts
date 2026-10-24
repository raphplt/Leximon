import { describe, expect, it } from "vitest";
import { canOfferInTrade, comeBackIn, copiesLabel, masteryView, reviewLabel } from "./card-sheet";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const DAY = 86_400_000;

describe("mastery of a card", () => {
  const word = (level: "sketch" | "ink" | "gilded", due: number, lastReviewedAt: number) => ({
    level,
    due,
    stability: 1,
    lastReviewedAt,
  });

  it("says what it takes to climb the next level", () => {
    expect(masteryView(undefined, NOW).text).toBe("Pas encore révisé.");
    const sketch = masteryView(word("sketch", NOW + 2 * DAY, NOW - DAY), NOW);
    expect(sketch.text).toBe("Retrouve-le 7 jours après une révision, et c'est l'Encre.");
    expect(sketch.steps.map((step) => step.reached)).toEqual([true, false, false]);
    expect(masteryView(word("sketch", NOW + 4 * DAY, NOW - 3 * DAY), NOW).text).toBe(
      "Juste à la prochaine révision, et c'est l'Encre.",
    );
    expect(masteryView(word("ink", NOW + 10 * DAY, NOW - 4 * DAY), NOW).text).toBe(
      "Retrouve-le 30 jours après une révision, et c'est la Dorure.",
    );
    // Overdue: the time already waited counts.
    expect(masteryView(word("ink", NOW - DAY, NOW - 31 * DAY), NOW).text).toBe(
      "Juste à la prochaine révision, et c'est la Dorure.",
    );
    const gilded = masteryView(word("gilded", NOW, NOW - 60 * DAY), NOW);
    expect(gilded.text).toBe("Doré. Il ne bouge plus.");
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
    expect(reviewLabel({ ...memory, due: NOW - 1 }, NOW)).toBe("Il t'attend dans les défis.");
    expect(reviewLabel({ ...memory, due: NOW + 3 * DAY }, NOW)).toBe("Revient dans 3 jours.");
    expect(comeBackIn(30 * 60_000)).toBe("dans 30 min");
    expect(comeBackIn(DAY)).toBe("demain");
  });
});
