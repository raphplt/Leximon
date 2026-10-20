import { describe, expect, it } from "vitest";
import { GUEST_SCHEDULE } from "../rules";
import { type GuestSchedule, guestBoostersLeft, guestRulesAt } from "./guest-limit";

describe("guestBoostersLeft", () => {
  const rules = { startsAt: 0, boostersBeforeSignup: 2 };

  it("counts down the boosters a guest may open", () => {
    expect(guestBoostersLeft(rules, 0)).toBe(2);
    expect(guestBoostersLeft(rules, 1)).toBe(1);
    expect(guestBoostersLeft(rules, 2)).toBe(0);
  });

  it("never goes below zero for a guest that opened more under older rules", () => {
    expect(guestBoostersLeft(rules, 5)).toBe(0);
  });
});

describe("guestRulesAt", () => {
  it("applies the period in force at the time of the open", () => {
    const schedule: GuestSchedule = [
      { startsAt: 0, boostersBeforeSignup: 2 },
      { startsAt: 1_000, boostersBeforeSignup: 3 },
    ];
    expect(guestRulesAt(schedule, 999).boostersBeforeSignup).toBe(2);
    expect(guestRulesAt(schedule, 1_000).boostersBeforeSignup).toBe(3);
  });

  it("lets a guest open two boosters at launch (P37)", () => {
    expect(guestRulesAt(GUEST_SCHEDULE, Date.now()).boostersBeforeSignup).toBe(2);
  });
});
