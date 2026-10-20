import { describe, expect, it } from "vitest";
import { packShapeFromSearch } from "./pack-shape";

describe("packShapeFromSearch", () => {
  it("shows the shape asked for in the address", () => {
    expect(packShapeFromSearch("?paquet=sachet")).toBe("sachet");
    expect(packShapeFromSearch("?x=1&paquet=pli")).toBe("pli");
  });

  it("falls back to the fold", () => {
    expect(packShapeFromSearch("")).toBe("pli");
    expect(packShapeFromSearch("?paquet=boite")).toBe("pli");
  });
});
