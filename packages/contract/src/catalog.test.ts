import { describe, expect, it } from "vitest";
import { catalogCardSchema, catalogManifestSchema } from "./catalog";

const card = {
  id: "poelonnee",
  word: "poêlonnée",
  partOfSpeech: "n. f.",
  era: null,
  definition: "Contenu d'un poêlon.",
  etymology: "De poêlon.",
  quote: {
    text: "J'en mis une autre dans une poêlonnée d'eau chaude",
    author: "Madame de Sévigné",
  },
  rarity: "precious",
  collectionId: "fondateurs",
  themes: ["cuisine"],
  perBillion: 0.052,
};

const engraving = {
  ink: "gravures/poelonnee.0123456789ab.ink.webp",
  fill: "gravures/poelonnee.ba9876543210.fill.webp",
  width: 364,
  height: 480,
  credit: "D'après Albrecht Dürer, 1514 · Wikimedia Commons (domaine public)",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Saint_Jerome_in_his_Study_(SM_31371d).png",
  licence: "domaine public",
};

describe("catalogue contract", () => {
  it("accepts a card", () => {
    expect(catalogCardSchema.parse(card)).toEqual(card);
  });

  it("accepts a card with an engraving, or with none", () => {
    expect(catalogCardSchema.parse({ ...card, engraving })).toEqual({ ...card, engraving });
    expect(catalogCardSchema.parse({ ...card, engraving: null }).engraving).toBeNull();
  });

  it("still reads a card published before engravings", () => {
    expect(catalogCardSchema.parse(card).engraving ?? null).toBeNull();
  });

  it.each([
    ["a path out of the folder", { ink: "gravures/../manifest.json" }],
    ["a nested path", { fill: "gravures/a/b.webp" }],
    ["another folder", { ink: "collections/poelonnee.webp" }],
    ["a quote in the path", { ink: 'gravures/a").webp' }],
    ["a plain-http source", { sourceUrl: "http://commons.wikimedia.org/wiki/File:X.jpg" }],
    ["a script source", { sourceUrl: "javascript:alert(1)" }],
    ["a zero size", { width: 0 }],
  ])("rejects an engraving with %s", (_case, override) => {
    expect(
      catalogCardSchema.safeParse({ ...card, engraving: { ...engraving, ...override } }).success,
    ).toBe(false);
  });

  it("rejects a card whose id is not a slug", () => {
    expect(catalogCardSchema.safeParse({ ...card, id: "poêlonnée" }).success).toBe(false);
  });

  it("only accepts hashed collection files in the manifest", () => {
    const manifest = {
      schemaVersion: 1,
      version: "2026-10-19.1",
      releasedAt: "2026-10-19T20:00:00.000Z",
      collections: [
        {
          id: "fondateurs",
          name: "Les Fondateurs",
          cardCount: 1,
          file: "collections/fondateurs.0123456789ab.json",
        },
      ],
    };
    expect(catalogManifestSchema.safeParse(manifest).success).toBe(true);
    const unhashed = {
      ...manifest,
      collections: [{ ...manifest.collections[0], file: "collections/fondateurs.json" }],
    };
    expect(catalogManifestSchema.safeParse(unhashed).success).toBe(false);
  });
});
