import { describe, expect, it } from "vitest";
import { fixedSchedule } from "../booster/refill";
import { BONUS_SCHEDULE } from "../rules";
import {
  type AnswerBonusInput,
  answerBonuses,
  type BonusRules,
  bonusRulesAt,
  creditReserve,
  gameDayOf,
  meetsDailyGoal,
  reserveCapacity,
  takeBooster,
} from "./bonus";

const rules: BonusRules = {
  startsAt: 0,
  dailyGoal: { answers: 5, correct: 3 },
  dailyReward: 1,
  gildedReward: 1,
  reserveCap: 10,
};

const iso = (value: string) => Date.parse(value);

describe("bonus rules", () => {
  it("start with the owner's values", () => {
    expect(bonusRulesAt(BONUS_SCHEDULE, Date.now())).toMatchObject({
      dailyGoal: { answers: 5, correct: 3 },
      dailyReward: 1,
      gildedReward: 1,
      reserveCap: 10,
    });
  });

  it("apply the period in force at the time of the event", () => {
    const later: BonusRules = { ...rules, startsAt: 1_000, reserveCap: 5 };
    expect(bonusRulesAt([rules, later], 999).reserveCap).toBe(10);
    expect(bonusRulesAt([rules, later], 1_000).reserveCap).toBe(5);
  });
});

describe("gameDayOf", () => {
  it("follows the calendar day in Paris", () => {
    expect(gameDayOf(iso("2026-10-20T12:00:00Z"))).toEqual({
      key: "2026-10-20",
      start: iso("2026-10-19T22:00:00Z"),
      end: iso("2026-10-20T22:00:00Z"),
    });
    expect(gameDayOf(iso("2026-10-19T22:00:00Z")).key).toBe("2026-10-20");
    expect(gameDayOf(iso("2026-10-19T21:59:59.999Z")).key).toBe("2026-10-19");
  });

  it("handles winter time and the turn of the year", () => {
    expect(gameDayOf(iso("2026-12-31T23:30:00Z"))).toEqual({
      key: "2027-01-01",
      start: iso("2026-12-31T23:00:00Z"),
      end: iso("2027-01-01T23:00:00Z"),
    });
  });

  it("gives clock-change days their true length", () => {
    const autumn = gameDayOf(iso("2026-10-25T12:00:00Z"));
    expect(autumn.start).toBe(iso("2026-10-24T22:00:00Z"));
    expect(autumn.end - autumn.start).toBe(25 * 3_600_000);
    const spring = gameDayOf(iso("2026-03-29T12:00:00Z"));
    expect(spring.start).toBe(iso("2026-03-28T23:00:00Z"));
    expect(spring.end - spring.start).toBe(23 * 3_600_000);
  });

  it("contains the instant it is computed from", () => {
    for (
      let time = iso("2026-03-27T00:00:00Z");
      time < iso("2026-03-31T00:00:00Z");
      time += 1_800_000
    ) {
      const day = gameDayOf(time);
      expect(day.start).toBeLessThanOrEqual(time);
      expect(day.end).toBeGreaterThan(time);
    }
  });
});

describe("daily goal", () => {
  it("needs enough answers and enough right ones", () => {
    expect(meetsDailyGoal(rules, { answers: 4, correct: 4 })).toBe(false);
    expect(meetsDailyGoal(rules, { answers: 5, correct: 2 })).toBe(false);
    expect(meetsDailyGoal(rules, { answers: 5, correct: 3 })).toBe(true);
    expect(meetsDailyGoal(rules, { answers: 8, correct: 3 })).toBe(true);
  });
});

describe("answerBonuses", () => {
  const day = gameDayOf(iso("2026-10-20T12:00:00Z"));
  const input: AnswerBonusInput = {
    day,
    tally: { answers: 5, correct: 3 },
    dailyAwarded: false,
    cardId: "galimatias",
    reachedGilded: false,
    gildedAwarded: false,
  };

  it("awards the daily bonus once the goal is met, once a day", () => {
    expect(answerBonuses(rules, input)).toEqual([
      { kind: "daily", awardKey: "2026-10-20", amount: 1 },
    ]);
    expect(answerBonuses(rules, { ...input, dailyAwarded: true })).toEqual([]);
    expect(answerBonuses(rules, { ...input, tally: { answers: 4, correct: 4 } })).toEqual([]);
  });

  it("awards the gilding bonus once per card", () => {
    const gilded = { ...input, tally: { answers: 1, correct: 1 }, reachedGilded: true };
    expect(answerBonuses(rules, gilded)).toEqual([
      { kind: "gilded", awardKey: "galimatias", amount: 1 },
    ]);
    expect(answerBonuses(rules, { ...gilded, gildedAwarded: true })).toEqual([]);
  });

  it("can award both at once, and nothing when a reward is zero", () => {
    expect(answerBonuses(rules, { ...input, reachedGilded: true })).toHaveLength(2);
    expect(
      answerBonuses(
        { ...rules, dailyReward: 0, gildedReward: 0 },
        { ...input, reachedGilded: true },
      ),
    ).toEqual([]);
  });
});

describe("creditReserve", () => {
  const daily = { kind: "daily", awardKey: "2026-10-20", amount: 1 } as const;
  const gilded = { kind: "gilded", awardKey: "galimatias", amount: 1 } as const;

  it("adds awards up to the cap and loses the excess", () => {
    expect(creditReserve(rules.reserveCap, 3, [daily])).toEqual({
      reserve: 4,
      awards: [{ ...daily, credited: 1 }],
    });
    expect(creditReserve(rules.reserveCap, 9, [daily, gilded])).toEqual({
      reserve: 10,
      awards: [
        { ...daily, credited: 1 },
        { ...gilded, credited: 0 },
      ],
    });
    expect(creditReserve(rules.reserveCap, 10, [daily]).reserve).toBe(10);
  });

  it("never takes away what a reserve above a lowered cap holds", () => {
    expect(creditReserve(5, 8, [daily])).toEqual({
      reserve: 8,
      awards: [{ ...daily, credited: 0 }],
    });
  });
});

describe("takeBooster", () => {
  const schedule = fixedSchedule(6, 1_000);
  const reserve = (bonus: number, garni = 0) => ({ bonus, garni });

  it("spends the free stock first", () => {
    const result = takeBooster({ stored: 2, progressMs: 0, asOf: 0 }, reserve(3, 1), schedule, 0);
    expect(result).toMatchObject({
      ok: true,
      reserve: reserve(3, 1),
      fromBonus: false,
      garni: false,
      state: { stored: 1 },
    });
  });

  it("spends the reserve when the free stock is empty, without touching the refill", () => {
    const result = takeBooster({ stored: 0, progressMs: 200, asOf: 0 }, reserve(3), schedule, 500);
    expect(result).toEqual({
      ok: true,
      reserve: reserve(2),
      fromBonus: true,
      garni: false,
      state: { stored: 0, progressMs: 700, asOf: 500, nextRefillAt: 800 },
    });
  });

  it("opens the garni boosters of the reserve first", () => {
    const wallet = { stored: 0, progressMs: 0, asOf: 0 };
    expect(takeBooster(wallet, reserve(3, 2), schedule, 0)).toMatchObject({
      reserve: reserve(2, 1),
      garni: true,
    });
    expect(takeBooster(wallet, reserve(1, 1), schedule, 0)).toMatchObject({
      reserve: reserve(0, 0),
      garni: true,
    });
  });

  it("is empty when both are", () => {
    expect(takeBooster({ stored: 0, progressMs: 0, asOf: 0 }, reserve(0), schedule, 0)).toEqual({
      ok: false,
      reason: "empty",
      nextRefillAt: 1_000,
    });
  });
});

describe("reserveCapacity", () => {
  it("adds the slots won by level to the cap", () => {
    expect(reserveCapacity(rules, 0)).toBe(rules.reserveCap);
    expect(reserveCapacity(rules, 5)).toBe(rules.reserveCap + 5);
  });
});
