import { describe, expect, it } from "vitest";
import { PACK_NOUNS } from "./pack";
import {
  bonusLabel,
  collectionProgress,
  collectionTally,
  copiesAt,
  firstOfRarityLabel,
  isFirstOfRarity,
  nextRefillLabel,
  rarityCompletedGain,
  rarityCompletedLabel,
  recap,
  recapOrder,
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

describe("recapOrder", () => {
  it("leads with the rarest card and remembers each card's place in the reveal", () => {
    const revealed = [
      { cardId: "b", rarity: "common" },
      { cardId: "d", rarity: "common" },
      { cardId: "c", rarity: "uncommon" },
      { cardId: "a", rarity: "epic" },
    ] as const;
    expect(recapOrder(revealed).map(({ card, index }) => [card.cardId, index])).toEqual([
      ["a", 3],
      ["c", 2],
      ["b", 0],
      ["d", 1],
    ]);
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
      fresh: "2 nouveaux mots",
    });
  });

  it("stays quiet about common boosters", () => {
    const cards = [{ cardId: "b", rarity: "uncommon" }] as const;
    expect(recap(cards, new Set(["b"]))).toEqual({ best: null, fresh: "aucun nouveau mot" });
    expect(recap(cards, new Set())).toEqual({ best: null, fresh: "1 nouveau mot" });
  });

  it("counts every card of the best rarity", () => {
    const cards = [
      { cardId: "a", rarity: "rare" },
      { cardId: "b", rarity: "rare" },
      { cardId: "c", rarity: "common" },
    ] as const;
    expect(recap(cards, new Set(["a", "b", "c"])).best).toEqual({
      rarity: "rare",
      label: "2 Rares",
    });
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

describe("rarityCompletedGain", () => {
  it("says which rarity is complete and what it earned", () => {
    expect(rarityCompletedGain({ rarity: "legendary", xp: 1000 })).toEqual({
      title: "Toutes les Légendaires",
      note: `Réunies, +1${"\u202f"}000 XP`,
    });
    expect(rarityCompletedGain({ rarity: "precious", xp: 400 })).toEqual({
      title: "Toutes les Précieuses",
      note: "Réunies, +400 XP",
    });
  });
});

describe("rarityCompletedLabel", () => {
  it("says the rarity is complete and what it earned", () => {
    expect(rarityCompletedLabel({ rarity: "legendary", xp: 1000 })).toBe(
      `Toutes les cartes Légendaires réunies ! +1${"\u202f"}000 XP`,
    );
    expect(rarityCompletedLabel({ rarity: "precious", xp: 400 })).toBe(
      "Toutes les cartes Précieuses réunies ! +400 XP",
    );
  });
});

describe("collectionTally", () => {
  it("gives the figure, the cards gained and the bar before and after", () => {
    expect(collectionTally({ owned: 40, total: 520, gained: 5 })).toEqual({
      figure: "40 / 520",
      gained: "+5",
      before: 35 / 520,
      after: 40 / 520,
    });
  });

  it("has no gain when the sachet gave nothing new", () => {
    expect(collectionTally({ owned: 40, total: 520, gained: 0 }).gained).toBeNull();
  });

  it("stays at zero for an empty collection", () => {
    expect(collectionTally({ owned: 0, total: 0, gained: 0 })).toMatchObject({
      before: 0,
      after: 0,
    });
  });
});

describe("firstOfRarityLabel", () => {
  it("agrees with the rarity name", () => {
    expect(firstOfRarityLabel("legendary")).toBe("Ta première carte Légendaire !");
    expect(firstOfRarityLabel("precious")).toBe("Ta première carte Précieuse !");
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

describe("bonusLabel", () => {
  it("counts the bonus boosters in reserve", () => {
    expect(bonusLabel(0)).toBeNull();
    expect(bonusLabel(1, PACK_NOUNS.pli)).toBe("+1 pli bonus");
    expect(bonusLabel(4, PACK_NOUNS.pli)).toBe("+4 plis bonus");
    expect(bonusLabel(2, PACK_NOUNS.sachet)).toBe("+2 sachets bonus");
  });
});
