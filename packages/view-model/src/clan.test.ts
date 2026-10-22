import type { ClanMember } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  clanRefusalMessage,
  clanSubline,
  contributionHint,
  eventText,
  goalBar,
  goalCountLine,
  goalTimeLeft,
  goalTitle,
  joinLabel,
  leaveLabel,
  libraryHeadline,
  libraryRows,
  messageTime,
  moreMembersLabel,
  muteChoices,
  seenLabel,
} from "./clan";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const HOUR = 3_600_000;
const badge = { code: "AAAA1111", pseudo: "Mirabelle", avatar: "zani", frame: "simple", level: 12 };
const goal = { targets: { bronze: 100, silver: 200, gold: 300 }, words: 214, myWords: 23 };

function member(overrides: Partial<ClanMember> = {}): ClanMember {
  return {
    player: badge,
    role: "member",
    joinedAt: "2026-10-01T00:00:00.000Z",
    online: false,
    lastSeenAt: null,
    weekWords: 0,
    mutedUntil: null,
    ...overrides,
  };
}

describe("the clan header", () => {
  it("says the size, the entry and the motto", () => {
    expect(clanSubline({ memberCount: 34, entryMode: "request", motto: "Rien ne se perd" })).toBe(
      "34 membres · entrée sur demande · « Rien ne se perd »",
    );
    expect(clanSubline({ memberCount: 1, entryMode: "open", motto: "" })).toBe(
      "1 membre · entrée libre",
    );
  });
});

describe("members", () => {
  it("tell when they were last seen", () => {
    expect(seenLabel(member({ online: true }), now)).toBe("en ligne");
    expect(seenLabel(member({ lastSeenAt: new Date(now - 3 * HOUR).toISOString() }), now)).toBe(
      "vu il y a 3 h",
    );
    expect(seenLabel(member({ lastSeenAt: new Date(now - 30 * HOUR).toISOString() }), now)).toBe(
      "vu hier",
    );
    expect(
      seenLabel(member({ lastSeenAt: new Date(now - 12 * 24 * HOUR).toISOString() }), now),
    ).toBe("vu il y a 12 j");
  });

  it("point at the rest of the list", () => {
    expect(moreMembersLabel(34, 7)).toBe("Voir les 27 autres");
    expect(moreMembersLabel(8, 7)).toBe("Voir l'autre");
    expect(moreMembersLabel(7, 7)).toBeNull();
  });

  it("can be silenced for the durations of the rules", () => {
    expect(muteChoices(now).map((choice) => choice.label)).toEqual([
      "1 heure",
      "24 heures",
      "7 jours",
    ]);
  });
});

describe("the weekly goal", () => {
  it("aims at the gold target", () => {
    expect(goalTitle(goal)).toBe("300 mots nouveaux, ensemble");
    expect(goalCountLine(goal)).toBe("214 / 300 · ta part : 23");
  });

  it("places the tiers on the bar", () => {
    const bar = goalBar(goal);
    expect(bar.percent).toBeCloseTo(71.33, 1);
    expect(bar.tiers.map((tier) => [Math.round(tier.left), tier.reached])).toEqual([
      [33, true],
      [67, true],
      [100, false],
    ]);
  });

  it("counts down the days, then the hours", () => {
    expect(goalTimeLeft(new Date(now + 3.5 * 24 * HOUR).toISOString(), now)).toBe("reste 3 j");
    expect(goalTimeLeft(new Date(now + 5 * HOUR).toISOString(), now)).toBe("reste 5 h 00");
  });

  it("tells a member under the minimum what is missing", () => {
    expect(contributionHint({ myWords: 2, minContribution: 5 })).toBe(
      "Encore 3 mots nouveaux de ta part pour toucher les sachets.",
    );
    expect(contributionHint({ myWords: 5, minContribution: 5 })).toBeNull();
  });
});

describe("the library", () => {
  const rows = libraryRows(
    [
      { id: "caracteres", name: "Caractères et travers", total: 500 },
      { id: "metiers", name: "Métiers d'antan", total: 400 },
    ],
    new Map([
      ["caracteres", 458],
      ["metiers", 120],
    ]),
    new Map([["caracteres", 90]]),
  );

  it("shows the clan's share and the player's", () => {
    expect(rows[0]).toMatchObject({ owned: 458, mine: 90, minePercent: 18 });
  });

  it("names the collection nearest to complete", () => {
    expect(libraryHeadline(rows)).toBe(
      "À vous tous, il vous manque 42 cartes de Caractères et travers.",
    );
  });
});

describe("the journal", () => {
  const wordOf = (id: string) => (id === "brisoir" ? "Brisoir" : id);

  it("tells what happened", () => {
    expect(eventText({ type: "legendary", player: badge, cardId: "brisoir" }, wordOf)).toBe(
      "Mirabelle trouve une Légendaire : Brisoir !",
    );
    expect(eventText({ type: "role", player: badge, role: "chief" }, wordOf)).toBe(
      "Mirabelle prend la tête du clan",
    );
    expect(eventText({ type: "left", player: null }, wordOf)).toBe("Un joueur parti s'en va");
    expect(eventText({ type: "tier", tier: "silver" }, wordOf)).toBe("Palier d'argent atteint !");
  });

  it("dates messages by the hour today, by the day before", () => {
    expect(messageTime("2026-10-22T08:05:00.000Z", now, "UTC")).toBe("08:05");
    expect(messageTime("2026-10-21T08:05:00.000Z", now, "UTC")).toBe("hier");
    expect(messageTime("2026-10-12T08:05:00.000Z", now, "UTC")).toBe("12 oct.");
  });
});

describe("joining and leaving", () => {
  it("says what the button does", () => {
    expect(joinLabel("open", false)).toBe("Rejoindre");
    expect(joinLabel("request", false)).toBe("Demander à entrer");
    expect(joinLabel("request", true)).toBe("Demande envoyée");
    expect(leaveLabel(1)).toBe("Quitter et dissoudre le clan");
    expect(leaveLabel(12)).toBe("Quitter le clan, 24 h sans clan");
  });

  it("explains each refusal", () => {
    expect(clanRefusalMessage("message_refused")).toBe("Pas envoyé : un mot interdit. Reformule.");
  });
});
