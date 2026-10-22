import { describe, expect, it } from "vitest";
import { formatCount, formatWait, ofName, plural } from "./format";

describe("formats", () => {
  it("groups thousands the French way", () => {
    expect(formatCount(1240)).toBe("1 240");
    expect(formatCount(12)).toBe("12");
  });

  it("pluralizes from 2", () => {
    expect(plural(1, "coffret", "coffrets")).toBe("1 coffret");
    expect(plural(3, "coffret", "coffrets")).toBe("3 coffrets");
  });

  it("rounds a wait up to the minute, never down to zero", () => {
    expect(formatWait(0)).toBe("1 min");
    expect(formatWait(17 * 60_000 + 1)).toBe("18 min");
    expect(formatWait(125 * 60_000)).toBe("2 h 05");
  });
});

describe("ofName", () => {
  it("contracts « de » with the collection's article", () => {
    expect(ofName("Les Fondateurs")).toBe("des Fondateurs");
    expect(ofName("Le Grenier")).toBe("du Grenier");
    expect(ofName("Caractères et travers")).toBe("de Caractères et travers");
  });
});
