import type { CatalogCard } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { filterCards } from "./card-filter";

function card(overrides: Partial<CatalogCard>): CatalogCard {
  return {
    id: "abajoue",
    word: "abajoue",
    partOfSpeech: "n. f.",
    era: null,
    definition: "Poche de la joue.",
    etymology: null,
    quote: null,
    rarity: "common",
    collectionId: "fondateurs",
    themes: [],
    perBillion: null,
    engraving: null,
    ...overrides,
  };
}

const ENGRAVING = {
  ink: "gravures/gourgandine.0123456789ab.ink.webp",
  fill: "gravures/gourgandine.0123456789ab.fill.webp",
  width: 10,
  height: 10,
  credit: "Anonyme · Wikimedia Commons (domaine public)",
  sourceUrl: "https://commons.wikimedia.org/",
  licence: "domaine public",
};

const CARDS = [
  card({ id: "ecu", word: "écu", rarity: "rare" }),
  card({ id: "bailli", word: "Bailli", collectionId: "metiers" }),
  card({ id: "gourgandine", word: "gourgandine", engraving: ENGRAVING }),
];
const ALL = { query: "", collectionId: null, rarity: null, engraving: "all" } as const;

describe("filterCards", () => {
  it("finds a word whatever its accents and case", () => {
    expect(filterCards(CARDS, { ...ALL, query: "ECU" }).map((c) => c.id)).toEqual(["ecu"]);
    expect(filterCards(CARDS, { ...ALL, query: "bail" }).map((c) => c.id)).toEqual(["bailli"]);
  });

  it("narrows by collection, rarity and engraving", () => {
    expect(filterCards(CARDS, { ...ALL, collectionId: "metiers" })).toHaveLength(1);
    expect(filterCards(CARDS, { ...ALL, rarity: "rare" })).toHaveLength(1);
    expect(filterCards(CARDS, { ...ALL, engraving: "with" }).map((c) => c.id)).toEqual([
      "gourgandine",
    ]);
    expect(filterCards(CARDS, { ...ALL, engraving: "without" })).toHaveLength(2);
  });
});
