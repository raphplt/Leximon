import type { CatalogCard } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  FURET_RUN,
  guideLine,
  TRAINING_QUESTIONS,
  trainingOutcome,
  trainingQuestions,
} from "./joust-guide";

const SIZE = { questions: 5, seconds: 15, choices: 4, replyHours: 24 };

function card(id: string, rarity: Rarity = "common", collectionId = "fondateurs"): CatalogCard {
  return {
    id,
    word: id,
    partOfSpeech: "n. m.",
    era: null,
    definition: `Sens de ${id}.`,
    etymology: null,
    quote: null,
    rarity,
    collectionId,
    themes: [],
    perBillion: null,
  };
}

/** A fixed sequence, so a draw gives the same questions each time. */
function steady(): () => number {
  let state = 0.37;
  return () => {
    state = (state * 9301 + 0.49297) % 1;
    return state;
  };
}

describe("the guided first visit", () => {
  it("lets Maître Furet say the rule with the numbers of the day", () => {
    expect(guideLine(1, SIZE, { size: 10, budget: 25 })).toContain("avec 25 points en tout");
    expect(guideLine(3, SIZE, { size: 10, budget: 25 })).toContain("24 heures");
  });
});

describe("the training run", () => {
  const catalog = [
    ...["a", "b", "c", "d", "e", "f"].map((id) => card(id)),
    ...["r1", "r2", "r3", "r4"].map((id) => card(id, "rare")),
    card("other", "common", "ailleurs"),
  ];

  it("asks words the player knows, each among choices of its collection and rarity", () => {
    const known = catalog.filter((entry) => entry.rarity === "rare");
    const questions = trainingQuestions(known, catalog, 4, steady());
    expect(questions).toHaveLength(TRAINING_QUESTIONS);
    expect(new Set(questions.map((question) => question.cardId)).size).toBe(TRAINING_QUESTIONS);
    for (const question of questions) {
      expect(question.choices).toHaveLength(4);
      expect(question.choices).toContain(question.cardId);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices.every((id) => id.startsWith("r"))).toBe(true);
      expect(question.definition).toBe(`Sens de ${question.cardId}.`);
    }
  });

  it("falls back to common words when the player knows too few", () => {
    const questions = trainingQuestions([card("r1", "rare")], catalog, 4, steady());
    expect(questions).toHaveLength(TRAINING_QUESTIONS);
    for (const question of questions) {
      expect(question.choices.every((id) => /^[a-f]$/.test(id))).toBe(true);
    }
  });
});

describe("the training's result", () => {
  it("goes to the most words found, then to the quickest", () => {
    const all = FURET_RUN.map(() => ({ correct: true, ms: 9_000 }));
    expect(trainingOutcome(all)).toBe("won");
    const two = FURET_RUN.map((answer) => ({ ...answer, ms: answer.ms - 100 }));
    expect(trainingOutcome(two)).toBe("won");
    expect(trainingOutcome(FURET_RUN)).toBe("draw");
    expect(trainingOutcome([{ correct: true, ms: 1 }])).toBe("lost");
  });
});
