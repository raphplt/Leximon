import type { Rarity } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { choiceCount, choiceGroups } from "./card-choice";

const NOW = Date.UTC(2026, 9, 22);
const card = (id: string, word: string, rarity: Rarity, collectionId = "a") => ({
  id,
  word,
  rarity,
  collectionId,
});
const collections = [
  {
    id: "a",
    name: "A",
    cards: [
      card("a1", "écale", "common"),
      card("a2", "drille", "uncommon"),
      card("a3", "talpinette", "legendary"),
    ],
  },
  {
    id: "b",
    name: "B",
    cards: [card("b1", "barbon", "common", "b"), card("b2", "olifant", "rare", "b")],
  },
];

describe("card of the player's choice", () => {
  it("offers the Courant and Peu courant cards missing, sorted, by collection", () => {
    const groups = choiceGroups(collections, new Set(["a2"]), "", NOW);
    expect(groups.map((g) => [g.collectionId, g.cards.map((c) => c.id)])).toEqual([
      ["a", ["a1"]],
      ["b", ["b1"]],
    ]);
    expect(choiceCount(groups)).toBe("2 cartes qui te manquent");
  });

  it("searches without accents or case", () => {
    const groups = choiceGroups(collections, new Set(), "ECA", NOW);
    expect(groups.flatMap((g) => g.cards.map((c) => c.id))).toEqual(["a1"]);
  });

  it("offers every choosable card once none is missing", () => {
    const groups = choiceGroups(collections, new Set(["a1", "a2", "b1"]), "", NOW);
    expect(groups.flatMap((g) => g.cards.map((c) => c.id))).toEqual(["a2", "a1", "b1"]);
  });
});
