import { describe, expect, it } from "vitest";
import {
  collectionChoices,
  openAgainLabel,
  pickCollection,
  playFabs,
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
  { id: "metiers", name: "Métiers oubliés" },
];

describe("stock", () => {
  it("says what is left and what the button does", () => {
    expect(stockView(wallet(4), NOW)).toMatchObject({
      line: "4 sur 6 · le prochain dans 18 min",
      action: "Ouvrir le sachet",
      refillShort: "18 min",
      empty: false,
    });
    expect(stockView(wallet(6), NOW)).toMatchObject({
      line: "Stock plein. Ouvre, ça se recharge.",
      refillShort: "plein",
    });
    expect(stockView(wallet(0, 2), NOW)).toMatchObject({
      line: "Stock vide. 2 bonus en réserve.",
      action: "Ouvrir un sachet bonus",
    });
    expect(stockView(wallet(0), NOW)).toMatchObject({
      empty: true,
      action: "Prochain dans 18 min",
      line: "Plus rien dans la besace. Prochain sachet dans 18 min.",
    });
    expect(openAgainLabel(wallet(0), NOW)).toBe("Plus de sachet, 18 min");
  });
});

describe("collection of the sachet", () => {
  it("offers only the discovery sachet before level 3", () => {
    const choices = collectionChoices(collections, 2, NOW);
    expect(choices.map((c) => [c.short, c.lock])).toEqual([
      ["Découverte", null],
      ["Caractères", "Niv. 3"],
      ["Métiers", "Niv. 3"],
    ]);
    expect(pickCollection(choices, "metiers").id).toBe("discovery");
  });

  it("lets the player choose from level 3", () => {
    const choices = collectionChoices(collections, 3, NOW);
    expect(choices.every((c) => c.lock === null)).toBe(true);
    expect(pickCollection(choices, "metiers").source).toEqual({
      kind: "collection",
      collectionId: "metiers",
    });
    expect(pickCollection(choices, "gone").id).toBe("discovery");
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
