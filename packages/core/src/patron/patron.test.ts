import { describe, expect, it } from "vitest";
import { PATRON_SCHEDULE } from "../rules";
import {
  cardEditionOf,
  claimableCosmetics,
  earnedFinds,
  FOUNDER_TITLE,
  findsLeft,
  isFoundingPayment,
  monthCosmetic,
  ownedEditions,
  PATRON_TITLE,
  paidMonths,
  parisMonthOf,
  patronMark,
  patronRulesAt,
  patronStanding,
  patronTitle,
  pollWinner,
  reserveSearchKey,
  type SubscriptionStatus,
} from "./patron";

const PAID = Date.parse("2027-01-20T10:00:00Z");

describe("patron standing", () => {
  it("makes a patron once a payment went through", () => {
    expect(patronStanding("active", PAID)).toBe("patron");
  });

  it("keeps a patron whose renewal is being retried", () => {
    expect(patronStanding("past_due", PAID)).toBe("patron");
  });

  it("waits for the first payment to be recorded", () => {
    expect(patronStanding("active", null)).toBe("none");
    expect(patronStanding("past_due", null)).toBe("none");
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
    prices: { monthly: 399, yearly: 2999 },
    foundingMonth: "2027-01",
    cosmetics: {},
    monthsPerFind: 3,
    extraPinnedSlots: 3,
    launchEditions: [],
    editions: {},
    pollThemes: 3,
    pollDays: 7,
  };

  it("are those who first pay within the founding month", () => {
    expect(isFoundingPayment(rules, PAID)).toBe(true);
    expect(isFoundingPayment(rules, Date.parse("2027-02-01T10:00:00Z"))).toBe(false);
  });

  it("do not exist before the founding month is set", () => {
    expect(isFoundingPayment({ ...rules, foundingMonth: null }, PAID)).toBe(false);
  });

  it("start with no founding month", () => {
    const current = patronRulesAt(PATRON_SCHEDULE, Date.now());
    expect(current.foundingMonth).toBeNull();
  });
});

describe("the mark and the title", () => {
  it("keep the founder's mark for life, the title while subscribed", () => {
    expect(patronMark("none", true)).toBe("founder");
    expect(patronTitle("none", true)).toBeNull();
    expect(patronTitle("patron", true)).toBe(FOUNDER_TITLE);
  });

  it("show a patron while subscribed, and nobody after", () => {
    expect(patronMark("patron", false)).toBe("patron");
    expect(patronTitle("patron", false)).toBe(PATRON_TITLE);
    expect(patronMark("none", false)).toBeNull();
  });
});

describe("cosmetics of the month", () => {
  const pair = [
    { kind: "frame", frame: "cadeler" },
    { kind: "avatar", avatar: "lucubrateur" },
  ] as const;
  const frame = [{ kind: "frame", frame: "wax" }] as const;
  const rules = {
    startsAt: 0,
    prices: { monthly: 399, yearly: 2999 },
    foundingMonth: null,
    cosmetics: { "2027-01": frame, "2027-02": pair, "2027-03": frame, "2027-04": [] },
    monthsPerFind: 3,
    extraPinnedSlots: 3,
    launchEditions: [],
    editions: {},
    pollThemes: 3,
    pollDays: 7,
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
      { month: "2027-01", cosmetics: frame },
      { month: "2027-02", cosmetics: pair },
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

  it("show this month's pair to everyone, none ahead nor for an empty month", () => {
    expect(monthCosmetic(rules, at("2027-02-01T00:30:00+01:00"))?.cosmetics).toEqual(pair);
    expect(monthCosmetic(rules, at("2027-04-10T10:00:00Z"))).toBeNull();
    expect(monthCosmetic(rules, at("2027-05-10T10:00:00Z"))).toBeNull();
  });
});

describe("words to find", () => {
  const rules = { monthsPerFind: 3 };
  const at = (iso: string) => Date.parse(iso);
  const period = (plan: "monthly" | "yearly", start: string, end: string, refunded = false) => ({
    startsAt: at(start),
    endsAt: at(end),
    refunded,
    plan,
  });
  const months = (count: number) =>
    Array.from({ length: count }, (_, index) => {
      const start = new Date(Date.UTC(2027, index, 10)).toISOString();
      const end = new Date(Date.UTC(2027, index + 1, 10)).toISOString();
      return period("monthly", start, end);
    });

  it("gives a monthly patron one from the first payment, then one every three", () => {
    const now = at("2028-01-01T00:00:00Z");
    expect(earnedFinds(rules, months(0), now)).toBe(0);
    expect(earnedFinds(rules, months(1), now)).toBe(1);
    expect(earnedFinds(rules, months(3), now)).toBe(1);
    expect(earnedFinds(rules, months(4), now)).toBe(2);
    expect(earnedFinds(rules, months(7), now)).toBe(3);
  });

  it("gives a yearly patron one at once, then one each quarter as it comes", () => {
    const year = [period("yearly", "2027-01-10T00:00:00Z", "2028-01-10T00:00:00Z")];
    expect(earnedFinds(rules, year, at("2027-01-10T00:00:00Z"))).toBe(1);
    expect(earnedFinds(rules, year, at("2027-04-09T00:00:00Z"))).toBe(1);
    expect(earnedFinds(rules, year, at("2027-04-10T00:00:00Z"))).toBe(2);
    expect(earnedFinds(rules, year, at("2028-06-01T00:00:00Z"))).toBe(4);
  });

  it("adds both rhythms after a change of plan", () => {
    const mixed = [...months(3), period("yearly", "2027-04-10T00:00:00Z", "2028-04-10T00:00:00Z")];
    expect(earnedFinds(rules, mixed, at("2027-05-01T00:00:00Z"))).toBe(2);
  });

  it("gives nothing for a refunded period", () => {
    const refunded = [period("yearly", "2027-01-10T00:00:00Z", "2028-01-10T00:00:00Z", true)];
    expect(earnedFinds(rules, refunded, at("2027-06-01T00:00:00Z"))).toBe(0);
  });

  it("counts the words found against the rights, a word set aside giving its right back", () => {
    expect(findsLeft({ earned: 2, used: 1, returned: 0, subscribed: true })).toBe(1);
    expect(findsLeft({ earned: 2, used: 1, returned: 1, subscribed: true })).toBe(1);
    expect(findsLeft({ earned: 1, used: 2, returned: 0, subscribed: true })).toBe(0);
  });

  it("loses the unused rights at the stop, except those given back", () => {
    expect(findsLeft({ earned: 3, used: 1, returned: 0, subscribed: false })).toBe(0);
    expect(findsLeft({ earned: 3, used: 1, returned: 1, subscribed: false })).toBe(1);
  });
});

describe("library editions", () => {
  const rules = {
    launchEditions: ["sanguine", "lavis"],
    editions: { "2027-02": "bistre", "2027-04": "sepia" },
  };
  const at = (iso: string) => Date.parse(iso);
  const period = (start: string, end: string, refunded = false) => ({
    startsAt: at(start),
    endsAt: at(end),
    refunded,
  });

  it("are owned from a first payment, with the edition of each month paid", () => {
    const periods = [period("2027-01-20T10:00:00Z", "2027-02-20T10:00:00Z")];
    expect(ownedEditions(rules, periods, at("2027-02-25T10:00:00Z"))).toEqual([
      "sanguine",
      "lavis",
      "bistre",
    ]);
  });

  it("are kept once the subscription stops, and none comes ahead of its month", () => {
    const periods = [period("2027-01-20T10:00:00Z", "2027-02-20T10:00:00Z")];
    expect(ownedEditions(rules, periods, at("2027-06-01T10:00:00Z"))).not.toContain("sepia");
    expect(ownedEditions(rules, periods, at("2028-01-01T10:00:00Z"))).toContain("bistre");
  });

  it("are not given without a payment nor by a refunded one", () => {
    expect(ownedEditions(rules, [], at("2027-02-25T10:00:00Z"))).toEqual([]);
    const refunded = [period("2027-01-20T10:00:00Z", "2027-02-20T10:00:00Z", true)];
    expect(ownedEditions(rules, refunded, at("2027-02-25T10:00:00Z"))).toEqual([]);
  });

  it("print a card in its own choice, else in the album's, and only when owned", () => {
    const owned = new Set(["sanguine", "lavis"]);
    expect(cardEditionOf({ album: "lavis", card: undefined }, owned)).toBe("lavis");
    expect(cardEditionOf({ album: "lavis", card: "sanguine" }, owned)).toBe("sanguine");
    expect(cardEditionOf({ album: "lavis", card: null }, owned)).toBeNull();
    expect(cardEditionOf({ album: "bistre", card: undefined }, owned)).toBeNull();
  });
});

describe("reserve search key", () => {
  it("drops case, accents and ligatures", () => {
    expect(reserveSearchKey("Œillère")).toBe("oeillere");
    expect(reserveSearchKey("  Ébaubi ")).toBe("ebaubi");
    expect(reserveSearchKey("chausse-trape")).toBe("chausse trape");
  });
});

describe("the patrons' vote", () => {
  it("chooses the theme with the most voices, and nothing on a tie or without a voice", () => {
    expect(pollWinner([3, 7, 2])).toBe(1);
    expect(pollWinner([4, 4, 1])).toBeNull();
    expect(pollWinner([0, 0, 0])).toBeNull();
    expect(pollWinner([1, 0, 0])).toBe(0);
  });
});
