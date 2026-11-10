import { describe, expect, it } from "vitest";
import { JOUST_SUSPICION, type JousterStats, suspicionReasons } from "./suspicion";

const rules = JOUST_SUSPICION;
const stats = (over: Partial<JousterStats> = {}): JousterStats => ({
  served: 40,
  correct: 30,
  medianMs: 5_000,
  spreadMs: 6_000,
  ...over,
});

describe("suspicionReasons", () => {
  it("leaves an ordinary jouster alone", () => {
    expect(suspicionReasons(rules, stats())).toEqual([]);
  });

  it("says nothing before enough questions, or without any answer", () => {
    const script = { correct: 29, medianMs: 300, spreadMs: 50 };
    expect(suspicionReasons(rules, stats({ ...script, served: 29 }))).toEqual([]);
    expect(suspicionReasons(rules, stats({ medianMs: null, spreadMs: null }))).toEqual([]);
  });

  it("names the one nearly always right faster than a definition is read", () => {
    expect(suspicionReasons(rules, stats({ correct: 38, medianMs: 2_000 }))).toEqual(["fast"]);
    expect(suspicionReasons(rules, stats({ correct: 37, medianMs: 2_000 }))).toEqual([]);
    expect(suspicionReasons(rules, stats({ correct: 38, medianMs: 2_001 }))).toEqual([]);
  });

  it("names answer times too alike, even slow and sometimes wrong", () => {
    expect(suspicionReasons(rules, stats({ medianMs: 4_000, spreadMs: 500 }))).toEqual(["regular"]);
  });

  it("names the one never wrong over many questions, at any pace", () => {
    expect(suspicionReasons(rules, stats({ served: 50, correct: 50, medianMs: 9_000 }))).toEqual([
      "flawless",
    ]);
    expect(suspicionReasons(rules, stats({ served: 49, correct: 49, medianMs: 9_000 }))).toEqual(
      [],
    );
  });

  it("gives every reason that holds", () => {
    const script = stats({ served: 60, correct: 60, medianMs: 1_000, spreadMs: 20 });
    expect(suspicionReasons(rules, script)).toEqual(["fast", "regular", "flawless"]);
  });
});
