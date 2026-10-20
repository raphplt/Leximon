import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { analyticsEvents } from "../schema/index";
import { testDatabaseUrl } from "../testing";
import { experimentFigures } from "./report";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

const KEY = `report-test-${crypto.randomUUID()}`;
const DAY = 24 * 60 * 60 * 1000;
const start = Date.parse("2026-11-02T10:00:00Z");

function event(subject: string, variant: string, dayOffset: number, name: string, props = {}) {
  const at = new Date(start + dayOffset * DAY);
  return { subject, name, props, variants: { [KEY]: variant }, occurredAt: at, receivedAt: at };
}

describe("experimentFigures", () => {
  it("counts players, openings, skips and returns per variant", async () => {
    await db.insert(analyticsEvents).values([
      // Variant A: one player back on day 1 and day 7, who skipped one opening out of two.
      event("a1", "a", 0, "page_viewed", { page: "boosters" }),
      event("a1", "a", 0, "opening_started", { shape: "pli", via: "tear" }),
      event("a1", "a", 0, "opening_finished", {
        shape: "pli",
        revealed: "one_by_one",
        durationMs: 9000,
      }),
      event("a1", "a", 1, "opening_started", { shape: "pli", via: "touch" }),
      event("a1", "a", 1, "opening_finished", {
        shape: "pli",
        revealed: "all_at_once",
        durationMs: 3000,
      }),
      event("a1", "a", 7, "page_viewed", { page: "album" }),
      // Variant B: two players, none came back.
      event("b1", "b", 0, "page_viewed", { page: "boosters" }),
      event("b2", "b", 0, "opening_started", { shape: "sachet", via: "tear" }),
      // Another experiment's events are ignored.
      { ...event("c1", "a", 0, "page_viewed", { page: "boosters" }), variants: { other: "a" } },
    ]);
    const figures = await experimentFigures(
      db,
      KEY,
      new Date(start - DAY),
      new Date(start + 10 * DAY),
    );
    expect(figures).toEqual([
      {
        variant: "a",
        players: 1,
        openings: 2,
        activeDays: 3,
        finished: 2,
        skipped: 1,
        day1Eligible: 1,
        day1Returned: 1,
        day7Eligible: 1,
        day7Returned: 1,
      },
      {
        variant: "b",
        players: 2,
        openings: 1,
        activeDays: 2,
        finished: 0,
        skipped: 0,
        day1Eligible: 2,
        day1Returned: 0,
        day7Eligible: 2,
        day7Returned: 0,
      },
    ]);
  });
});
