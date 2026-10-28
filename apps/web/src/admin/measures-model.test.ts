import type { MeasuresCohort } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  change,
  cohortTable,
  presetOf,
  presetRange,
  retentionCurve,
  retentionOn,
  total,
  weekOf,
} from "./measures-model";

function cohort(day: string, players: number, back: Record<number, number> = {}): MeasuresCohort {
  const days = Array.from({ length: 31 }, (_, offset) => back[offset] ?? 0);
  days[0] = players;
  return { day, players, back: days };
}

describe("presets", () => {
  it("ends today and starts the right number of days before", () => {
    expect(presetRange("7", "2026-10-28", null)).toEqual({ from: "2026-10-22", to: "2026-10-28" });
    expect(presetRange("all", "2026-10-28", "2026-10-19")).toEqual({
      from: "2026-10-19",
      to: "2026-10-28",
    });
  });

  it("recognizes a preset range, and none for a custom one", () => {
    expect(presetOf({ from: "2026-09-29", to: "2026-10-28" }, "2026-10-28", null)).toBe("30");
    expect(presetOf({ from: "2026-10-01", to: "2026-10-20" }, "2026-10-28", null)).toBeNull();
  });
});

describe("totals", () => {
  it("adds up a metric over the range only, and compares with the period before", () => {
    const day = (date: string, boosters: number) => ({
      day: date,
      active: 0,
      arrived: 0,
      boosters,
      answers: 0,
      accounts: 0,
    });
    const days = [day("2026-10-26", 4), day("2026-10-27", 2), day("2026-10-28", 3)];

    expect(total(days, "boosters", { from: "2026-10-27", to: "2026-10-28" })).toBe(5);
    expect(change(5, 4)).toBeCloseTo(0.25);
    expect(change(5, 0)).toBeNull();
  });
});

describe("retention", () => {
  const range = { from: "2026-10-20", to: "2026-10-28" };

  it("counts a day only for cohorts that reached it", () => {
    const cohorts = [
      cohort("2026-10-20", 4, { 1: 2, 7: 1 }),
      // Arrived yesterday: counts for J1 only.
      cohort("2026-10-27", 6, { 1: 3 }),
      // Outside the range.
      cohort("2026-10-10", 10, { 1: 10 }),
    ];

    expect(retentionOn(cohorts, range, 1, "2026-10-28")).toEqual({ players: 5, eligible: 10 });
    expect(retentionOn(cohorts, range, 7, "2026-10-28")).toEqual({ players: 1, eligible: 4 });
    expect(retentionCurve(cohorts, range, 2, "2026-10-28")).toEqual([
      { players: 5, eligible: 10 },
      { players: 0, eligible: 4 },
    ]);
  });

  it("groups cohorts by week, newest first", () => {
    const cohorts = [
      cohort("2026-10-20", 4, { 1: 2 }),
      cohort("2026-10-22", 2, { 1: 1 }),
      cohort("2026-10-27", 6, { 1: 3 }),
    ];

    expect(weekOf("2026-10-25")).toBe("2026-10-19");
    expect(cohortTable(cohorts, range, "week", [1, 7], "2026-10-28")).toEqual([
      {
        key: "2026-10-26",
        players: 6,
        rates: [
          { players: 3, eligible: 6 },
          { players: 0, eligible: 0 },
        ],
      },
      {
        key: "2026-10-19",
        players: 6,
        rates: [
          { players: 3, eligible: 6 },
          { players: 0, eligible: 4 },
        ],
      },
    ]);
  });
});
