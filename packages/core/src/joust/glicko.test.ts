import { describe, expect, it } from "vitest";
import { type GlickoRules, idleRating, rateGlicko } from "./glicko";

const rules: GlickoRules = {
  initial: { rating: 1500, deviation: 350, volatility: 0.06 },
  tau: 0.5,
  periodDays: 7,
};

describe("rateGlicko", () => {
  it("matches the worked example of Glickman's paper", () => {
    const next = rateGlicko(rules, { rating: 1500, deviation: 200, volatility: 0.06 }, [
      { opponent: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.deviation).toBeCloseTo(151.52, 1);
    expect(next.volatility).toBeCloseTo(0.05999, 4);
  });

  it("moves a new player a lot, and a settled one a little", () => {
    const opponent = { rating: 1500, deviation: 60, volatility: 0.06 };
    const fresh = rateGlicko(rules, rules.initial, [{ opponent, score: 1 }]);
    const settled = rateGlicko(rules, { rating: 1500, deviation: 60, volatility: 0.06 }, [
      { opponent, score: 1 },
    ]);
    expect(fresh.rating - 1500).toBeGreaterThan(150);
    expect(settled.rating - 1500).toBeLessThan(20);
    expect(settled.rating).toBeGreaterThan(1500);
  });

  it("is symmetric between the winner and the loser of an even game", () => {
    const a = { rating: 1500, deviation: 120, volatility: 0.06 };
    const won = rateGlicko(rules, a, [{ opponent: a, score: 1 }]);
    const lost = rateGlicko(rules, a, [{ opponent: a, score: 0 }]);
    expect(won.rating - 1500).toBeCloseTo(1500 - lost.rating, 6);
  });

  it("never lets the deviation exceed a new player's", () => {
    const next = rateGlicko(rules, rules.initial, [
      { opponent: { rating: 2400, deviation: 30, volatility: 0.06 }, score: 1 },
    ]);
    expect(next.deviation).toBeLessThanOrEqual(350);
  });
});

describe("idleRating", () => {
  const settled = { rating: 1620, deviation: 50, volatility: 0.06 };

  it("grows the deviation once per full period without games", () => {
    expect(idleRating(rules, settled, 6)).toEqual(settled);
    const week = idleRating(rules, settled, 7);
    const month = idleRating(rules, settled, 30);
    expect(week.deviation).toBeGreaterThan(50);
    expect(month.deviation).toBeGreaterThan(week.deviation);
    expect(month.rating).toBe(1620);
  });

  it("stops at a new player's deviation", () => {
    expect(idleRating(rules, settled, 365 * 50).deviation).toBe(350);
  });
});
