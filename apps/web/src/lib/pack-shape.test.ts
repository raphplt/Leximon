import { describe, expect, it } from "vitest";
import { countPacks, PACK_NOUNS, packShapeFromSearch } from "./pack-shape";

describe("packShapeFromSearch", () => {
  it("reads the shape to try from the address", () => {
    expect(packShapeFromSearch("?paquet=sachet")).toBe("sachet");
    expect(packShapeFromSearch("?x=1&paquet=pli")).toBe("pli");
  });

  it("ignores anything else", () => {
    expect(packShapeFromSearch("")).toBeNull();
    expect(packShapeFromSearch("?paquet=boite")).toBeNull();
  });
});

describe("countPacks", () => {
  it("agrees the noun with the count", () => {
    expect(countPacks(1, PACK_NOUNS.sachet)).toBe("1 sachet");
    expect(countPacks(3, PACK_NOUNS.pli)).toBe("3 plis");
  });
});
