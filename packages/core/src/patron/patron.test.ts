import { describe, expect, it } from "vitest";
import { PATRON_SCHEDULE } from "../rules";
import {
  isFoundingPayment,
  parisMonthOf,
  patronRulesAt,
  patronStanding,
  type SubscriptionStatus,
} from "./patron";

const PAID = Date.parse("2027-01-20T10:00:00Z");

describe("patron standing", () => {
  it("is a trial while Stripe counts the free days", () => {
    expect(patronStanding("trialing", null)).toBe("trial");
  });

  it("makes a patron once a payment went through", () => {
    expect(patronStanding("active", PAID)).toBe("patron");
  });

  it("keeps a patron whose renewal is being retried", () => {
    expect(patronStanding("past_due", PAID)).toBe("patron");
  });

  it("keeps a trial whose first payment is being retried", () => {
    expect(patronStanding("past_due", null)).toBe("trial");
  });

  it("gives nothing once the subscription ended or never started", () => {
    const ended: SubscriptionStatus[] = [
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ];
    for (const status of ended) expect(patronStanding(status, PAID)).toBe("none");
    expect(patronStanding(null, null)).toBe("none");
  });
});

describe("Paris months", () => {
  it("follow Paris, not UTC, at the turn of a month", () => {
    expect(parisMonthOf(Date.parse("2027-01-31T23:30:00Z"))).toBe("2027-02");
    expect(parisMonthOf(Date.parse("2027-01-31T22:30:00Z"))).toBe("2027-01");
  });

  it("follow summer time", () => {
    expect(parisMonthOf(Date.parse("2027-06-30T22:30:00Z"))).toBe("2027-07");
  });
});

describe("founders", () => {
  const rules = { startsAt: 0, trialDays: 14, foundingMonth: "2027-01" };

  it("are those who first pay within the founding month", () => {
    expect(isFoundingPayment(rules, PAID)).toBe(true);
    expect(isFoundingPayment(rules, Date.parse("2027-02-01T10:00:00Z"))).toBe(false);
  });

  it("do not exist before the founding month is set", () => {
    expect(isFoundingPayment({ ...rules, foundingMonth: null }, PAID)).toBe(false);
  });

  it("start with no founding month and fourteen free days", () => {
    const current = patronRulesAt(PATRON_SCHEDULE, Date.now());
    expect(current.trialDays).toBe(14);
    expect(current.foundingMonth).toBeNull();
  });
});
