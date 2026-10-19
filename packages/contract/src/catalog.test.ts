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

describe("catalogue contract", () => {
  it("accepts a card", () => {
    expect(catalogCardSchema.parse(card)).toEqual(card);
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
