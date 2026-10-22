import { describe, expect, it } from "vitest";
import { CLAN_SCHEDULE } from "../rules";
import {
  canAct,
  checkClanMessage,
  checkClanMotto,
  checkClanName,
  clanRulesAt,
  emblemChoices,
  isChiefAway,
  isEmblemAllowed,
  nextChief,
  nextMessageAt,
} from "./clan";

const rules = clanRulesAt(CLAN_SCHEDULE, Date.UTC(2026, 9, 22));
const HOUR = 3_600_000;

describe("checkClanName", () => {
  it("keeps a tidy name and keys it like a pseudo", () => {
    expect(checkClanName(rules, "  Les   Fines Plumes ")).toEqual({
      ok: true,
      name: "Les Fines Plumes",
      key: "lesfinesplumes",
    });
  });

  it("refuses names too short, too long, oddly shaped or insulting", () => {
    expect(checkClanName(rules, "Ab")).toEqual({ ok: false, reason: "too_short" });
    expect(checkClanName(rules, "A".repeat(31))).toEqual({ ok: false, reason: "too_long" });
    expect(checkClanName(rules, "Les <Plumes>")).toEqual({
      ok: false,
      reason: "invalid_characters",
    });
    expect(checkClanName(rules, "Les Connards")).toEqual({ ok: false, reason: "refused" });
    expect(checkClanName(rules, "Clan Leximon")).toEqual({ ok: false, reason: "refused" });
  });
});

describe("checkClanMotto and checkClanMessage", () => {
  it("lets an empty motto through and caps it at 80 characters", () => {
    expect(checkClanMotto(rules, "   ")).toEqual({ ok: true, text: "" });
    expect(checkClanMotto(rules, "x".repeat(81))).toEqual({ ok: false, reason: "too_long" });
  });

  it("tidies a message, keeps short paragraph breaks and caps its length", () => {
    expect(checkClanMessage(rules, "  Salut   la\n\n\n\ncompagnie  ")).toEqual({
      ok: true,
      text: "Salut la\n\ncompagnie",
    });
    expect(checkClanMessage(rules, " \n ")).toEqual({ ok: false, reason: "empty" });
    expect(checkClanMessage(rules, "a".repeat(501))).toEqual({ ok: false, reason: "too_long" });
  });

  it("refuses insults in a message, not swearing nor harmless double meanings", () => {
    expect(checkClanMessage(rules, "T'es qu'un connard")).toEqual({ ok: false, reason: "refused" });
    expect(checkClanMessage(rules, "Espèce de s4lope")).toEqual({ ok: false, reason: "refused" });
    for (const text of [
      "Putain, une Légendaire !",
      "Un raton laveur au fond d'un cul-de-sac",
      "Je pédale vers Leximon, l'admin est sympa",
    ]) {
      expect(checkClanMessage(rules, text).ok, text).toBe(true);
    }
  });
});

describe("emblem", () => {
  const vermillon = [{ kind: "color", id: "vermillon" }] as const;

  it("adds the items the clan's level opened", () => {
    expect(emblemChoices(rules, []).colors).toHaveLength(8);
    expect(emblemChoices(rules, vermillon).colors).toContain("vermillon");
    expect(emblemChoices(rules, [{ kind: "engraving", id: "brisoir" }]).engravings).toContain(
      "brisoir",
    );
  });

  it("allows only listed items and two different colours", () => {
    expect(isEmblemAllowed(rules, [], { engraving: "aiguiere", colors: ["sang", "or"] })).toBe(
      true,
    );
    expect(isEmblemAllowed(rules, [], { engraving: "aiguiere", colors: ["or", "or"] })).toBe(false);
    expect(
      isEmblemAllowed(rules, [], { engraving: "aiguiere", colors: ["sang", "vermillon"] }),
    ).toBe(false);
    expect(
      isEmblemAllowed(rules, vermillon, { engraving: "aiguiere", colors: ["sang", "vermillon"] }),
    ).toBe(true);
  });
});

describe("roles", () => {
  it("lets chief and deputies moderate, deputies only below them", () => {
    expect(canAct("deputy", "delete_message")).toBe(true);
    expect(canAct("member", "delete_message")).toBe(false);
    expect(canAct("deputy", "kick", "member")).toBe(true);
    expect(canAct("deputy", "kick", "deputy")).toBe(false);
    expect(canAct("chief", "mute", "deputy")).toBe(true);
    expect(canAct("chief", "kick", "chief")).toBe(false);
  });

  it("keeps the clan's settings and deputies to the chief", () => {
    expect(canAct("deputy", "edit_clan")).toBe(false);
    expect(canAct("deputy", "appoint_deputy")).toBe(false);
    expect(canAct("chief", "hand_over", "member")).toBe(true);
  });

  it("hands the clan to the oldest deputy, else the oldest member", () => {
    const members = [
      { userId: "chief", role: "chief", joinedAt: 1 },
      { userId: "old-member", role: "member", joinedAt: 2 },
      { userId: "young-deputy", role: "deputy", joinedAt: 5 },
      { userId: "old-deputy", role: "deputy", joinedAt: 3 },
    ] as const;
    expect(nextChief(members, "chief")).toBe("old-deputy");
    expect(nextChief(members.slice(0, 2), "chief")).toBe("old-member");
    expect(nextChief(members.slice(0, 1), "chief")).toBeNull();
  });

  it("sees a chief away for 14 days", () => {
    const now = Date.UTC(2026, 9, 22);
    expect(isChiefAway(rules, now - 14 * 24 * HOUR, now)).toBe(true);
    expect(isChiefAway(rules, now - 13 * 24 * HOUR, now)).toBe(false);
  });
});

describe("pacing", () => {
  it("allows one message every two seconds", () => {
    expect(nextMessageAt(rules, null, 10_000)).toBeNull();
    expect(nextMessageAt(rules, 9_000, 10_000)).toBe(11_000);
    expect(nextMessageAt(rules, 8_000, 10_000)).toBeNull();
  });
});
