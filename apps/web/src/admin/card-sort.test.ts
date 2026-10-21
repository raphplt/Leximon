import type { CatalogCard } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { sortCards } from "./card-sort";

function makeCard(overrides: Partial<CatalogCard>): CatalogCard {
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
  ink: "gravures/test.ink.webp",
  fill: "gravures/test.fill.webp",
  width: 10,
  height: 10,
  credit: "Test",
  sourceUrl: "https://example.com",
  licence: "domaine public",
};

const CARDS = [
  makeCard({ id: "zythum", word: "zythum", rarity: "rare", collectionId: "b", perBillion: 5 }),
  makeCard({
    id: "acagnarder",
    word: "acagnarder",
    rarity: "legendary",
    collectionId: "a",
    perBillion: 100,
    engraving: ENGRAVING,
  }),
  makeCard({
    id: "boustifaille",
    word: "boustifaille",
    rarity: "common",
    collectionId: "c",
    perBillion: null,
  }),
];

describe("sortCards", () => {
  it("sorts by word asc and desc", () => {
    const asc = sortCards(CARDS, { column: "word", direction: "asc" });
    expect(asc.map((c) => c.word)).toEqual(["acagnarder", "boustifaille", "zythum"]);

    const desc = sortCards(CARDS, { column: "word", direction: "desc" });
    expect(desc.map((c) => c.word)).toEqual(["zythum", "boustifaille", "acagnarder"]);
  });

  it("sorts by rarity asc and desc with word tiebreaker", () => {
    const asc = sortCards(CARDS, { column: "rarity", direction: "asc" });
    expect(asc.map((c) => c.rarity)).toEqual(["common", "rare", "legendary"]);

    const desc = sortCards(CARDS, { column: "rarity", direction: "desc" });
    expect(desc.map((c) => c.rarity)).toEqual(["legendary", "rare", "common"]);
  });

  it("sorts by collection name", () => {
    const names: Record<string, string> = {
      a: "Zoulou",
      b: "Alpha",
      c: "Beta",
    };
    const asc = sortCards(
      CARDS,
      { column: "collection", direction: "asc" },
      (id) => names[id] ?? id,
    );
    expect(asc.map((c) => c.collectionId)).toEqual(["b", "c", "a"]);

    const desc = sortCards(
      CARDS,
      { column: "collection", direction: "desc" },
      (id) => names[id] ?? id,
    );
    expect(desc.map((c) => c.collectionId)).toEqual(["a", "c", "b"]);
  });

  it("sorts by engraving (with engraving first in asc)", () => {
    const asc = sortCards(CARDS, { column: "engraving", direction: "asc" });
    expect(asc[0]?.id).toBe("acagnarder");

    const desc = sortCards(CARDS, { column: "engraving", direction: "desc" });
    expect(desc[2]?.id).toBe("acagnarder");
  });

  it("sorts by frequency (lowest first in asc)", () => {
    const asc = sortCards(CARDS, { column: "frequency", direction: "asc" });
    expect(asc.map((c) => c.word)).toEqual(["boustifaille", "zythum", "acagnarder"]);

    const desc = sortCards(CARDS, { column: "frequency", direction: "desc" });
    expect(desc.map((c) => c.word)).toEqual(["acagnarder", "zythum", "boustifaille"]);
  });

  it("does not mutate the original array", () => {
    const original = [...CARDS];
    sortCards(CARDS, { column: "word", direction: "asc" });
    expect(CARDS).toEqual(original);
  });
});
