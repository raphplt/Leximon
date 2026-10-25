import type { ClanMember, ClanMessage } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  clanLevelLine,
  clanRefusalMessage,
  clanShareLine,
  clanSubline,
  contributionHint,
  eventText,
  goalBar,
  goalCountLine,
  goalRewardLine,
  goalRing,
  goalTimeLeft,
  goalTitle,
  insertMention,
  joinLabel,
  leaveLabel,
  libraryHeadline,
  libraryRows,
  mentionQuery,
  mergeMessages,
  messageSegments,
  messageTime,
  moreMembersLabel,
  muteChoices,
  nextUnlockLine,
  seenLabel,
  unlockLabel,
  weekAnswersLabel,
} from "./clan";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const HOUR = 3_600_000;
const badge = { code: "AAAA1111", pseudo: "Mirabelle", avatar: "zani", frame: "simple", level: 12 };
const goal = {
  targets: { bronze: 45, silver: 90, gold: 150, illuminated: null },
  answers: 96,
  myAnswers: 23,
  boosters: { bronze: 0, silver: 1, gold: 1, illuminated: 1 },
};

function member(overrides: Partial<ClanMember> = {}): ClanMember {
  return {
    player: badge,
    role: "member",
    joinedAt: "2026-10-01T00:00:00.000Z",
    online: false,
    lastSeenAt: null,
    weekAnswers: 0,
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
  it("aims at the next tier", () => {
    expect(goalTitle(goal)).toBe("150 bonnes réponses");
    expect(goalCountLine(goal)).toBe("96 / 150 · 23 à toi");
    expect(goalRewardLine(goal)).toBe("À l'or, un sachet bonus.");
  });

  it("names the first tier that gives a booster", () => {
    const start = { ...goal, answers: 10 };
    expect(goalTitle(start)).toBe("45 bonnes réponses");
    expect(goalRewardLine(start)).toBe("À l'argent, un sachet bonus.");
  });

  it("cheers once the last tier is reached, without a target to beat", () => {
    const done = { ...goal, answers: 172 };
    expect(goalTitle(done)).toBe("Objectif rempli !");
    expect(goalCountLine(done)).toBe("172 bonnes réponses · 23 à toi");
    expect(goalRewardLine(done)).toBeNull();
  });

  it("places the tiers on the bar", () => {
    const bar = goalBar(goal);
    expect(bar.percent).toBeCloseTo(64, 1);
    expect(bar.tiers.map((tier) => [Math.round(tier.left), tier.reached])).toEqual([
      [30, true],
      [60, true],
      [100, false],
    ]);
  });

  it("runs the bar up to the illuminated tier once the clan opened it", () => {
    const illuminated = { ...goal, targets: { ...goal.targets, illuminated: 180 } };
    expect(goalBar(illuminated).tiers.map((tier) => tier.label)).toEqual([
      "Bronze à 45",
      "Argent à 90",
      "Or à 150",
      "Enluminure à 180",
    ]);
    expect(goalTitle({ ...illuminated, answers: 160 })).toBe("180 bonnes réponses");
  });

  it("counts down the days, then the hours", () => {
    expect(goalTimeLeft(new Date(now + 3.5 * 24 * HOUR).toISOString(), now)).toBe("reste 3 j");
    expect(goalTimeLeft(new Date(now + 5 * HOUR).toISOString(), now)).toBe("reste 5 h 00");
  });

  it("tells a member under the minimum what is missing", () => {
    expect(contributionHint({ myAnswers: 12, minContribution: 15 })).toBe(
      "Encore 3 bonnes réponses, et tu touches les sachets.",
    );
    expect(contributionHint({ myAnswers: 15, minContribution: 15 })).toBeNull();
  });

  it("sums up on the Jouer screen", () => {
    expect(goalRing(goal)).toEqual({ ratio: 0.64, text: "96 / 150" });
    expect(goalRing({ ...goal, answers: 160 })).toEqual({
      ratio: 1,
      text: "Objectif rempli !",
    });
  });

  it("credits the clan at the end of a challenge", () => {
    expect(clanShareLine(8)).toBe("+8 pour le clan");
    expect(clanShareLine(0)).toBeNull();
  });

  it("gives each member's share of the week", () => {
    expect(weekAnswersLabel(23)).toBe("23 cette semaine");
  });
});

describe("the clan level", () => {
  const wordOf = (id: string) => (id === "brisoir" ? "Brisoir" : id);
  const progress = {
    level: 4,
    xpIntoLevel: 240,
    xpForNextLevel: 1250,
    next: { level: 5, unlock: { kind: "illuminated" as const } },
  };

  it("shows the level and the way to the next", () => {
    expect(clanLevelLine(progress)).toBe("Niveau 4 · 240 / 1\u202f250 XP");
    expect(nextUnlockLine(progress, wordOf)).toBe("Au niveau 5, le palier Enluminure.");
    expect(nextUnlockLine({ ...progress, next: null }, wordOf)).toBeNull();
  });

  it("names what a level opens", () => {
    expect(unlockLabel({ kind: "color", id: "vermillon" }, wordOf)).toBe("la couleur vermillon");
    expect(unlockLabel({ kind: "engraving", id: "brisoir" }, wordOf)).toBe("la gravure Brisoir");
    expect(unlockLabel({ kind: "banner", id: "brisoir" }, wordOf)).toBe("la bannière Brisoir");
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
    expect(libraryHeadline(rows)).toBe("Il vous manque 42 cartes de Caractères et travers.");
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
    expect(eventText({ type: "tier", tier: "illuminated" }, wordOf)).toBe(
      "Palier d'enluminure atteint !",
    );
    expect(eventText({ type: "level", level: 6 }, wordOf)).toBe("Le clan passe au niveau 6 !");
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
    expect(leaveLabel(12)).toBe("Quitter le clan");
  });

  it("explains each refusal", () => {
    expect(clanRefusalMessage("message_refused")).toBe("Pas envoyé : un mot interdit. Reformule.");
  });
});

describe("mentions", () => {
  it("finds the name being typed after an @, spaces included", () => {
    expect(mentionQuery("Salut @Mir", 10)).toEqual({ start: 6, query: "Mir" });
    expect(mentionQuery("@Jean P", 7)).toEqual({ start: 0, query: "Jean P" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("finds nothing in an address, after a comma or with the caret elsewhere", () => {
    expect(mentionQuery("jean@leximon", 12)).toBeNull();
    expect(mentionQuery("@Mir, salut", 11)).toBeNull();
    expect(mentionQuery("@Mirabelle et toi", 3)).toEqual({ start: 0, query: "Mi" });
    expect(mentionQuery(`@${"a".repeat(400)}!`, 402)).toBeNull();
  });

  it("puts the pseudo in place of what was typed, followed by one space", () => {
    expect(insertMention("Salut @Mir", { start: 6 }, 10, "Mirabelle")).toEqual({
      text: "Salut @Mirabelle ",
      caret: 17,
    });
    expect(insertMention("@Mi et toi", { start: 0 }, 3, "Mirabelle")).toEqual({
      text: "@Mirabelle et toi",
      caret: 11,
    });
  });

  it("cuts a message around its mentions", () => {
    expect(
      messageSegments("Salut @Mirabelle et @Bob !", [
        { start: 6, end: 16, me: true },
        { start: 20, end: 24, me: false },
      ]),
    ).toEqual([
      { kind: "text", text: "Salut " },
      { kind: "mention", text: "@Mirabelle", me: true },
      { kind: "text", text: " et " },
      { kind: "mention", text: "@Bob", me: false },
      { kind: "text", text: " !" },
    ]);
    expect(messageSegments("court", [{ start: 2, end: 40, me: false }])).toEqual([
      { kind: "text", text: "court" },
    ]);
  });
});

describe("mergeMessages", () => {
  const event = (id: number) =>
    ({ kind: "event", id, createdAt: "2026-10-25T10:00:00Z" }) as unknown as ClanMessage;

  it("adds only the messages not already in the thread, in order of id", () => {
    const merged = mergeMessages([event(1), event(3)], [event(3), event(2), event(4)]);
    expect(merged.map((message) => message.id)).toEqual([1, 2, 3, 4]);
  });
});
