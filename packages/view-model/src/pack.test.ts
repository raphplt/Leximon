import { describe, expect, it } from "vitest";
import { countPacks, PACK_NOUNS } from "./pack";

describe("countPacks", () => {
  it("agrees the noun with the count", () => {
    expect(countPacks(1, PACK_NOUNS.sachet)).toBe("1 sachet");
    expect(countPacks(3, PACK_NOUNS.pli)).toBe("3 plis");
  });
});
