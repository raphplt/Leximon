import { describe, expect, it } from "vitest";
import { illumination, lettrine, lettrineInks, type toyIconInks, toyIcons } from "./toy-icons";

describe("the icons on a lettrine", () => {
  it("keep the pale parts as vellum and turn the rest to gold", () => {
    // The joust's blade is pale, its hilt dark, its guard gold.
    expect(lettrineInks("jousts")).toEqual({
      f1: "#D9A63A",
      f2: illumination.vellum,
      f3: "#F6D47A",
    });
  });

  it("never paint an icon in the color of a ground", () => {
    const grounds = new Set<string>(Object.values(lettrine.grounds));
    for (const name of Object.keys(toyIcons) as (keyof typeof toyIconInks)[]) {
      for (const ink of Object.values(lettrineInks(name))) expect(grounds.has(ink)).toBe(false);
    }
  });
});
