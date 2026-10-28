import { describe, expect, it } from "vitest";
import { addDays, cohortsFrom, daysBetween, resolvePeriod, retentionBy, weekOf } from "./retention";

describe("retention", () => {
  it("counts a day only for players who reached it", () => {
    const players = [
      { firstDay: "2026-11-02", d1: true, d7: true, d30: false, group: "a" },
      { firstDay: "2026-11-02", d1: false, d7: false, d30: false, group: "a" },
      // Arrived yesterday: counts for J1 only.
      { firstDay: "2026-11-09", d1: true, d7: false, d30: false, group: "a" },
      { firstDay: "2026-11-10", d1: false, d7: false, d30: false, group: "b" },
    ];

    const rows = retentionBy(players, (player) => player.group, "2026-11-10");

    expect(rows).toEqual([
      {
        key: "a",
        players: 3,
        d1: { players: 2, eligible: 3 },
        d7: { players: 1, eligible: 2 },
        d30: { players: 0, eligible: 0 },
      },
      {
        key: "b",
        players: 1,
        d1: { players: 0, eligible: 0 },
        d7: { players: 0, eligible: 0 },
        d30: { players: 0, eligible: 0 },
      },
    ]);
  });

  it("finds the Monday of a week and counts days across months", () => {
    expect(weekOf("2026-11-08")).toBe("2026-11-02");
    expect(weekOf("2026-11-02")).toBe("2026-11-02");
    expect(daysBetween("2026-10-31", "2026-11-30")).toBe(30);
  });
});

describe("measures period", () => {
  it("covers the last 30 days by default, with the 30 before for comparison", () => {
    expect(resolvePeriod({}, "2026-10-28", 366)).toEqual({
      from: "2026-09-29",
      to: "2026-10-28",
      previousFrom: "2026-08-30",
      previousTo: "2026-09-28",
    });
  });

  it("stops at today and compares with a period of the same length", () => {
    expect(resolvePeriod({ from: "2026-10-26", to: "2026-12-01" }, "2026-10-28", 366)).toEqual({
      from: "2026-10-26",
      to: "2026-10-28",
      previousFrom: "2026-10-23",
      previousTo: "2026-10-25",
    });
  });

  it("refuses reversed bounds and too long a period", () => {
    expect(resolvePeriod({ from: "2026-10-20", to: "2026-10-10" }, "2026-10-28", 366)).toBeNull();
    expect(resolvePeriod({ from: "2024-01-01" }, "2026-10-28", 366)).toBeNull();
  });

  it("moves across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("cohorts", () => {
  it("lays each cohort's returns by day, missing days at zero", () => {
    const cohorts = cohortsFrom(
      [
        { day: "2026-10-27", offset: 0, players: 2 },
        { day: "2026-10-26", offset: 0, players: 5 },
        { day: "2026-10-26", offset: 2, players: 1 },
        { day: "2026-10-26", offset: 9, players: 3 },
      ],
      4,
    );

    expect(cohorts).toEqual([
      { day: "2026-10-26", players: 5, back: [5, 0, 1, 0] },
      { day: "2026-10-27", players: 2, back: [2, 0, 0, 0] },
    ]);
  });
});
