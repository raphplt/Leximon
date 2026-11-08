import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { MASTERY_SCHEDULE } from "../rules";
import {
  buildQuestion,
  CHOICES_PER_QUESTION,
  gradeTyped,
  normalizeWord,
  planSession,
  sameClassFirst,
  type WordClass,
  wordClassOf,
} from "./challenge";
import { masteryRulesAt } from "./mastery";

const SEED = "0123456789abcdef0123456789abcdef";

describe("buildQuestion", () => {
  it("offers four distinct choices including the answer", () => {
    const question = buildQuestion(createSeededRandom(SEED), "a", [["a", "b", "c", "d", "e"]]);
    expect(question).not.toBeNull();
    if (question === null) return;
    expect(question.choices).toHaveLength(CHOICES_PER_QUESTION);
    expect(new Set(question.choices).size).toBe(CHOICES_PER_QUESTION);
    expect(question.choices[question.answerIndex]).toBe("a");
  });

  it("completes wrong choices from the next pools", () => {
    const pools = [
      ["a", "b"],
      ["a", "b", "x"],
      ["y", "z"],
    ];
    for (let n = 0; n < 20; n++) {
      const random = createSeededRandom(n.toString(16).padStart(32, "0"));
      const question = buildQuestion(random, "a", pools);
      expect(question?.choices.slice().sort().slice(0, 3)).toEqual(["a", "b", "x"]);
    }
  });

  it("gives up when the pools are too small", () => {
    expect(buildQuestion(createSeededRandom(SEED), "a", [["a", "b"], ["c"]])).toBeNull();
  });

  it("places the answer and picks the format evenly", () => {
    const random = createSeededRandom(SEED);
    const positions = [0, 0, 0, 0];
    const formats: Record<string, number> = { definition: 0, word: 0 };
    const others = Array.from({ length: 20 }, (_, i) => `c${i}`);
    for (let i = 0; i < 4_000; i++) {
      const question = buildQuestion(random, "a", [others]);
      if (question === null) throw new Error("no question");
      positions[question.answerIndex] = (positions[question.answerIndex] ?? 0) + 1;
      formats[question.format] = (formats[question.format] ?? 0) + 1;
    }
    for (const count of positions) expect(Math.abs(count - 1_000)).toBeLessThan(120);
    expect(Object.keys(formats)).toEqual(["definition", "word"]);
    expect(Math.abs((formats["definition"] ?? 0) - 2_000)).toBeLessThan(150);
  });
});

describe("wordClassOf", () => {
  it("reads the class from the part of speech", () => {
    expect(wordClassOf("n. f.")).toBe("noun");
    expect(wordClassOf("n. m. et f.")).toBe("noun");
    expect(wordClassOf("n. f. plur.")).toBe("noun");
    expect(wordClassOf("v. tr.")).toBe("verb");
    expect(wordClassOf("v. réfl.")).toBe("verb");
    expect(wordClassOf("adj. f. pl.")).toBe("adjective");
    expect(wordClassOf("interj.")).toBe("other");
    expect(wordClassOf("adv.")).toBe("other");
  });

  it("classes a phrase by what it stands for", () => {
    expect(wordClassOf("loc. v.")).toBe("verb");
    expect(wordClassOf("loc. nom. f.")).toBe("noun");
    expect(wordClassOf("loc. adj.")).toBe("adjective");
    expect(wordClassOf("loc. adv.")).toBe("other");
  });
});

describe("sameClassFirst", () => {
  const classes: Record<string, WordClass> = { a: "verb", b: "verb", c: "noun", d: "verb" };
  const classOf = (id: string) => classes[id];

  it("puts the card's class within each pool before the pools themselves", () => {
    expect(
      sameClassFirst("a", classOf, [
        ["b", "c"],
        ["c", "d", "x"],
      ]),
    ).toEqual([["b"], ["d"], ["b", "c"], ["c", "d", "x"]]);
  });

  it("keeps the pools of a card of unknown class", () => {
    expect(sameClassFirst("x", classOf, [["a", "c"]])).toEqual([["a", "c"]]);
  });

  it("never mixes classes while the class makes a full question", () => {
    const verbs: Record<string, WordClass> = { ...classes, e: "verb" };
    const pools = sameClassFirst("a", (id) => verbs[id], [
      ["c", "x", "y", "z"],
      ["b", "d", "e"],
    ]);
    for (let n = 0; n < 20; n++) {
      const random = createSeededRandom(n.toString(16).padStart(32, "0"));
      const question = buildQuestion(random, "a", pools);
      expect(question?.choices.every((id) => verbs[id] === "verb")).toBe(true);
    }
  });
});

describe("planSession", () => {
  it("puts due words first, then new ones, up to the size", () => {
    expect(planSession(["d1", "d2"], ["n1", "d2", "n2"], 3)).toEqual(["d1", "d2", "n1"]);
    expect(planSession(["d1", "d2", "d3"], ["n1"], 2)).toEqual(["d1", "d2"]);
  });
});

describe("gradeTyped", () => {
  const rules = masteryRulesAt(MASTERY_SCHEDULE, Date.now());
  const catalog = new Set(
    ["galimatias", "affolage", "afforage", "coche", "loche"].map(normalizeWord),
  );
  const grade = (typed: string, word: string) => gradeTyped(rules, typed, word, catalog);

  it("ignores case, accents, ligatures and spaces", () => {
    expect(grade("  Galimatias ", "galimatias")).toBe("good");
    expect(grade("ecornifleur", "écornifleur")).toBe("good");
    expect(grade("ÉCORNIFLEUR", "écornifleur")).toBe("good");
    expect(grade("coeur", "cœur")).toBe("good");
  });

  it("forgives one slip on a long word, graded hard", () => {
    expect(grade("galimatia", "galimatias")).toBe("hard");
    expect(grade("gallimatias", "galimatias")).toBe("hard");
    expect(grade("galimatios", "galimatias")).toBe("hard");
    expect(grade("galimtaias", "galimatias")).toBe("hard");
  });

  it("refuses two slips, a short word with a slip, or another word of the catalog", () => {
    expect(grade("galimatoos", "galimatias")).toBe("again");
    expect(grade("locho", "loche")).toBe("again");
    expect(grade("coche", "loche")).toBe("again");
    expect(grade("affolage", "afforage")).toBe("again");
    expect(grade("", "galimatias")).toBe("again");
  });
});
