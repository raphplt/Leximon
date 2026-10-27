import type { FeedEvent, PodiumEntry } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  betaPlacesLabel,
  feedLine,
  feedReactions,
  friendLine,
  friendListView,
  friendRefusalText,
  matchesFriend,
  podiumView,
  rankLabel,
  reactionChips,
  referralRewardTitle,
  tradeFriends,
  tradesLabel,
  unfoldLabel,
  withReaction,
} from "./friends";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const badge = (code: string, pseudo: string) => ({
  code,
  pseudo,
  avatar: "zani",
  frame: "simple",
  level: 12,
});
const lucie = badge("AAAA1111", "Lucie");

describe("the friends' list", () => {
  it("says the level and when the friend came by", () => {
    expect(friendLine({ player: lucie, online: true, lastSeenAt: null }, now)).toBe(
      "niv. 12 · en ligne",
    );
    expect(
      friendLine({ player: lucie, online: false, lastSeenAt: "2026-10-23T08:00:00.000Z" }, now),
    ).toBe("niv. 12 · vu hier");
  });

  it("counts trades only when there is one", () => {
    expect(tradesLabel(0)).toBeNull();
    expect(tradesLabel(1)).toBe("1 échange possible");
    expect(tradesLabel(4)).toBe("4 échanges possibles");
  });

  it("puts first the friends with the most trades possible", () => {
    const friend = (pseudo: string, trades: number) => ({
      player: badge(pseudo, pseudo),
      trades,
    });
    expect(
      tradeFriends([friend("Zoé", 0), friend("Marc", 2), friend("Ada", 0), friend("Luc", 5)]).map(
        (f) => f.player.pseudo,
      ),
    ).toEqual(["Luc", "Marc", "Ada", "Zoé"]);
  });

  it("tells the places of the beta left on the link", () => {
    expect(betaPlacesLabel(null)).toBeNull();
    expect(betaPlacesLabel(0)).toBe("Plus de place de bêta sur ton lien.");
    expect(betaPlacesLabel(2)).toBe("Ton lien fait encore entrer 2 joueurs dans la bêta.");
  });

  it("never tells a refusal: asking again reads as a request already sent", () => {
    expect(friendRefusalText("recently_declined")).toBe(friendRefusalText("already_requested"));
  });
});

describe("the podium", () => {
  const entry = (code: string, answers: number, rank: number, self = false): PodiumEntry => ({
    player: badge(code, code),
    answers,
    rank,
    self,
  });

  it("puts three on the steps and the player's place below", () => {
    const view = podiumView([
      entry("A", 30, 1),
      entry("B", 20, 2),
      entry("C", 12, 3),
      entry("D", 5, 4, true),
      entry("E", 0, 5),
    ]);
    expect(view.steps.map((e) => e.player.code)).toEqual(["A", "B", "C"]);
    expect(view.mine).toBe("4e sur 5");
    expect(view.empty).toBe(false);
  });

  it("gives no place below when the player is on the steps", () => {
    expect(podiumView([entry("A", 3, 1, true), entry("B", 0, 2)]).mine).toBeNull();
    expect(podiumView([entry("A", 0, 1, true)]).empty).toBe(true);
  });

  it("names the ranks", () => {
    expect(rankLabel(1)).toBe("1er");
    expect(rankLabel(3)).toBe("3e");
  });
});

describe("the feed", () => {
  const base = {
    id: 7,
    player: lucie,
    createdAt: "2026-10-24T10:00:00.000Z",
    reactions: [],
    mine: null,
  };
  const find: FeedEvent = { ...base, kind: "rare_find", cardId: "talpinette" };

  it("says what a friend found, and what the player found", () => {
    const card = { word: "talpinette", rarity: "legendary" as const };
    expect(feedLine(find, false, card, null)).toEqual({
      before: "Lucie trouve une Légendaire : ",
      word: "talpinette",
      after: "",
    });
    expect(feedLine(find, true, card, null).before).toBe("Tu trouves une Légendaire : ");
    expect(feedLine({ ...base, kind: "level", level: 10 }, false, null, null).before).toBe(
      "Lucie atteint le niveau 10",
    );
    expect(
      feedLine({ ...base, kind: "collection_complete", collectionId: "x" }, false, null, "Métiers")
        .before,
    ).toBe("Lucie complète « Métiers »");
  });

  it("moves the player's reaction and its counts at once", () => {
    const given = withReaction(find, "jealous");
    expect(given).toMatchObject({
      mine: "jealous",
      reactions: [{ reaction: "jealous", count: 1 }],
    });
    const changed = withReaction(
      { ...given, reactions: [{ reaction: "jealous" as const, count: 3 }] },
      "hats_off",
    );
    expect(changed.reactions).toEqual([
      { reaction: "hats_off", count: 1 },
      { reaction: "jealous", count: 2 },
    ]);
    expect(withReaction(given, null)).toMatchObject({ mine: null, reactions: [] });
    expect(reactionChips(changed).map((chip) => [chip.label, chip.count, chip.mine])).toEqual([
      ["Chapeau", 1, true],
      ["Jaloux", 2, false],
      ["Veinard", 0, false],
      ["Bien joué", 0, false],
    ]);
  });
});

describe("referral rewards", () => {
  it("names the other player of the invitation", () => {
    expect(
      referralRewardTitle({ player: lucie, role: "referrer", refereeCode: "B", boosters: 1 }),
    ).toBe("Lucie atteint le niveau 5, un sachet bonus pour toi !");
    expect(
      referralRewardTitle({ player: null, role: "referee", refereeCode: "B", boosters: 1 }),
    ).toBe("Un sachet bonus de bienvenue, grâce à Un joueur parti !");
  });
});

describe("a long list of friends", () => {
  const names = ["Héloïse", "Bastien", "Clémence", "Anatole", "Margot", "Octave", "Firmin"];
  const many = [...names, "Léonie", "Gaston", "Achille"].map((name, i) => ({
    player: badge(`CODE000${i}`, name),
    online: i < 2,
    trades: i % 3 === 0 ? 2 : 0,
  }));
  const all = { query: "", filter: "all" as const, unfolded: false };

  it("stays whole and plain while short", () => {
    const view = friendListView(many.slice(0, 8), all);
    expect(view.shown).toHaveLength(8);
    expect(view.searchable).toBe(false);
    expect(view.folded).toBe(0);
  });

  it("folds past eight, and unfolds on demand", () => {
    expect(friendListView(many, all)).toMatchObject({ folded: 2, searchable: true });
    expect(friendListView(many, { ...all, unfolded: true }).shown).toHaveLength(10);
    expect(unfoldLabel(2)).toBe("Voir les 2 autres");
    expect(unfoldLabel(1)).toBe("Voir le dernier");
  });

  it("finds a friend without the accents, and shows every match", () => {
    expect(matchesFriend({ player: badge("X", "Héloïse") }, " heloise ")).toBe(true);
    const found = friendListView(many, { ...all, query: "E" });
    expect(found.folded).toBe(0);
    expect(found.shown.map((f) => f.player.pseudo)).toContain("Héloïse");
    expect(friendListView(many, { ...all, query: "zut" }).empty).not.toBeNull();
  });

  it("filters those online or with a trade, and counts them", () => {
    const view = friendListView(many, all);
    expect(view.filters.map((f) => f.label)).toEqual(["Tous", "En ligne · 2", "Échanges · 4"]);
    expect(friendListView(many, { ...all, filter: "online" }).shown).toHaveLength(2);
    expect(friendListView(many, { ...all, filter: "trades" }).shown).toHaveLength(4);
  });
});

describe("the reactions under an event", () => {
  const event = { reactions: [{ reaction: "hats_off" as const, count: 2 }], mine: null };

  it("shows only those given, and offers to react", () => {
    const view = feedReactions(event, { self: false, picking: false });
    expect(view.chips.map((c) => c.id)).toEqual(["hats_off"]);
    expect(view.canReact).toBe(true);
  });

  it("lays out every choice while picking", () => {
    expect(feedReactions(event, { self: false, picking: true }).chips).toHaveLength(4);
  });

  it("never offers to react to the player's own event", () => {
    expect(feedReactions(event, { self: true, picking: true })).toMatchObject({ canReact: false });
    expect(feedReactions(event, { self: true, picking: true }).chips).toHaveLength(1);
  });
});
