import { describe, expect, it } from "vitest";
import type { AlbumState, AlbumView } from "./album";
import type { AnsweredQuestion } from "./challenges";
import { albumPracticeCards, clanAnswers, practiceEmptyLine, practiceView } from "./practice";

const NOW = Date.UTC(2026, 9, 30, 12);
const names = (id: string) => (id === "fondateurs" ? "Les Fondateurs" : id);

const summary = {
  scopes: [
    { scope: { kind: "collection" as const, id: "fondateurs" }, words: 12, due: 3 },
    { scope: { kind: "missed" as const }, words: 4, due: 0 },
    { scope: { kind: "recent" as const }, words: 30, due: 1 },
    { scope: { kind: "theme" as const, id: "cuisine" }, words: 8, due: 0 },
  ],
  xp: { today: 0, cap: 100 },
};

describe("practiceView", () => {
  it("sorts the series by family and says what each holds", () => {
    const view = practiceView(summary, names, true, NOW);
    expect(view.mine.map((choice) => choice.label)).toEqual(["Mes mots ratés", "Mes mots récents"]);
    expect(view.mine.map((choice) => choice.detail)).toEqual([
      "4 mots",
      "30 mots, dont 1 à revoir",
    ]);
    expect(view.collections[0]).toMatchObject({
      label: "Les Fondateurs",
      detail: "12 mots, dont 3 à revoir",
    });
    expect(view.themes[0]).toMatchObject({ label: "Cuisine", detail: "8 mots" });
  });

  it("keeps themes out until the level opens them", () => {
    expect(practiceView(summary, names, false, NOW).themes).toEqual([]);
  });

  it("says the XP rule, then what today earned, then that the cap is reached", () => {
    const line = (today: number) =>
      practiceView({ ...summary, xp: { today, cap: 100 } }, names, true, NOW).xpLine;
    expect(line(0)).toBe(
      "Une bonne réponse d'entraînement rapporte 5 XP, 100 XP par jour au plus.",
    );
    expect(line(35)).toBe("Tu as gagné 35 XP d'entraînement aujourd'hui, sur 100 au plus.");
    expect(line(100)).toBe(
      "Tu as atteint les 100 XP d'entraînement du jour. Les mots à revoir rapportent toujours leur XP.",
    );
  });
});

describe("clanAnswers", () => {
  it("leaves out free practice", () => {
    const answer = (correct: boolean, free?: boolean) =>
      ({ correct, ...(free === undefined ? {} : { free }) }) as AnsweredQuestion;
    expect(clanAnswers([answer(true), answer(false), answer(true, true)])).toBe(1);
  });
});

describe("albumPracticeCards", () => {
  const state: AlbumState = {
    collectionId: "tout",
    rarity: null,
    filter: "all",
    theme: "cuisine",
    search: "",
  };
  const view = (owned: number, searching = false) =>
    ({
      searching,
      items: [
        ...Array.from({ length: owned }, (_, i) => ({ kind: "owned", card: { id: `c${i}` } })),
        { kind: "missing", cardId: "absent" },
      ],
    }) as unknown as AlbumView;

  it("offers the owned words of a filter", () => {
    expect(albumPracticeCards(view(4), state, 4)).toEqual(["c0", "c1", "c2", "c3"]);
  });

  it("offers nothing without a filter, during a search, or under the minimum", () => {
    expect(albumPracticeCards(view(9), { ...state, theme: null }, 4)).toBeNull();
    expect(albumPracticeCards(view(9, true), state, 4)).toBeNull();
    expect(albumPracticeCards(view(3), state, 4)).toBeNull();
  });

  it("stops at the longest list the server takes", () => {
    expect(albumPracticeCards(view(80), state, 4)).toHaveLength(50);
  });
});

describe("practiceEmptyLine", () => {
  it("says how many words a series takes", () => {
    expect(practiceEmptyLine(4)).toBe(
      "Il te faut au moins 4 mots pour t'entraîner. Ouvre un sachet pour en trouver.",
    );
  });
});
