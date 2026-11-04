import type { CatalogCard, CatalogCollectionFile } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { pickShowcase, showcaseOf } from "./showcase-cards";

describe("pickShowcase", () => {
  it("keeps the given order and skips cards missing from the catalogue", () => {
    const card = (id: string) => ({ id }) as CatalogCard;
    const cardsById = new Map([
      ["a", card("a")],
      ["c", card("c")],
    ]);
    expect(pickShowcase(cardsById, ["c", "b", "a"]).map((found) => found.id)).toEqual(["c", "a"]);
  });
});

describe("showcaseOf", () => {
  const card = (id: string, collectionId: string) => ({ id, collectionId }) as CatalogCard;
  const collections: CatalogCollectionFile[] = [
    {
      id: "fondateurs",
      name: "Les Fondateurs",
      back: "night",
      cards: [card("jobard", "fondateurs"), card("poue", "fondateurs")],
    },
    {
      id: "metiers",
      name: "Métiers et objets disparus",
      cards: [card("griviere", "metiers"), card("antitonnerre", "metiers")],
    },
  ];

  it("keeps only the showcased cards, with what the page says around them", () => {
    const showcase = showcaseOf(collections);
    expect(showcase.heroWords.map((found) => found.id)).toEqual(["antitonnerre", "griviere"]);
    expect(
      showcase.ladder.map(({ card: found, collectionName }) => [found.id, collectionName]),
    ).toEqual([["jobard", "Les Fondateurs"]]);
    expect(showcase.shelves).toEqual([
      { id: "fondateurs", name: "Les Fondateurs", count: 2 },
      { id: "metiers", name: "Métiers et objets disparus", count: 2 },
    ]);
    expect(showcase.pack).toEqual({ id: "fondateurs", name: "Les Fondateurs", back: "night" });
    expect(
      showcase.trade.map(({ card: found, collectionName }) => [found.id, collectionName]),
    ).toEqual([
      ["antitonnerre", "Métiers et objets disparus"],
      ["griviere", "Métiers et objets disparus"],
    ]);
  });

  it("shows nothing from an empty catalogue", () => {
    expect(showcaseOf([])).toEqual({
      heroWords: [],
      ladder: [],
      shelves: [],
      pack: null,
      trade: [],
      guess: [],
    });
  });
});
