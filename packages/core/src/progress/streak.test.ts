import { describe, expect, it } from "vitest";
import { STREAK_SCHEDULE } from "../rules";
import { streakOf, streakRulesAt } from "./streak";

const rules = streakRulesAt(STREAK_SCHEDULE, Date.UTC(2026, 10, 5));
const days = (...keys: string[]) => new Set(keys);

describe("streakOf", () => {
  it("counts the days played in a row, today included once played", () => {
    expect(streakOf(rules, days("2026-11-02", "2026-11-03", "2026-11-04"), "2026-11-04")).toEqual({
      current: 3,
      total: 3,
      playedToday: true,
    });
    expect(streakOf(rules, days("2026-11-02", "2026-11-03"), "2026-11-04")).toEqual({
      current: 2,
      total: 2,
      playedToday: false,
    });
  });

  it("forgives two missed days a week, not a third", () => {
    // Monday 2 to Sunday 8 November 2026.
    const two = days("2026-11-02", "2026-11-05", "2026-11-06");
    expect(streakOf(rules, two, "2026-11-06").current).toBe(3);
    const three = days("2026-11-02", "2026-11-06");
    expect(streakOf(rules, three, "2026-11-06")).toEqual({
      current: 1,
      total: 2,
      playedToday: true,
    });
  });

  it("forgives again in a new week", () => {
    // Sunday 1 November, two missed days that week (30 and 31 October), then two more the next.
    const played = days("2026-10-28", "2026-10-29", "2026-11-01", "2026-11-04", "2026-11-05");
    expect(streakOf(rules, played, "2026-11-05").current).toBe(5);
  });

  it("starts at nothing and keeps the total after a long absence", () => {
    expect(streakOf(rules, days(), "2026-11-04")).toEqual({
      current: 0,
      total: 0,
      playedToday: false,
    });
    const old = days("2026-10-01", "2026-10-02");
    expect(streakOf(rules, old, "2026-11-04")).toEqual({
      current: 0,
      total: 2,
      playedToday: false,
    });
  });
});
