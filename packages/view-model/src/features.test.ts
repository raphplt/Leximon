import { xpToReach } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  featureMilestones,
  isFeatureOpen,
  lockedScreen,
  lockedToast,
  opensAt,
  unlocksAhead,
} from "./features";

const NOW = Date.UTC(2026, 9, 22);

describe("features by level", () => {
  it("opens each feature at its level", () => {
    expect(isFeatureOpen("choose_collection", 2, NOW)).toBe(false);
    expect(isFeatureOpen("choose_collection", 3, NOW)).toBe(true);
    expect(isFeatureOpen("trade", 5, NOW)).toBe(true);
    expect(isFeatureOpen("trade_three", 9, NOW)).toBe(false);
  });

  it("names what a level opens", () => {
    expect(opensAt(5, NOW)).toBe("Les échanges");
    expect(opensAt(10, NOW)).toBe("Les échanges à 3 cartes, les clans");
    expect(opensAt(4, NOW)).toBeNull();
    expect(featureMilestones(NOW)).toEqual([3, 5, 8, 10, 15]);
  });

  it("lists what is still closed, with the level that opens it", () => {
    expect(unlocksAhead(8, NOW)).toEqual([
      { level: 10, text: "Les échanges à 3 cartes, les clans" },
      { level: 15, text: opensAt(15, NOW) },
    ]);
    expect(unlocksAhead(15, NOW)).toEqual([]);
  });

  it("describes a closed feature until it opens", () => {
    const screen = lockedScreen("join_clan", { level: 7, xp: 950 }, NOW);
    expect(screen).toMatchObject({
      level: 10,
      title: "Les clans ouvrent au niveau 10",
      left: "Encore 3 niveaux",
    });
    expect(screen?.ratio).toBeCloseTo(950 / xpToReach(10));
    expect(lockedScreen("join_clan", { level: 10, xp: xpToReach(10) }, NOW)).toBeNull();
    expect(lockedScreen("trade", { level: 4, xp: 400 }, NOW)?.left).toBe("Encore 1 niveau");
  });

  it("says the level of a closed control", () => {
    expect(lockedToast("choose_collection", NOW)).toBe(
      "Tu pourras choisir la collection de ton sachet au niveau 3.",
    );
  });
});
