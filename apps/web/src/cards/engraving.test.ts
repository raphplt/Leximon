import type { CatalogCard } from "@leximon/contract";
import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  creditLine,
  cssUrl,
  ENGRAVING_SLOT,
  engravingBox,
  engravingOf,
  hasPlate,
  isTall,
  safeSourceUrl,
} from "./engraving";

const engraving = {
  ink: "gravures/talpinette.ink.webp",
  fill: "gravures/talpinette.fill.webp",
  width: 400,
  height: 300,
  credit: "Gravure sur bois, XIXe s. · Wellcome Collection",
  sourceUrl: "https://wellcomecollection.org/works/abc",
  licence: "CC BY 4.0",
};

const card: CatalogCard = {
  id: "talpinette",
  word: "talpinette",
  partOfSpeech: "n. f.",
  era: null,
  definition: "Petite taupe.",
  etymology: null,
  quote: null,
  rarity: "rare",
  collectionId: "fondateurs",
  themes: [],
  perBillion: null,
};

describe("engravingOf", () => {
  it("treats a catalogue without the field as a card without engraving", () => {
    expect(engravingOf(card)).toBeNull();
    expect(engravingOf({ ...card, engraving: null })).toBeNull();
    expect(engravingOf({ ...card, engraving })).toBe(engraving);
  });
});

describe("isTall", () => {
  it("lets only clearly upright subjects break out", () => {
    expect(isTall({ width: 253, height: 450 })).toBe(true);
    expect(isTall({ width: 84, height: 100 })).toBe(true);
    expect(isTall({ width: 85, height: 100 })).toBe(false);
    expect(isTall({ width: 100, height: 100 })).toBe(false);
    expect(isTall({ width: 774, height: 357 })).toBe(false);
  });
});

describe("hasPlate", () => {
  it("prints the colour plate from Rare upward only", () => {
    expect(RARITIES.filter(hasPlate)).toEqual(["rare", "precious", "epic", "legendary"]);
  });
});

describe("engravingBox", () => {
  it("contains a wide subject in the slot", () => {
    const wide = engravingBox({ width: 900, height: 300 });
    expect(wide.tall).toBe(false);
    expect(wide.width).toBeCloseTo(ENGRAVING_SLOT.width);
    expect(wide.height).toBeLessThan(ENGRAVING_SLOT.height);
  });

  it("fills the slot height for a subject a bit wider than high", () => {
    const box = engravingBox({ width: 362, height: 320 });
    expect(box.tall).toBe(false);
    expect(box.height).toBeCloseTo(ENGRAVING_SLOT.height);
    expect(box.width).toBeLessThanOrEqual(ENGRAVING_SLOT.width);
  });

  it("gives a tall subject more height than the slot, never more width", () => {
    const tall = engravingBox({ width: 253, height: 450 });
    expect(tall.tall).toBe(true);
    expect(tall.height).toBeGreaterThan(ENGRAVING_SLOT.height);
    expect(tall.width).toBeLessThan(ENGRAVING_SLOT.width / 2);
  });

  it("keeps the aspect ratio", () => {
    for (const size of [
      { width: 253, height: 450 },
      { width: 500, height: 450 },
      { width: 1000, height: 100 },
    ]) {
      const box = engravingBox(size);
      expect(box.width / box.height).toBeCloseTo(size.width / size.height);
    }
  });
});

describe("cssUrl", () => {
  it("quotes a plain path", () => {
    expect(cssUrl("/catalog/gravures/a.ink.webp")).toBe('url("/catalog/gravures/a.ink.webp")');
  });

  it("escapes what could close the url", () => {
    expect(cssUrl('/a"b\\c\nd')).toBe('url("/a\\22 b\\5c c\\a d")');
  });
});

describe("credits", () => {
  it("shows the catalogue's credit line as it is: it already names the licence", () => {
    expect(creditLine(engraving)).toBe(engraving.credit);
  });

  it("links only to web addresses", () => {
    expect(safeSourceUrl(engraving)).toBe("https://wellcomecollection.org/works/abc");
    expect(safeSourceUrl({ sourceUrl: "javascript:alert(1)" })).toBeNull();
    expect(safeSourceUrl({ sourceUrl: "pas une adresse" })).toBeNull();
  });
});
