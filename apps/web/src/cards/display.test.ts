import { describe, expect, it } from "vitest";
import { formatOdds, wordFontSize } from "./display";

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

describe("wordFontSize", () => {
  it("keeps short words at full size", () => {
    expect(wordFontSize("poue")).toBe(34);
    expect(wordFontSize("matrimonion")).toBe(34);
  });

  it("shrinks long words instead of breaking them", () => {
    expect(wordFontSize("coquefredouille")).toBe(32);
    expect(wordFontSize("embabouinement")).toBe(28);
    expect(wordFontSize("anticonstitutionnellement")).toBe(19);
  });

  it("gives wide letters more room", () => {
    expect(wordFontSize("mmmmmmmmmmmm")).toBeLessThan(wordFontSize("iiiiiiiiiiii"));
  });

  it("measures accented letters like their base letter", () => {
    expect(wordFontSize("éééééééééééééé")).toBe(wordFontSize("eeeeeeeeeeeeee"));
  });
});
