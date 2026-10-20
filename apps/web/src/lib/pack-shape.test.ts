import { describe, expect, it } from "vitest";
import { choosePackShape, countPacks, PACK_NOUNS, packShapeFromSearch } from "./pack-shape";

describe("packShapeFromSearch", () => {
  it("reads a preview from the address", () => {
    expect(packShapeFromSearch("?paquet=sachet")).toBe("sachet");
    expect(packShapeFromSearch("?x=1&paquet=pli")).toBe("pli");
  });

  it("ignores anything else", () => {
    expect(packShapeFromSearch("")).toBeNull();
    expect(packShapeFromSearch("?paquet=boite")).toBeNull();
  });
});

describe("choosePackShape", () => {
  it("prefers a preview, then the player's variant, then the fold", () => {
    expect(choosePackShape("pli", { "pack-shape": "sachet" })).toBe("pli");
    expect(choosePackShape(null, { "pack-shape": "sachet" })).toBe("sachet");
    expect(choosePackShape(null, { "pack-shape": "carton" })).toBe("pli");
    expect(choosePackShape(null, null)).toBe("pli");
  });
});

describe("countPacks", () => {
  it("agrees the noun with the count", () => {
    expect(countPacks(1, PACK_NOUNS.sachet)).toBe("1 sachet");
    expect(countPacks(3, PACK_NOUNS.pli)).toBe("3 plis");
  });
});
