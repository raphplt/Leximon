import { describe, expect, it } from "vitest";
import { levelsOfFeatures } from "./features";
import { closedTabs, mailCount, tabBadge } from "./shell";

const NOW = Date.parse("2026-10-25T12:00:00.000Z");
const levels = levelsOfFeatures(NOW);

describe("closedTabs", () => {
  it("closes trades until their level, and nothing before the level is known", () => {
    expect(closedTabs(null, NOW).size).toBe(0);
    expect([...closedTabs(1, NOW)]).toEqual(["echanges"]);
    expect(closedTabs(levels.trade, NOW).size).toBe(0);
  });
});

describe("counts", () => {
  it("puts offers on Échanges and coffrets on Jouer", () => {
    expect(tabBadge("echanges", { offers: 2, coffrets: 1 })).toBe(2);
    expect(tabBadge("jouer", { offers: 2, coffrets: 1 })).toBe(1);
    expect(tabBadge("album", { offers: 2, coffrets: 1 })).toBe(0);
  });

  it("adds up what waits in the mail", () => {
    expect(
      mailCount({ coffrets: 1, welcome: 1, goalSachets: 2, referralSachets: 0, unread: 3 }),
    ).toBe(7);
  });
});
