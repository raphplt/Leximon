import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { keepsAnnouncementWhenHurried, stagingFor } from "./staging";

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
