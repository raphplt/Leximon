import { describe, expect, it } from "vitest";
import { nextRefillLabel, recapLine, revealOrder } from "./reveal";

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

describe("recapLine", () => {
  it("names the best rarity from Rare up, and counts new words once", () => {
    const cards = [
      { cardId: "a", rarity: "epic" },
      { cardId: "b", rarity: "common" },
      { cardId: "b", rarity: "common" },
      { cardId: "c", rarity: "uncommon" },
    ] as const;
    expect(recapLine(cards, new Set(["c"]))).toBe("1 Épique · 2 mots nouveaux");
  });

  it("stays quiet about common boosters", () => {
    const cards = [{ cardId: "b", rarity: "uncommon" }] as const;
    expect(recapLine(cards, new Set(["b"]))).toBe("aucun mot nouveau");
    expect(recapLine(cards, new Set())).toBe("1 mot nouveau");
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
