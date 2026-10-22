import { describe, expect, it } from "vitest";
import { mentionCandidates, resolveMentions } from "./mentions";

describe("mentionCandidates", () => {
  it("offers every name an @ could start, shaped like a pseudo", () => {
    expect(mentionCandidates("@Jean Paul, salut", 20)).toEqual([
      { start: 0, end: 5, key: "jean" },
      { start: 0, end: 10, key: "jeanpaul" },
    ]);
  });

  it("stops at a comma, a double space or the end of the pseudo's length", () => {
    expect(mentionCandidates("@Jean, @Paul  là", 20).map((c) => c.key)).toEqual(["jean", "paul"]);
    expect(mentionCandidates(`@${"a".repeat(25)}`, 20)).toEqual([]);
  });

  it("keys names without accents, case or separators", () => {
    expect(mentionCandidates("merci @Râph.L", 20).map((c) => c.key)).toEqual(["raph", "raphl"]);
  });

  it("ignores an @ inside a word and an @ alone", () => {
    expect(mentionCandidates("ecris a jean@leximon.fr @ toi", 20)).toEqual([]);
  });

  it("finds several mentions in one message", () => {
    expect(mentionCandidates("@Ana et @Bob", 20).map((c) => [c.start, c.key])).toEqual([
      [0, "ana"],
      [0, "anaet"],
      [8, "bob"],
    ]);
  });
});

describe("resolveMentions", () => {
  const members = new Map([
    ["jean", "u-jean"],
    ["jeanpaul", "u-jean-paul"],
    ["bob", "u-bob"],
  ]);

  it("keeps the longest member's name for each @", () => {
    expect(resolveMentions(mentionCandidates("@Jean Paul, salut", 20), members)).toEqual([
      { start: 0, end: 10, userId: "u-jean-paul" },
    ]);
    expect(resolveMentions(mentionCandidates("@Jean Pierre", 20), members)).toEqual([
      { start: 0, end: 5, userId: "u-jean" },
    ]);
  });

  it("names nobody outside the clan", () => {
    expect(resolveMentions(mentionCandidates("@Ana et @bob", 20), members)).toEqual([
      { start: 8, end: 12, userId: "u-bob" },
    ]);
  });
});
