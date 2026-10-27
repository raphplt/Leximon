import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { holoFromOrientation, holoFromPointer, holoLayers } from "./holo";

describe("holoFromPointer", () => {
  it("puts the light under the finger and leaves the card flat at its centre", () => {
    expect(holoFromPointer(150, 210, 300, 420)).toEqual({ x: 50, y: 50, rotateX: 0, rotateY: 0 });
  });

  it("tilts the card away from the finger", () => {
    const corner = holoFromPointer(300, 0, 300, 420);
    expect(corner).toMatchObject({ x: 100, y: 0 });
    expect(corner.rotateY).toBeGreaterThan(0);
    expect(corner.rotateX).toBeGreaterThan(0);
  });

  it("stays on the card when the pointer leaves it", () => {
    expect(holoFromPointer(-50, 900, 300, 420)).toMatchObject({ x: 0, y: 100 });
    expect(holoFromPointer(10, 10, 0, 0)).toMatchObject({ x: 50, y: 50 });
  });
});

describe("holoFromOrientation", () => {
  it("leaves a phone held as usual flat", () => {
    expect(holoFromOrientation(45, 0)).toMatchObject({ x: 50, y: 50 });
  });

  it("follows the phone and stops at the edge of the range", () => {
    expect(holoFromOrientation(45, 90).x).toBe(100);
    expect(holoFromOrientation(-30, 0).y).toBe(0);
  });

  it("moves the light only, so that the card's text stays sharp", () => {
    expect(holoFromOrientation(80, -40)).toMatchObject({ rotateX: 0, rotateY: 0 });
  });
});

describe("holoLayers", () => {
  it("keeps Courant plain and adds effects as the rarity rises", () => {
    expect(holoLayers("common")).toEqual({
      glare: "none",
      gem: false,
      frame: "none",
      glitter: "none",
      rainbow: false,
      sweep: false,
    });
    expect(holoLayers("uncommon").glare).toBe("soft");
    expect(holoLayers("rare")).toMatchObject({ glare: "bright", gem: true, frame: "none" });
    expect(holoLayers("precious").frame).toBe("cobalt");
    expect(holoLayers("epic")).toMatchObject({ frame: "gold", glitter: "gold" });
    expect(holoLayers("legendary")).toMatchObject({ rainbow: true, sweep: true });
  });

  it("never takes an effect away from a rarer card", () => {
    const count = (rarity: (typeof RARITIES)[number]) =>
      Object.values(holoLayers(rarity)).filter((value) => value !== false && value !== "none")
        .length;
    for (const [index, rarity] of RARITIES.entries()) {
      const next = RARITIES[index + 1];
      if (next !== undefined) expect(count(next)).toBeGreaterThanOrEqual(count(rarity));
    }
  });
});
