import { describe, expect, it } from "vitest";
import { CHANGELOG, type ChangelogEntry, changelogDate, newsToShow } from "./changelog";

const entry = (date: string): ChangelogEntry => ({ date, title: date, items: ["Un changement."] });
const LOG = [entry("2026-11-10"), entry("2026-11-05"), entry("2026-11-01"), entry("2026-10-29")];

describe("changelog", () => {
  it("keeps its entries newest first, each with something to say", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
    }
  });

  it("shows what came out since the last entry seen, three at most", () => {
    expect(newsToShow("2026-11-01", 12, LOG).entries.map((e) => e.date)).toEqual([
      "2026-11-10",
      "2026-11-05",
    ]);
    expect(newsToShow("2026-11-10", 12, LOG).entries).toEqual([]);
    expect(newsToShow(null, 12, LOG).entries).toHaveLength(3);
    expect(newsToShow("2026-11-01", 12, LOG).seen).toBe("2026-11-10");
  });

  it("spares a new player the news of the past", () => {
    expect(newsToShow(null, 2, LOG)).toEqual({ entries: [], seen: "2026-11-10" });
  });

  it("dates an entry in French", () => {
    expect(changelogDate("2026-10-29")).toBe("29 octobre 2026");
    expect(changelogDate("2026-11-01")).toBe("1er novembre 2026");
  });
});
