import type { Rarity } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  copiesAfterRecycle,
  ecuRules,
  ecusLabel,
  ecusTable,
  missingWordAction,
  missingWordBlocked,
  missingWordCollections,
  missingWordLockedLine,
  missingWordOptions,
  recycleAction,
  recycleCopyAction,
  recycleCopyConfirm,
  recycleCopyNeedsConfirm,
  recycledToast,
  recyclePreview,
} from "./ecus";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const RULES = ecuRules(NOW);
const card = (id: string, rarity: Rarity) => ({ id, rarity });

describe("ecusLabel", () => {
  it("agrees with 0, 1 and more", () => {
    expect(ecusLabel(0)).toBe("0 écu");
    expect(ecusLabel(1)).toBe("1 écu");
    expect(ecusLabel(1600)).toBe("1\u202f600 écus");
  });
});

describe("ecusTable", () => {
  it("gives every rarity its gain and its price", () => {
    const table = ecusTable(RULES);
    expect(table.rows.map((row) => [row.rarity, row.gain, row.price])).toEqual([
      ["common", "+1", "8"],
      ["uncommon", "+2", "16"],
      ["rare", "+5", "40"],
      ["precious", "+15", "120"],
      ["epic", "+50", "400"],
      ["legendary", "+200", "1\u202f600"],
    ]);
  });
});

describe("recycling", () => {
  const cards = [card("a", "common"), card("b", "rare"), card("c", "epic"), card("d", "uncommon")];

  it("says what the button does before doing it", () => {
    const copies = new Map([
      ["a", 5],
      ["b", 3],
      ["c", 9],
      ["d", 1],
    ]);
    const plan = recyclePreview(RULES, cards, copies);
    expect(recycleAction(plan)).toBe("Recycler 4 doubles, +8 écus");
    expect(recycledToast(plan)).toBe("Tu as recyclé 4 doubles et gagné 8 écus.");
  });

  it("agrees with a single double and hides the button without any", () => {
    const one = recyclePreview(RULES, cards, new Map([["a", 3]]));
    expect(recycleAction(one)).toBe("Recycler 1 double, +1 écu");
    expect(recycledToast(one)).toBe("Tu as recyclé 1 double et gagné 1 écu.");
    const none = recyclePreview(RULES, cards, new Map([["a", 2]]));
    expect(recycleAction(none)).toBeNull();
    expect(recycledToast(none)).toBe("Tu n'avais plus de double à recycler.");
  });

  it("recycles a copy from the sheet, asking once more for the rarest cards", () => {
    expect(recycleCopyAction(RULES, "legendary", 2)).toBe("Recycler un double, +200 écus");
    expect(recycleCopyAction(RULES, "legendary", 1)).toBeNull();
    expect(recycleCopyNeedsConfirm(RULES, "legendary")).toBe(true);
    expect(recycleCopyNeedsConfirm(RULES, "common")).toBe(false);
    expect(recycleCopyConfirm(RULES, "epic", 2)).toBe(
      "Ce double vaut 50 écus. Il te restera 1 exemplaire de cette carte.",
    );
    expect(recycleCopyConfirm(RULES, "epic", 4)).toBe(
      "Ce double vaut 50 écus. Il te restera 3 exemplaires de cette carte.",
    );
  });
});

describe("missingWordOptions", () => {
  const cards = [
    card("a", "common"),
    card("b", "common"),
    card("c", "precious"),
    card("d", "precious"),
    card("e", "rare"),
  ];

  it("counts the missing words of each rarity and checks the price", () => {
    const options = missingWordOptions(
      RULES,
      cards,
      new Map([
        ["a", 1],
        ["e", 2],
      ]),
      20,
    );
    expect(options.map(({ rarity, missing, state }) => ({ rarity, missing, state }))).toEqual([
      { rarity: "common", missing: 1, state: "open" },
      { rarity: "rare", missing: 0, state: "complete" },
      { rarity: "precious", missing: 2, state: "too_poor" },
    ]);
    const [common, rare, precious] = options;
    if (common === undefined || rare === undefined || precious === undefined) throw new Error();
    expect(common.missingLine).toBe("1 mot manquant");
    expect(precious.missingLine).toBe("2 mots manquants");
    expect(rare.missingLine).toBe("Tu les as tous");
    expect(missingWordAction(common)).toBe("Recevoir un mot Courant pour 8 écus");
    expect(missingWordBlocked(common, 20)).toBeNull();
    expect(missingWordBlocked(precious, 20)).toBe("Il te faut 120 écus. Tu en as 20.");
    expect(missingWordBlocked(precious, 0)).toBe("Il te faut 120 écus. Tu n'en as aucun.");
    expect(missingWordBlocked(rare, 20)).toBe(
      "Tu as déjà tous les mots Rares de cette collection.",
    );
  });
});

describe("copiesAfterRecycle", () => {
  it("takes the recycled copies away", () => {
    const after = copiesAfterRecycle(
      new Map([
        ["a", 5],
        ["b", 2],
      ]),
      [{ cardId: "a", copies: 3 }],
    );
    expect([...after]).toEqual([
      ["a", 2],
      ["b", 2],
    ]);
  });
});

describe("missingWordCollections", () => {
  it("opens the other collections at the level of the choice of collection", () => {
    const collections = [{ id: "fondateurs" }, { id: "autre" }];
    expect(missingWordCollections(collections, 1, NOW).map((c) => c.id)).toEqual(["fondateurs"]);
    expect(missingWordLockedLine(1, NOW)).toBe(
      "Tu pourras choisir un mot des autres collections au niveau 3.",
    );
    expect(missingWordCollections(collections, 3, NOW)).toHaveLength(2);
    expect(missingWordLockedLine(3, NOW)).toBeNull();
  });
});
