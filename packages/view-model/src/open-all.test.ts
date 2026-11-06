import { describe, expect, it } from "vitest";
import {
  openAllLabel,
  openAllStopped,
  openedAllTitle,
  openedLevelsLabel,
  tallyRewards,
} from "./open-all";

describe("opening every coffret at once", () => {
  it("says how many open and where they come from", () => {
    expect(openAllLabel(16)).toBe("Ouvrir les 16 coffrets");
    expect(openedAllTitle(1)).toBe("1 coffret ouvert\u202f!");
    expect(openedAllTitle(16)).toBe("16 coffrets ouverts\u202f!");
    expect(openedLevelsLabel([4])).toBe("Niveau 4");
    expect(openedLevelsLabel([3, 5])).toBe("Niveaux 3 et 5");
    expect(openedLevelsLabel([2, 3, 4, 17])).toBe("Niveaux 2 à 17");
  });

  it("counts the same rewards together and keeps the others apart", () => {
    const tallies = tallyRewards([
      { kind: "bonus_booster" },
      { kind: "garni_booster" },
      { kind: "title", title: "Fine plume" },
      { kind: "bonus_booster" },
      { kind: "ecus", amount: 5 },
      { kind: "bonus_booster" },
      { kind: "ecus", amount: 10 },
      { kind: "title", title: "Rat de bibliothèque" },
      { kind: "reserve_slot" },
      { kind: "reserve_slot" },
    ]);
    expect(tallies.map((tally) => tally.item.title)).toEqual([
      "3 sachets bonus",
      "Sachet garni",
      "Titre",
      "15 écus",
      "Titre",
      "Réserve agrandie",
    ]);
    expect(tallies[0]?.count).toBe(3);
    expect(tallies[5]?.item.detail).toBe("Ta réserve garde 2 sachets bonus de plus");
  });

  it("says why the last coffrets stay closed, for one or several", () => {
    expect(openAllStopped("reserve_full", 9, 8)).toBe(
      "Ta réserve de sachets bonus est pleine, donc 9 coffrets restent fermés. Ouvre un sachet bonus pour les récupérer.",
    );
    expect(openAllStopped("reserve_full", 1, 17)).toBe(
      "Ta réserve de sachets bonus est pleine, donc 1 coffret reste fermé. Ouvre un sachet bonus pour le récupérer.",
    );
    expect(openAllStopped("failed", 2, 5)).toBe(
      "Le serveur ne répond plus, donc 2 coffrets restent fermés. Réessaie dans un instant.",
    );
  });
});
