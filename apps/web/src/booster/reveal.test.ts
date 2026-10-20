import { describe, expect, it } from "vitest";
import { bonusLabel, nextRefillLabel, recap, revealOrder } from "./reveal";

describe("revealOrder", () => {
  it("keeps the rarest card for last, and the draw order among equals", () => {
    const cards = [
      { cardId: "a", rarity: "epic" },
      { cardId: "b", rarity: "common" },
      { cardId: "c", rarity: "uncommon" },
      { cardId: "d", rarity: "common" },
    ] as const;
    expect(revealOrder(cards).map((card) => card.cardId)).toEqual(["b", "d", "c", "a"]);
  });
});

describe("recap", () => {
  it("names the best rarity from Rare up, and counts new words once", () => {
    const cards = [
      { cardId: "a", rarity: "epic" },
      { cardId: "b", rarity: "common" },
      { cardId: "b", rarity: "common" },
      { cardId: "c", rarity: "uncommon" },
    ] as const;
    expect(recap(cards, new Set(["c"]))).toEqual({
      best: { rarity: "epic", label: "1 Épique" },
      fresh: "2 mots nouveaux",
    });
  });

  it("stays quiet about common boosters", () => {
    const cards = [{ cardId: "b", rarity: "uncommon" }] as const;
    expect(recap(cards, new Set(["b"]))).toEqual({ best: null, fresh: "aucun mot nouveau" });
    expect(recap(cards, new Set())).toEqual({ best: null, fresh: "1 mot nouveau" });
  });

  it("counts every card of the best rarity", () => {
    const cards = [
      { cardId: "a", rarity: "rare" },
      { cardId: "b", rarity: "rare" },
      { cardId: "c", rarity: "common" },
    ] as const;
    expect(recap(cards, new Set(["a", "b", "c"])).best).toEqual({
      rarity: "rare",
      label: "2 Rare",
    });
  });
});

describe("nextRefillLabel", () => {
  const now = Date.parse("2026-10-19T12:00:00.000Z");

  it("counts minutes, then hours", () => {
    expect(nextRefillLabel("2026-10-19T12:11:10.000Z", now)).toBe("prochain dans 12 min");
    expect(nextRefillLabel("2026-10-19T13:05:00.000Z", now)).toBe("prochain dans 1 h 05");
  });

  it("never shows zero, and nothing when the stock is full", () => {
    expect(nextRefillLabel("2026-10-19T11:59:00.000Z", now)).toBe("prochain dans 1 min");
    expect(nextRefillLabel(null, now)).toBeNull();
  });
});

describe("bonusLabel", () => {
  it("counts the bonus boosters in reserve", () => {
    expect(bonusLabel(0)).toBeNull();
    expect(bonusLabel(1)).toBe("+1 pli bonus");
    expect(bonusLabel(4)).toBe("+4 plis bonus");
  });
});
