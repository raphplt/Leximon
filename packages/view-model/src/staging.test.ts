import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { keepsAnnouncementWhenHurried, recapCascade, stagingFor } from "./staging";

const NORMAL = { reducedMotion: false, hurried: false };

describe("stagingFor", () => {
  it("makes the player wait longer as the rarity rises", () => {
    for (const [index, rarity] of RARITIES.entries()) {
      const next = RARITIES[index + 1];
      if (next === undefined) continue;
      expect(stagingFor(next, NORMAL).announceMs).toBeGreaterThanOrEqual(
        stagingFor(rarity, NORMAL).announceMs,
      );
    }
  });

  it("shows common cards at once and lets the player turn the rarest ones", () => {
    expect(stagingFor("common", NORMAL).flip).toBe("instant");
    expect(stagingFor("rare", NORMAL).flip).toBe("auto");
    expect(stagingFor("legendary", NORMAL).flip).toBe("touch");
    expect(stagingFor("legendary", NORMAL).spotlight).toBe(true);
  });

  it("drops every effect under reduced motion", () => {
    for (const rarity of RARITIES) {
      const staging = stagingFor(rarity, { reducedMotion: true, hurried: false });
      expect(staging.flip).toBe("instant");
      expect(staging.announceMs).toBe(0);
      expect(staging.dim).toBe(false);
    }
  });

  it("shortens the announcement and never waits for a touch when hurried", () => {
    const staging = stagingFor("epic", { reducedMotion: false, hurried: true });
    expect(staging.flip).toBe("auto");
    expect(staging.announceMs).toBeLessThan(stagingFor("epic", NORMAL).announceMs);
  });
});

describe("keepsAnnouncementWhenHurried", () => {
  it("keeps Épique and Légendaire only", () => {
    expect(RARITIES.filter(keepsAnnouncementWhenHurried)).toEqual(["epic", "legendary"]);
  });
});

describe("recapCascade", () => {
  const pack = [
    { rarity: "common" },
    { rarity: "uncommon" },
    { rarity: "rare" },
    { rarity: "precious" },
    { rarity: "epic" },
  ] as const;
  const motion = { reducedMotion: false };

  it("lands the cards one after the other", () => {
    const steps = recapCascade(pack, () => true, motion);
    expect(steps.map((step) => step.delayMs)).toEqual([0, 80, 160, 240, 320]);
  });

  it("makes the cards from Rare up shine", () => {
    const steps = recapCascade(pack, () => true, motion);
    expect(steps.map((step) => step.glint)).toEqual([false, false, true, true, true]);
  });

  it("chimes only for the rare cards the player has not seen turned over", () => {
    const skippedFromRare = (index: number) => index < 2 || index === 4;
    const steps = recapCascade(pack, skippedFromRare, motion);
    expect(steps.map((step) => step.cue)).toEqual([null, null, "chimeRare", "chimePrecious", null]);
  });

  it("lays every card at once, without effect, under reduced motion", () => {
    const steps = recapCascade(pack, () => false, { reducedMotion: true });
    expect(steps.every((step) => step.delayMs === 0 && !step.glint && step.cue === null)).toBe(
      true,
    );
  });
});
