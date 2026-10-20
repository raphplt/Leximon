import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { type RarityIconShape, rarityIconGrid, rarityIcons } from "./rarity-icons";

/** Only the path commands the icons use, so that every SVG renderer draws them alike. */
const PATH = /^(?:[MLHVCAZ]|-?\d+(?:\.\d+)?|[\s,])+$/;

function paths(shape: RarityIconShape): string[] {
  return [...shape.body, ...shape.cuts.map((cut) => cut.d)];
}

/** Coordinates of a path, skipping the arc flags and radii, which are not positions. */
function numbers(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe("rarity icons", () => {
  it("draw every rarity, each with its own shape", () => {
    expect(Object.keys(rarityIcons)).toEqual([...RARITIES]);
    const bodies = RARITIES.map((rarity) => rarityIcons[rarity].body.join(" "));
    expect(new Set(bodies).size).toBe(RARITIES.length);
  });

  const shapes = RARITIES.map((rarity) => [rarity, rarityIcons[rarity]] as const);

  it.each(shapes)("keep %s on the grid, in plain path data", (_, shape) => {
    expect(shape.body.length).toBeGreaterThan(0);
    for (const d of paths(shape)) {
      expect(d).toMatch(PATH);
      for (const value of numbers(d)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(rarityIconGrid);
      }
    }
    for (const cut of shape.cuts) {
      if (cut.kind === "line") expect(cut.width).toBeGreaterThan(0);
    }
  });
});
