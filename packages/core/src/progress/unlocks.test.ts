import { describe, expect, it } from "vitest";
import { TRADE_SCHEDULE, UNLOCK_SCHEDULE } from "../rules";
import { featureLevels, featuresOpenedAt } from "./unlocks";

const NOW = Date.UTC(2026, 9, 22);

describe("featureLevels (P59)", () => {
  it("opens each feature at the level of the rules", () => {
    expect(featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, NOW)).toEqual({
      choose_collection: 3,
      trade: 5,
      public_profile: 8,
      trade_three: 10,
      join_clan: 10,
      create_clan: 15,
      jousts: 15,
    });
  });

  it("reads the trade levels from the trade rules", () => {
    const before = featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, Date.UTC(2026, 0, 1));
    // Before P59, three cards per side from the first trade.
    expect(before.trade).toBe(5);
    expect(before.trade_three).toBe(5);
  });
});

describe("featuresOpenedAt", () => {
  it("lists what a level opens", () => {
    const levels = featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, NOW);
    expect(featuresOpenedAt(levels, 10)).toEqual(["trade_three", "join_clan"]);
    expect(featuresOpenedAt(levels, 4)).toEqual([]);
  });
});
