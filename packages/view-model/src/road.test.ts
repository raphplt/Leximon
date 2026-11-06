import { describe, expect, it } from "vitest";
import { ROAD_ROW, roadGeometry } from "./road";

describe("level road", () => {
  it("winds its stops down the page, their tags away from the nearest edge", () => {
    const road = roadGeometry(10, 0, 200);
    expect(road.height).toBe(10 * ROAD_ROW);
    expect(road.stops[0]).toEqual({ x: 100, y: ROAD_ROW / 2, side: "right" });
    expect(road.stops[2]).toMatchObject({ x: 160, side: "left" });
    expect(road.stops[5]).toMatchObject({ x: 48, side: "right" });
  });

  it("draws the part reached only from two stops on", () => {
    expect(roadGeometry(10, 1, 100).done).toBe("");
    const road = roadGeometry(10, 3, 100);
    expect(road.done.startsWith("M50 52")).toBe(true);
    expect(road.done.split("C")).toHaveLength(3);
    expect(road.ahead.split("C")).toHaveLength(10);
  });
});
