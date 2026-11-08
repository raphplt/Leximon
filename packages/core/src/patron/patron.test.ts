import { describe, expect, it } from "vitest";
import { PATRON_SCHEDULE } from "../rules";
import {
  claimableCosmetics,
  FOUNDER_TITLE,
  isFoundingPayment,
  monthCosmetic,
  PATRON_TITLE,
  paidMonths,
  parisMonthOf,
  patronMark,
  patronRulesAt,
  patronStanding,
  patronTitle,
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
  const rules = {
    startsAt: 0,
    trialDays: 14,
    prices: { monthly: 399, yearly: 2999 },
    foundingMonth: "2027-01",
    cosmetics: {},
  };

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

describe("the mark and the title", () => {
  it("keep the founder's mark for life, the title while subscribed", () => {
    expect(patronMark("none", true)).toBe("founder");
    expect(patronTitle("none", true)).toBeNull();
    expect(patronTitle("patron", true)).toBe(FOUNDER_TITLE);
  });

  it("show a patron during the trial, and nobody after", () => {
    expect(patronMark("trial", false)).toBe("patron");
    expect(patronTitle("trial", false)).toBe(PATRON_TITLE);
    expect(patronMark("none", false)).toBeNull();
  });
});

describe("cosmetics of the month", () => {
  const frame = { kind: "frame", frame: "cadeler" } as const;
  const avatar = { kind: "avatar", avatar: "lucubrateur" } as const;
  const rules = {
    startsAt: 0,
    trialDays: 14,
    prices: { monthly: 399, yearly: 2999 },
    foundingMonth: null,
    cosmetics: { "2027-01": frame, "2027-02": avatar, "2027-03": frame },
  };
  const at = (iso: string) => Date.parse(iso);
  const monthly = (start: string, end: string) => ({
    startsAt: at(start),
    endsAt: at(end),
    refunded: false,
  });

  it("go to the months a payment covers, at least one day of each", () => {
    const periods = [monthly("2027-01-20T10:00:00Z", "2027-02-20T10:00:00Z")];
    const now = at("2027-02-25T10:00:00Z");
    expect([...paidMonths(periods, now)]).toEqual(["2027-01", "2027-02"]);
    expect(claimableCosmetics(rules, periods, new Set(), now).map((c) => c.month)).toEqual([
      "2027-01",
      "2027-02",
    ]);
  });

  it("come one month at a time for a yearly subscriber, never ahead", () => {
    const periods = [monthly("2027-01-10T10:00:00Z", "2028-01-10T10:00:00Z")];
    const claimable = claimableCosmetics(rules, periods, new Set(), at("2027-02-01T10:00:00Z"));
    expect(claimable).toEqual([
      { month: "2027-01", cosmetic: frame },
      { month: "2027-02", cosmetic: avatar },
    ]);
  });

  it("are claimed once, and not for a refunded payment", () => {
    const now = at("2027-01-25T10:00:00Z");
    const paid = monthly("2027-01-20T10:00:00Z", "2027-02-20T10:00:00Z");
    expect(claimableCosmetics(rules, [paid], new Set(["2027-01"]), now)).toEqual([]);
    expect(claimableCosmetics(rules, [{ ...paid, refunded: true }], new Set(), now)).toEqual([]);
  });

  it("do not count a period ending at midnight into the next month", () => {
    const periods = [monthly("2027-01-01T00:00:00+01:00", "2027-02-01T00:00:00+01:00")];
    expect([...paidMonths(periods, at("2027-03-10T10:00:00Z"))]).toEqual(["2027-01"]);
  });

  it("show this month's cosmetic to everyone, none ahead", () => {
    expect(monthCosmetic(rules, at("2027-02-01T00:30:00+01:00"))?.cosmetic).toEqual(avatar);
    expect(monthCosmetic(rules, at("2027-04-01T10:00:00Z"))).toBeNull();
  });
});
