import { describe, expect, it } from "vitest";
import { canOfferInTrade, comeBackIn, copiesLabel, masteryView, reviewState } from "./card-sheet";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const DAY = 86_400_000;

describe("mastery of a card (A-07)", () => {
  it("says what is left before the next level", () => {
    expect(masteryView(undefined, NOW).text).toBe("Pas encore révisé. Un défi le met en route.");
    const sketch = masteryView({ level: "sketch", due: NOW, stability: 3.4 }, NOW);
    expect(sketch.text).toBe("Retenu 3 jours sur 7. Encore 4 pour l'Encre.");
    expect(sketch.steps.map((step) => step.reached)).toEqual([true, false, false]);
    expect(masteryView({ level: "sketch", due: NOW, stability: 0.2 }, NOW).text).toBe(
      "Retenu moins d'un jour. Encore 7 pour l'Encre.",
    );
    expect(masteryView({ level: "ink", due: NOW, stability: 12 }, NOW).text).toBe(
      "Encore 18 jours pour la Dorure.",
    );
    const gilded = masteryView({ level: "gilded", due: NOW, stability: 40 }, NOW);
    expect(gilded.text).toBe("Doré. Il ne bouge plus.");
    expect(gilded.steps.every((step) => step.reached)).toBe(true);
  });
});

describe("copies and actions (A-08)", () => {
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

  it("reviews a due word, or says when it comes back", () => {
    expect(reviewState(undefined, NOW)).toEqual({ due: true });
    expect(reviewState({ level: "sketch", due: NOW - 1, stability: 1 }, NOW)).toEqual({
      due: true,
    });
    expect(reviewState({ level: "ink", due: NOW + 3 * DAY, stability: 9 }, NOW)).toEqual({
      due: false,
      label: "Revient dans 3 jours.",
    });
    expect(comeBackIn(30 * 60_000)).toBe("dans 30 min");
    expect(comeBackIn(DAY)).toBe("demain");
  });
});
