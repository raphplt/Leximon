import { describe, expect, it } from "vitest";
import { compareProportions } from "./stats";

describe("compareProportions", () => {
  it("finds no difference between identical rates", () => {
    const result = compareProportions({ successes: 50, total: 100 }, { successes: 50, total: 100 });
    expect(result.difference).toBe(0);
    expect(result.pValue).toBeCloseTo(1, 5);
  });

  it("matches a textbook case: 45 % against 55 % on 1,000 players each", () => {
    // z = 0.1 / sqrt(0.5 * 0.5 * 2 / 1000) = 4.47, p ≈ 7.7e-6.
    const result = compareProportions(
      { successes: 450, total: 1000 },
      { successes: 550, total: 1000 },
    );
    expect(result.difference).toBeCloseTo(0.1, 10);
    expect(result.pValue).toBeGreaterThan(5e-6);
    expect(result.pValue).toBeLessThan(1e-5);
  });

  it("calls a small gap on few players chance", () => {
    const result = compareProportions({ successes: 10, total: 40 }, { successes: 13, total: 40 });
    expect(result.pValue).toBeGreaterThan(0.3);
  });

  it("has nothing to say without players", () => {
    expect(
      compareProportions({ successes: 0, total: 0 }, { successes: 3, total: 10 }).pValue,
    ).toBeNull();
  });
});
