import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import {
  advanceRiddle,
  definitionOpening,
  lastRiddleStep,
  pickRiddleWord,
  type RiddleCandidate,
  type RiddleRules,
  riddleCluesOf,
  riddleDay,
  riddleLettersShown,
  riddleNumber,
  riddleReveal,
  riddleRulesAt,
} from "./riddle";

const RULES: RiddleRules = {
  startsAt: 0,
  rarities: ["common", "uncommon"],
  minLetters: 5,
  maxLetters: 12,
  minDefinitionWords: 8,
  startLetters: 0,
  letterSteps: 3,
  hiddenLetters: null,
  xp: 50,
};

const MORE_LETTERS: RiddleRules = { ...RULES, startLetters: 1, hiddenLetters: 2 };

const RALINGUE: RiddleCandidate = {
  word: "ralingue",
  rarity: "common",
  partOfSpeech: "n. f.",
  definition: "Cordage cousu en ourlet sur le pourtour d'une voile pour en renforcer les bords.",
  etymology: "Mot que l'on retrouve en italien (relinga), en espagnol et en portugais.",
};

describe("riddleRulesAt", () => {
  it("takes the period in force", () => {
    const later = { ...RULES, startsAt: 100, xp: 60 };
    expect(riddleRulesAt([RULES, later], 99).xp).toBe(50);
    expect(riddleRulesAt([RULES, later], 100).xp).toBe(60);
  });
});

describe("definitionOpening", () => {
  it("does not end on a masked word", () => {
    expect(
      definitionOpening(
        "Condition, rang et manières d'un … ; dignité princière, évoquée avec familiarité.",
      ),
    ).toBe("Condition, rang et manières…");
  });

  it("keeps the first words, without ending on a small word", () => {
    expect(definitionOpening(RALINGUE.definition)).toBe("Cordage cousu en ourlet…");
  });

  it("stops at the first clause when it leaves enough to uncover", () => {
    expect(
      definitionOpening(
        "Gros marteau de bois, employé notamment pour battre les cuirs ; en blason, petit marteau.",
      ),
    ).toBe("Gros marteau de bois…");
  });

  it("ignores a clause too short to say anything", () => {
    expect(
      definitionOpening("Autrefois, pièce de bois dont on garnissait le bord des grands navires."),
    ).toBe("Autrefois, pièce de bois…");
  });

  it("drops an elided word left hanging", () => {
    expect(definitionOpening("Pièce d'étoffe que les femmes portaient sur la tête")).toBe(
      "Pièce d'étoffe…",
    );
  });

  it("leaves out a French semicolon and its space", () => {
    expect(
      definitionOpening("Caractère de celui qui est arrogant ; hauteur blessante envers autrui."),
    ).toBe("Caractère de celui qui est arrogant…");
  });

  it("always leaves something to uncover", () => {
    const short = "Un mot";
    expect(definitionOpening(short)).toBe("Un…");
  });
});

describe("riddleCluesOf", () => {
  it("builds the clues of a word within the rules", () => {
    expect(riddleCluesOf(RULES, RALINGUE)).toEqual({
      partOfSpeech: "n. f.",
      opening: "Cordage cousu en ourlet…",
      definition: RALINGUE.definition,
      etymology: RALINGUE.etymology,
    });
  });

  it("hides the word's family in every clue", () => {
    const clues = riddleCluesOf(RULES, {
      ...RALINGUE,
      word: "renardeau",
      definition: "Petit du renard, jeune renard qui ne quitte pas encore sa mère.",
      etymology: "Dérivé de renard, avec le suffixe des petits animaux.",
    });
    expect(clues?.opening).not.toContain("renard");
    expect(clues?.definition).not.toContain("renard");
    expect(clues?.etymology).not.toContain("renard");
  });

  it.each<[string, Partial<RiddleCandidate>]>([
    ["too rare", { rarity: "rare" }],
    ["too short", { word: "rale" }],
    ["too long", { word: "anticonstitution" }],
    ["not one word", { word: "à-propos" }],
    ["defined too briefly", { definition: "Cordage de voile cousu." }],
    ["without an etymology", { etymology: null }],
  ])("leaves out a word %s", (_, change) => {
    expect(riddleCluesOf(RULES, { ...RALINGUE, ...change })).toBeNull();
  });

  it("counts an accented word in letters", () => {
    expect(riddleCluesOf(RULES, { ...RALINGUE, word: "équité" })).not.toBeNull();
  });
});

describe("pickRiddleWord", () => {
  const seed = (i: number) => i.toString(16).padStart(32, "0");
  const random = () => createSeededRandom(seed(1));

  it("never asks a used word while others are left", () => {
    for (let i = 0; i < 50; i++) {
      const source = createSeededRandom(seed(i));
      expect(pickRiddleWord(source, ["a", "b", "c"], new Set(["a", "c"]))).toBe("b");
    }
  });

  it("starts again once every word was asked", () => {
    expect(pickRiddleWord(random(), ["a"], new Set(["a"]))).toBe("a");
  });

  it("has nothing to pick in an empty pool", () => {
    expect(pickRiddleWord(random(), [], new Set())).toBeNull();
  });

  it("picks evenly", () => {
    const counts = new Map<string, number>();
    const source = random();
    const words = ["a", "b", "c", "d"];
    for (let i = 0; i < 4000; i++) {
      const word = pickRiddleWord(source, words, new Set()) ?? "";
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    for (const word of words) {
      expect(counts.get(word) ?? 0).toBeGreaterThan(880);
      expect(counts.get(word) ?? 0).toBeLessThan(1120);
    }
  });
});

describe("riddle numbers", () => {
  it("numbers the days from the first one", () => {
    expect(riddleNumber("2026-10-31", "2026-10-31")).toBe(1);
    expect(riddleNumber("2026-10-31", "2026-11-01")).toBe(2);
  });

  it("goes back from a number to its day, across a change of clocks and of year", () => {
    expect(riddleDay("2026-10-31", 1)).toBe("2026-10-31");
    expect(riddleDay("2026-10-31", 63)).toBe("2027-01-01");
    expect(riddleNumber("2026-10-31", riddleDay("2026-10-31", 200))).toBe(200);
  });
});

describe("advanceRiddle", () => {
  it("offers six steps", () => {
    expect(lastRiddleStep(RULES)).toBe(6);
  });

  it("uncovers the next step on a wrong answer", () => {
    expect(advanceRiddle(RULES, 0, false)).toEqual({ step: 1, outcome: null });
  });

  it("stays on its step when the word is found", () => {
    expect(advanceRiddle(RULES, 2, true)).toEqual({ step: 2, outcome: "found" });
  });

  it("can still be found on the last step", () => {
    expect(advanceRiddle(RULES, 6, true)).toEqual({ step: 6, outcome: "found" });
  });

  it("ends on a wrong answer at the last step, the seventh try", () => {
    let state = { step: 0, outcome: null as "found" | "lost" | null };
    let tries = 0;
    while (state.outcome === null) {
      state = { ...advanceRiddle(RULES, state.step, false) };
      tries++;
    }
    expect(state).toEqual({ step: 6, outcome: "lost" });
    expect(tries).toBe(7);
  });
});

describe("riddleLettersShown", () => {
  it("gives one letter a step when nothing else is set", () => {
    expect([0, 3, 4, 5, 6].map((step) => riddleLettersShown(RULES, 9, step))).toEqual([
      0, 0, 1, 2, 3,
    ]);
  });

  it("shows the first letter before any clue", () => {
    expect([0, 1, 2, 3].map((step) => riddleLettersShown(MORE_LETTERS, 9, step))).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it.each([
    [5, [2, 3, 4]],
    [6, [2, 3, 4]],
    [7, [3, 4, 5]],
    [8, [3, 5, 6]],
    [9, [3, 5, 7]],
    [10, [4, 6, 8]],
    [11, [4, 7, 9]],
    [12, [4, 7, 10]],
  ])("spreads the letters of a word of %i", (length, shown) => {
    expect([4, 5, 6].map((step) => riddleLettersShown(MORE_LETTERS, length, step))).toEqual(shown);
  });

  it("never gives the word away, and every step gives a letter", () => {
    for (let length = MORE_LETTERS.minLetters; length <= MORE_LETTERS.maxLetters; length++) {
      const shown = [3, 4, 5, 6].map((step) => riddleLettersShown(MORE_LETTERS, length, step));
      expect(shown.at(-1)).toBeLessThan(length);
      for (let i = 1; i < shown.length; i++) {
        expect(shown[i]).toBeGreaterThan(shown[i - 1] ?? 0);
      }
    }
  });
});

describe("riddleReveal", () => {
  const clues = riddleCluesOf(RULES, RALINGUE);
  if (clues === null) throw new Error("Fixture refused");

  it("shows no clue at the start", () => {
    expect(riddleReveal(RULES, clues, RALINGUE.word, 0, false)).toEqual({
      opening: null,
      definition: null,
      etymology: null,
      letters: "",
    });
  });

  it("uncovers clues one step at a time", () => {
    expect(riddleReveal(RULES, clues, RALINGUE.word, 1, false).opening).toBe(clues.opening);
    expect(riddleReveal(RULES, clues, RALINGUE.word, 1, false).definition).toBeNull();
    expect(riddleReveal(RULES, clues, RALINGUE.word, 2, false).definition).toBe(clues.definition);
    expect(riddleReveal(RULES, clues, RALINGUE.word, 2, false).etymology).toBeNull();
    expect(riddleReveal(RULES, clues, RALINGUE.word, 3, false).etymology).toBe(clues.etymology);
    expect(riddleReveal(RULES, clues, RALINGUE.word, 3, false).letters).toBe("");
  });

  it("then uncovers letters", () => {
    expect(riddleReveal(RULES, clues, RALINGUE.word, 4, false).letters).toBe("r");
    expect(riddleReveal(RULES, clues, RALINGUE.word, 6, false).letters).toBe("ral");
  });

  it("shows the letters the rules give at the start", () => {
    expect(riddleReveal(MORE_LETTERS, clues, RALINGUE.word, 0, false).letters).toBe("r");
    expect(riddleReveal(MORE_LETTERS, clues, RALINGUE.word, 6, false).letters).toBe("raling");
  });

  it("keeps a whole letter when the word starts with an accent", () => {
    expect(riddleReveal(RULES, clues, "équité", 4, false).letters).toBe("é");
  });

  it("shows everything once the game is over, even when found early", () => {
    expect(riddleReveal(RULES, clues, RALINGUE.word, 0, true)).toEqual({
      opening: clues.opening,
      definition: clues.definition,
      etymology: clues.etymology,
      letters: "ralingue",
    });
  });
});
