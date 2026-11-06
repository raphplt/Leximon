import { describe, expect, it } from "vitest";
import { nextChapterSign, ROAD_END, ROAD_ROW, roadGeometry } from "./road";

describe("level road", () => {
  it("winds its stops down the page, their tags away from the nearest edge", () => {
    const road = roadGeometry(10, 0, false, 200);
    expect(road.height).toBe(10 * ROAD_ROW + ROAD_END);
    expect(road.stops[0]).toEqual({ x: 100, y: ROAD_ROW / 2, side: "right" });
    expect(road.stops[2]).toMatchObject({ x: 160, side: "left" });
    expect(road.stops[5]).toMatchObject({ x: 48, side: "right" });
    expect(road.end).toEqual({ x: 100, y: road.height - ROAD_END / 2 });
  });

  it("lays its odds and ends between the stops, on the side the road leaves free", () => {
    const road = roadGeometry(10, 0, false, 100);
    expect(road.decor).toHaveLength(9);
    expect(road.decor[0]).toMatchObject({ kind: "books", y: ROAD_ROW, small: false });
    expect(road.decor[0]?.x).toBeCloseTo(14);
    expect(road.decor[4]).toMatchObject({ kind: "album", small: false });
    expect(road.decor[4]?.x).toBeCloseTo(86);
    expect(road.decor[5]?.kind).toBe("books");
  });

  it("walks from the top through the stops reached, to the end once the chapter is passed", () => {
    expect(roadGeometry(10, 0, false, 100).done).toBe("");
    const road = roadGeometry(10, 3, false, 100);
    expect(road.done.startsWith("M50 0")).toBe(true);
    expect(road.done.split("C")).toHaveLength(4);
    expect(road.ahead.split("C")).toHaveLength(12);
    expect(roadGeometry(10, 10, true, 100).done).toBe(roadGeometry(10, 10, true, 100).ahead);
  });

  it("points to the next chapter, and says when a closed one shows", () => {
    expect(nextChapterSign(2, 2, 2)).toEqual({
      index: 3,
      name: "La Bibliothèque",
      open: true,
      note: "Chapitre III · Niveaux 21 à 30",
    });
    expect(nextChapterSign(4, 2, 2)).toMatchObject({
      name: "L'Académie",
      open: false,
      note: "Tu le verras au niveau 21.",
    });
  });
});
