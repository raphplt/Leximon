import { describe, expect, it } from "vitest";
import {
  type CabinetUsage,
  centuryLabel,
  citationSource,
  familyGroups,
  usageChart,
  usageLine,
  usagePointAt,
  usageRate,
} from "./cabinet";

const usage = (perBillion: number[]): CabinetUsage => ({ from: 1800, step: 10, perBillion });

describe("the usage curve", () => {
  it("names the peak, and when the word leaves the books", () => {
    expect(usageLine(usage([10, 40, 100, 30, 1, 0.5, 0]))).toBe(
      "Le mot culmine vers 1820, puis disparaît presque des livres après 1830.",
    );
    expect(usageLine(usage([10, 40, 100, 30, 5, 5, 4]))).toBe(
      "Le mot culmine vers 1820, puis se raréfie après 1830.",
    );
    expect(usageLine(usage([100, 60, 40, 30, 25, 25, 25]))).toBe(
      "Dès 1800, le mot est à son plus haut. Il est aujourd'hui 4 fois moins employé.",
    );
  });

  it("says when the word is still in use", () => {
    expect(usageLine(usage([10, 100, 80, 70]))).toBe(
      "Le mot culmine vers 1810 et reste employé aujourd'hui.",
    );
    expect(usageLine(usage([10, 20, 30]))).toBe(
      "Le mot n'a jamais été aussi présent dans les livres qu'aujourd'hui.",
    );
  });

  it("has no curve without a use", () => {
    const rare = "Le mot est trop rare dans les livres numérisés pour tracer sa courbe.";
    expect(usageLine(null)).toBe(rare);
    expect(usageLine(usage([0, 0, 0]))).toBe(rare);
    expect(usageChart(usage([0, 0]), 100, 50)).toBeNull();
  });

  it("is laid in its box, the peak below the top", () => {
    const chart = usageChart(usage([0, 50, 100, 25, 0, 0]), 250, 110);
    expect(chart?.points.map((point) => point.x)).toEqual([0, 50, 100, 150, 200, 250]);
    expect(chart?.peak).toMatchObject({ x: 100, y: 10, decade: "années 1820" });
    expect(chart?.points[0]?.y).toBe(110);
    expect(chart?.ticks).toEqual(
      [
        { x: 250, label: "1850" },
        { x: 0, label: "1800" },
      ].reverse(),
    );
    expect(chart?.area.endsWith("L250 110 L0 110 Z")).toBe(true);
    if (chart) expect(usagePointAt(chart, 140).decade).toBe("années 1830");
  });

  it("reads a rate with a decimal only below ten", () => {
    expect(usageRate(52.03)).toBe("52 par milliard de mots");
    expect(usageRate(0.43)).toBe("0,4 par milliard de mots");
  });
});

describe("the Littré article", () => {
  it("names centuries and sources as the Littré does", () => {
    expect(centuryLabel(13)).toBe("XIIIe siècle");
    expect(centuryLabel(1)).toBe("Ier siècle");
    expect(citationSource({ text: "…", author: "VOLT.", reference: "Lett. 12 juin" })).toBe(
      "VOLT., Lett. 12 juin",
    );
    expect(citationSource({ text: "…", author: "", reference: "" })).toBe("");
  });

  it("groups the family from its origin to its derived words", () => {
    const groups = familyGroups([
      { word: "forlonger", cardId: "forlonger", relation: "sibling" },
      { word: "fors", cardId: null, relation: "base" },
    ]);
    expect(groups.map((group) => [group.label, group.members.map((m) => m.word)])).toEqual([
      ["Vient de", ["fors"]],
      ["De la même famille", ["forlonger"]],
    ]);
  });
});
