import { describe, expect, it } from "vitest";
import { PAIRS_START, pairsDone, pairsVerdict, pickInPairs } from "./puzzles";

describe("pairs", () => {
  const cards = ["a", "b"];

  it("matches a word with its definition, either way round", () => {
    let state = pickInPairs(PAIRS_START, "word", "a");
    state = pickInPairs(state, "definition", "a");
    state = pickInPairs(state, "definition", "b");
    state = pickInPairs(state, "word", "b");
    expect(state.matched).toEqual(["a", "b"]);
    expect(pairsDone(state, cards)).toBe(true);
    expect(pairsVerdict(state.mistakes)).toBe("Toutes les paires du premier coup.");
  });

  it("counts a wrong match, and changes the pick on the same side", () => {
    let state = pickInPairs(PAIRS_START, "word", "a");
    state = pickInPairs(state, "word", "b");
    expect(state.picked).toEqual({ side: "word", cardId: "b" });
    state = pickInPairs(state, "definition", "a");
    expect(state).toMatchObject({ mistakes: 1, wrong: { word: "b", definition: "a" } });
    expect(pairsDone(state, cards)).toBe(false);
    expect(pairsVerdict(1)).toBe("Toutes les paires, avec une erreur.");
    expect(pairsVerdict(3)).toBe("Toutes les paires, avec 3 erreurs.");
  });
});
