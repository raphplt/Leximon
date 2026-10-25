import { describe, expect, it } from "vitest";
import { packShapeFromSearch } from "./pack-shape";

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
