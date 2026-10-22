import { describe, expect, it } from "vitest";
import { daysBetween, retentionBy, weekOf } from "./retention";

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
