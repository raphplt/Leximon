import type { CatalogCard } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { ecuRules } from "./ecus";
import {
  allPicks,
  clearedPicks,
  extraPicks,
  RECYCLE_START,
  type RecycleState,
  recycleView,
  steppedPick,
  toggledPick,
} from "./recycle";

const RULES = ecuRules(Date.parse("2026-11-10T12:00:00Z"));

const card = (word: string, rarity: Rarity, collectionId = "a") =>
  ({ id: word, word, rarity, collectionId }) as CatalogCard;

const CARDS = [
  card("grigou", "common"),
  card("bélître", "rare"),
  card("aragne", "epic", "b"),
  card("zinzin", "common", "b"),
  card("seul", "common"),
];
const NAMES = new Map([
  ["a", "Les mots anciens"],
  ["b", "Les métiers"],
]);
const OWNED = new Map([
  ["grigou", 5],
  ["bélître", 3],
  ["aragne", 2],
  ["zinzin", 2],
  ["seul", 1],
]);

const view = (picks = new Map<string, number>(), state: Partial<RecycleState> = {}) =>
  recycleView(RULES, CARDS, NAMES, OWNED, picks, { ...RECYCLE_START, ...state });

describe("recycleView", () => {
  it("lists the cards with a double, the most doubles first", () => {
    const shown = view();
    expect(shown.rows.map((row) => row.word)).toEqual(["grigou", "bélître", "aragne", "zinzin"]);
    expect(shown.count).toBe("4 cartes ont des doubles");
    expect(shown.rows[0]).toMatchObject({ owned: "5 exemplaires", max: 4, gain: "+1 écu l'un" });
    expect(shown.action).toBeNull();
    expect(shown.empty).toBeNull();
  });

  it("sorts and filters, and says when nothing matches", () => {
    expect(view(undefined, { sort: "rarity" }).rows.map((row) => row.word)).toEqual([
      "aragne",
      "bélître",
      "grigou",
      "zinzin",
    ]);
    expect(view(undefined, { sort: "alpha" }).rows.map((row) => row.word)).toEqual([
      "aragne",
      "bélître",
      "grigou",
      "zinzin",
    ]);
    expect(view(undefined, { collectionId: "b" }).rows.map((row) => row.word)).toEqual([
      "aragne",
      "zinzin",
    ]);
    expect(view(undefined, { search: "BELI" }).rows.map((row) => row.word)).toEqual(["bélître"]);
    expect(view(undefined, { rarity: "legendary" }).empty).toBe(
      "Aucun double ne correspond à ces filtres.",
    );
    expect(view().rarities).toEqual(["common", "rare", "epic"]);
  });

  it("counts every pick in the total, the hidden ones too", () => {
    const picks = new Map([
      ["grigou", 3],
      ["zinzin", 1],
    ]);
    const shown = view(picks, { collectionId: "a" });
    expect(shown.copies).toBe(4);
    expect(shown.ecus).toBe(4);
    expect(shown.action).toBe("Recycler 4 doubles, +4 écus");
    expect(shown.choice).toEqual([
      { cardId: "grigou", copies: 3 },
      { cardId: "zinzin", copies: 1 },
    ]);
    expect(shown.confirm).toBeNull();
  });

  it("asks once more for an Épique or a Légendaire", () => {
    expect(view(new Map([["aragne", 1]])).confirm).toBe(
      "Tu vas recycler un double de la carte Épique « aragne ».",
    );
    expect(
      view(
        new Map([
          ["aragne", 1],
          ["grigou", 1],
        ]),
      ).confirm,
    ).toBe("Tu vas recycler un double de la carte Épique « aragne ».");
    expect(view(new Map([["aragne", 1]]), {}).copies).toBe(1);
    expect(
      recycleView(
        RULES,
        CARDS,
        NAMES,
        new Map([["aragne", 4]]),
        new Map([["aragne", 2]]),
        RECYCLE_START,
      ).confirm,
    ).toBe("Tu vas recycler 2 doubles de cartes Épiques ou Légendaires, « aragne ».");
  });
});

describe("picking", () => {
  const rows = view().rows;
  const row = (word: string) => {
    const found = rows.find((candidate) => candidate.word === word);
    if (found === undefined) throw new Error(word);
    return found;
  };

  it("picks on a tap what goes beyond the card and one double, at least one", () => {
    expect(toggledPick(RULES, new Map(), row("grigou")).get("grigou")).toBe(3);
    expect(toggledPick(RULES, new Map(), row("zinzin")).get("zinzin")).toBe(1);
    const picked = view(new Map([["grigou", 3]])).rows[0];
    if (picked === undefined) throw new Error("grigou");
    expect(toggledPick(RULES, new Map([["grigou", 3]]), picked).has("grigou")).toBe(false);
  });

  it("steps between none and all but the last copy", () => {
    expect(steppedPick(new Map(), row("zinzin"), 1).get("zinzin")).toBe(1);
    const full = view(new Map([["zinzin", 1]])).rows.find((r) => r.word === "zinzin");
    if (full === undefined) throw new Error("zinzin");
    expect(steppedPick(new Map([["zinzin", 1]]), full, 1).get("zinzin")).toBe(1);
    expect(steppedPick(new Map([["zinzin", 1]]), full, -1).has("zinzin")).toBe(false);
  });

  it("picks every double of the rows shown, one copy of each card kept", () => {
    expect([...allPicks(new Map(), rows)]).toEqual([
      ["grigou", 4],
      ["bélître", 2],
      ["aragne", 1],
      ["zinzin", 1],
    ]);
  });

  it("picks the doubles in excess of the rows shown, never the rarest", () => {
    const picks = extraPicks(RULES, new Map([["seul", 0]]), rows);
    expect([...picks]).toEqual([
      ["seul", 0],
      ["grigou", 3],
      ["bélître", 1],
    ]);
    expect([...clearedPicks(picks, rows)]).toEqual([["seul", 0]]);
  });
});
