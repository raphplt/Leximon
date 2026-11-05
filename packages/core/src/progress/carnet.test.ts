import { describe, expect, it } from "vitest";
import { CARNET_SCHEDULE } from "../rules";
import {
  type CarnetRules,
  carnetPages,
  carnetPeriodOf,
  carnetRewards,
  carnetRulesAt,
  nextCarnetCase,
} from "./carnet";
import { rewardEcus, rewardReserve } from "./rewards";

const rules: CarnetRules = {
  startsAt: 0,
  firstPeriodDay: "2026-11-09",
  periodDays: 28,
  cases: Array.from({ length: 28 }, () => [{ kind: "ecus", amount: 10 }]),
};

describe("carnetPeriodOf", () => {
  it("cuts time in periods of 28 days from the first one", () => {
    expect(carnetPeriodOf(rules, "2026-11-09")).toEqual({
      index: 0,
      firstDay: "2026-11-09",
      lastDay: "2026-12-06",
    });
    expect(carnetPeriodOf(rules, "2026-12-07").index).toBe(1);
    expect(carnetPeriodOf(rules, "2026-11-08")).toEqual({
      index: -1,
      firstDay: "2026-10-12",
      lastDay: "2026-11-08",
    });
  });
});

describe("carnetPages", () => {
  it("is empty while the welcome week goes on", () => {
    expect(carnetPages(rules, null, new Set(["2026-11-10"]), [], "2026-11-10")).toEqual([]);
  });

  it("counts the days played after the welcome week, not the day it ended", () => {
    const played = new Set(["2026-11-09", "2026-11-10", "2026-11-12"]);
    const pages = carnetPages(rules, "2026-11-09", played, [], "2026-11-12");
    expect(pages.map((page) => [page.period.index, page.earned, page.claimed])).toEqual([
      [0, 2, 0],
    ]);
  });

  it("keeps a page of an ended period with its cases still to claim", () => {
    const played = new Set(["2026-12-05", "2026-12-06", "2026-12-07"]);
    const pages = carnetPages(rules, "2026-11-20", played, [{ period: 0, case: 1 }], "2026-12-07");
    expect(pages.map((page) => [page.period.index, page.earned, page.claimed])).toEqual([
      [0, 2, 1],
      [1, 1, 0],
    ]);
    expect(nextCarnetCase(pages)).toEqual({ period: 0, case: 2 });
  });

  it("fills at most every case of a page", () => {
    const played = new Set(
      Array.from({ length: 28 }, (_, n) => `2026-11-${String(9 + (n % 22)).padStart(2, "0")}`),
    );
    const many = new Set([...played, "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
    const [page] = carnetPages(rules, "2026-11-01", many, [], "2026-12-06");
    expect(page?.earned).toBeLessThanOrEqual(28);
  });

  it("has nothing to claim once every case earned is claimed", () => {
    const pages = carnetPages(
      rules,
      "2026-11-09",
      new Set(["2026-11-10"]),
      [{ period: 0, case: 1 }],
      "2026-11-10",
    );
    expect(nextCarnetCase(pages)).toBeNull();
  });
});

describe("the carnet in force", () => {
  const live = carnetRulesAt(CARNET_SCHEDULE, Date.UTC(2026, 10, 9));

  it("has a case per day of a period", () => {
    expect(live.cases).toHaveLength(live.periodDays);
  });

  it("gives sachets on the days the rules name, écus on the others", () => {
    const of = (n: number) => carnetRewards(live, n);
    expect([3, 10, 17, 24].map((n) => rewardReserve(of(n)))).toEqual(
      Array(4).fill({ bonus: 1, garni: 0, precious: 0 }),
    );
    expect([7, 14, 21].map((n) => rewardReserve(of(n)))).toEqual(
      Array(3).fill({ bonus: 1, garni: 1, precious: 0 }),
    );
    expect(rewardReserve(of(28))).toEqual({ bonus: 1, garni: 1, precious: 1 });
    expect(rewardEcus(of(1))).toBe(10);
    expect(of(29)).toEqual([]);
  });
});
