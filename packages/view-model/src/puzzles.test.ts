import { describe, expect, it } from "vitest";
import {
  LETTERS_START,
  letterSlots,
  lettersSpelled,
  PAIRS_START,
  pairsDone,
  pairsVerdict,
  pickInPairs,
  placeTile,
  takeBackFrom,
} from "./puzzles";

describe("letters", () => {
  const tiles = ["t", "r", "o", "ï", "e", "n", "i", "t", "a"];

  it("fills the slots in order, once per tile, no more than the word", () => {
    const slots = letterSlots("introït");
    expect(slots).toBe(7);
    let state = LETTERS_START;
    for (const index of [6, 5, 0, 1, 2, 3, 7, 8]) state = placeTile(state, index, slots);
    expect(lettersSpelled(state, tiles)).toBe("introït");
    expect(placeTile(state, 4, slots)).toBe(state);
    expect(lettersSpelled(placeTile(takeBackFrom(state, 6), 4, slots), tiles)).toBe("introïe");
  });

  it("takes back a slot and those after it", () => {
    let state = LETTERS_START;
    for (const index of [6, 5, 0]) state = placeTile(state, index, 7);
    expect(lettersSpelled(takeBackFrom(state, 1), tiles)).toBe("i");
  });
});

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
