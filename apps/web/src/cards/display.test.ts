import { describe, expect, it } from "vitest";
import { wordFontSize } from "./display";

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
