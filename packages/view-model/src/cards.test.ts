import { describe, expect, it } from "vitest";
import { formatOdds, frequencyLine, shareText } from "./cards";

describe("formatOdds", () => {
  it("prints one occurrence in N words", () => {
    expect(formatOdds(275)).toBe("1/3,6 M");
    expect(formatOdds(13)).toBe("1/77 M");
    expect(formatOdds(0.13)).toBe("1/7,7 Md");
    expect(formatOdds(0.034)).toBe("1/29 Md");
    expect(formatOdds(1)).toBe("1/1 Md");
    expect(formatOdds(2000)).toBe("1/500 k");
  });

  it("stays discreet below what Ngram measures", () => {
    expect(formatOdds(null)).toBe("< 1/Md");
    expect(formatOdds(0)).toBe("< 1/Md");
  });
});

describe("frequencyLine", () => {
  it("says how rare the word is in today's books", () => {
    expect(frequencyLine(0.0585)).toBe("Un mot imprimé sur 17\u00a0milliards.");
    expect(frequencyLine(1)).toBe("Un mot imprimé sur 1\u00a0milliard.");
    expect(frequencyLine(0.67)).toBe("Un mot imprimé sur 1,5\u00a0milliard.");
    expect(frequencyLine(48.4)).toBe("Un mot imprimé sur 21\u00a0millions.");
    expect(frequencyLine(2000)).toBe("Un mot imprimé sur 500\u00a0000.");
  });

  it("says when the word is no longer found at all", () => {
    expect(frequencyLine(null)).toBe("Introuvable dans les livres d'aujourd'hui.");
  });
});

describe("shareText", () => {
  it("puts the word first and the game nowhere", () => {
    expect(shareText("talpinette", null)).toBe(
      "Talpinette. Introuvable dans les livres d'aujourd'hui. Moi, je l'ai.",
    );
  });
});
