import { describe, expect, it } from "vitest";
import {
  collectionProgress,
  copiesAt,
  firstOfRarityLabel,
  isFirstOfRarity,
  nextRefillLabel,
  recapLine,
  revealOrder,
} from "./reveal";

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

describe("copiesAt", () => {
  it("adds the copies already owned to those of the pack so far", () => {
    const cards = [
      { cardId: "a", rarity: "common" },
      { cardId: "a", rarity: "common" },
      { cardId: "b", rarity: "rare" },
    ] as const;
    const before = new Map([["a", 2]]);
    expect(copiesAt(cards, 0, before)).toBe(3);
    expect(copiesAt(cards, 1, before)).toBe(4);
    expect(copiesAt(cards, 2, before)).toBe(1);
  });
});

describe("isFirstOfRarity", () => {
  const cards = [
    { cardId: "a", rarity: "common" },
    { cardId: "b", rarity: "rare" },
    { cardId: "c", rarity: "rare" },
    { cardId: "d", rarity: "epic" },
  ] as const;

  it("celebrates the first card of a rarity from Rare up, once", () => {
    const before = new Set(["common"] as const);
    expect(isFirstOfRarity(cards, 0, new Set())).toBe(false);
    expect(isFirstOfRarity(cards, 1, before)).toBe(true);
    expect(isFirstOfRarity(cards, 2, before)).toBe(false);
    expect(isFirstOfRarity(cards, 3, before)).toBe(true);
  });

  it("stays quiet when the player already had one", () => {
    expect(isFirstOfRarity(cards, 3, new Set(["epic"] as const))).toBe(false);
  });
});

describe("firstOfRarityLabel", () => {
  it("agrees with the rarity name", () => {
    expect(firstOfRarityLabel("legendary")).toBe("Ta première Légendaire !");
    expect(firstOfRarityLabel("precious")).toBe("Ton premier Précieux !");
  });
});

describe("collectionProgress", () => {
  const collection = new Set(["a", "b", "c", "d"]);
  const cards = [
    { cardId: "b", rarity: "common" },
    { cardId: "b", rarity: "common" },
    { cardId: "a", rarity: "common" },
    { cardId: "z", rarity: "rare" },
  ] as const;

  it("counts distinct new cards of the collection only", () => {
    const before = new Map([
      ["a", 1],
      ["x", 3],
    ]);
    expect(collectionProgress(collection, before, cards)).toEqual({
      owned: 2,
      total: 4,
      gained: 1,
    });
  });

  it("stops at the card being revealed", () => {
    expect(collectionProgress(collection, new Map(), cards, 0)).toEqual({
      owned: 1,
      total: 4,
      gained: 1,
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
