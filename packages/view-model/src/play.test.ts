import { describe, expect, it } from "vitest";
import {
  bestFinds,
  collectionChoices,
  collectionShelf,
  openAgainLabel,
  pickCollection,
  playFabs,
  reserveView,
  shortName,
  stockView,
} from "./play";

const NOW = Date.UTC(2026, 9, 22, 12);
const wallet = (stored: number, bonus = 0) => ({
  stored,
  bonus,
  garni: 0,
  bonusCap: 10,
  capacity: 6,
  nextRefillAt: stored >= 6 ? null : new Date(NOW + 18 * 60_000).toISOString(),
});
const collections = [
  { id: "caracteres", name: "Caractères et travers" },
  { id: "fondateurs", name: "Les Fondateurs" },
  { id: "metiers", name: "Métiers oubliés" },
];

describe("reserve", () => {
  it("counts the bonus sachets, the garnis first, and says when they open", () => {
    expect(reserveView(wallet(4, 1))).toMatchObject({
      headline: "1 sachet bonus",
      garni: null,
      places: "1 place prise sur 10.",
      openNow: false,
    });
    expect(reserveView({ ...wallet(0, 3), garni: 2 })).toMatchObject({
      headline: "3 sachets bonus",
      garni: "Dont 2 garnis, ouverts en premier.",
      places: "3 places prises sur 10.",
      openNow: true,
    });
    expect(reserveView({ ...wallet(0, 1), garni: 1 }).garni).toBe(
      "Dont 1 garni, ouvert en premier.",
    );
  });
});

describe("stock", () => {
  it("says what is left and what the button does", () => {
    expect(stockView(wallet(4), NOW)).toMatchObject({
      note: "+1 dans 18 min",
      action: "Ouvrir le sachet",
      refillShort: "18 min",
      empty: false,
    });
    expect(stockView(wallet(6), NOW)).toMatchObject({
      note: "plein",
      refillShort: "plein",
    });
    expect(stockView(wallet(0, 2), NOW)).toMatchObject({
      note: "2 bonus",
      action: "Ouvrir un sachet bonus",
    });
    expect(stockView(wallet(0), NOW)).toMatchObject({
      empty: true,
      action: "Prochain dans 18 min",
      note: "+1 dans 18 min",
    });
    expect(openAgainLabel(wallet(0), NOW)).toBe("Plus de sachet, 18 min");
  });
});

describe("collection of the sachet", () => {
  it("offers only the starter sachet before level 3, first", () => {
    const choices = collectionChoices(collections, 2, NOW);
    expect(choices.map((c) => [c.short, c.lock])).toEqual([
      ["Fondateurs", null],
      ["Caractères", "Niv. 3"],
      ["Métiers", "Niv. 3"],
    ]);
    expect(pickCollection(choices, "metiers").id).toBe("fondateurs");
  });

  it("lets the player choose from level 3", () => {
    const choices = collectionChoices(collections, 3, NOW);
    expect(choices.every((c) => c.lock === null)).toBe(true);
    expect(pickCollection(choices, "metiers").source).toEqual({
      kind: "collection",
      collectionId: "metiers",
    });
    expect(pickCollection(choices, "gone").id).toBe("fondateurs");
  });
});

describe("short collection name", () => {
  it("keeps the first word that is not an article", () => {
    expect(shortName("Les Fondateurs")).toBe("Fondateurs");
    expect(shortName("Caractères et travers")).toBe("Caractères");
  });
});

describe("floating buttons", () => {
  it("shows closed features with their level and what waits", () => {
    const { left, right } = playFabs({ level: 7, coffrets: 2, mail: 0 }, NOW);
    expect(left.map((f) => f.lock)).toEqual(["Niv. 10", "Niv. 10", "Niv. 15"]);
    expect(right.find((f) => f.id === "coffrets")).toMatchObject({ badge: 2, glow: true });
    const later = playFabs({ level: 15, coffrets: 0, mail: 0 }, NOW);
    expect(later.left.every((f) => f.lock === null)).toBe(true);
    expect(later.right.find((f) => f.id === "coffrets")?.glow).toBe(false);
  });
});

describe("collection shelf", () => {
  it("counts the words found, rarity by rarity, leaving out the rarities the collection lacks", () => {
    const cards = [
      { id: "a", rarity: "common" as const },
      { id: "b", rarity: "common" as const },
      { id: "c", rarity: "rare" as const },
    ];
    const owned = new Map([
      ["a", 2],
      ["c", 1],
      ["z", 1],
    ]);
    const shelf = collectionShelf(cards, owned);
    expect(shelf).toMatchObject({ owned: 2, total: 3, count: "2 / 3 mots" });
    expect(shelf.rarities).toEqual([
      { rarity: "common", owned: 1, total: 2 },
      { rarity: "rare", owned: 1, total: 1 },
    ]);
    expect(collectionShelf([], new Map()).ratio).toBe(0);
  });

  it("puts forward the rarest words found", () => {
    const cards = [
      { id: "a", rarity: "common" },
      { id: "b", rarity: "epic" },
      { id: "c", rarity: "rare" },
      { id: "d", rarity: "legendary" },
    ] as const;
    const owned = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 1],
      ["d", 0],
    ]);
    expect(bestFinds(cards, owned, 2).map((card) => card.id)).toEqual(["b", "c"]);
    expect(bestFinds(cards, new Map(), 3)).toEqual([]);
  });
});
