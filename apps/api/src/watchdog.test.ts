import { describe, expect, it, vi } from "vitest";
import { backupIsFresh, nextWatch, recordCheck, watchMessage } from "./watchdog";

const MINUTE_MS = 60_000;
const NOW = 1_800_000_000_000;

function memoryStore() {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe("nextWatch", () => {
  const healthy = { failures: 0, since: null, alerted: false };

  it("stays silent after a single failure", () => {
    const { watch, notice } = nextWatch(healthy, false, NOW);
    expect(notice).toBeNull();
    expect(watch).toEqual({ failures: 1, since: NOW, alerted: false });
  });

  it("alerts at the second failure in a row, keeping the first failure's time", () => {
    const first = nextWatch(healthy, false, NOW).watch;
    const { watch, notice } = nextWatch(first, false, NOW + 5 * MINUTE_MS);
    expect(notice).toBe("down");
    expect(watch).toEqual({ failures: 2, since: NOW, alerted: true });
  });

  it("alerts only once per incident", () => {
    const alerted = { failures: 2, since: NOW, alerted: true };
    expect(nextWatch(alerted, false, NOW + 10 * MINUTE_MS).notice).toBeNull();
  });

  it("forgets a failure that recovered before any alert", () => {
    const first = nextWatch(healthy, false, NOW).watch;
    expect(nextWatch(first, true, NOW + 5 * MINUTE_MS)).toEqual({ watch: healthy, notice: null });
  });

  it("announces the recovery of an alerted incident", () => {
    const alerted = { failures: 3, since: NOW, alerted: true };
    expect(nextWatch(alerted, true, NOW + 15 * MINUTE_MS)).toEqual({
      watch: healthy,
      notice: "up",
    });
  });
});

describe("recordCheck", () => {
  it("writes nothing while everything is healthy", async () => {
    const store = memoryStore();
    const notify = vi.fn(async () => true);
    await recordCheck({ store, notify }, "database", true, NOW);
    expect(store.put).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("names the outage's real length when the database comes back", async () => {
    const store = memoryStore();
    const notify = vi.fn(async (_: string) => true);
    const deps = { store, notify };
    await recordCheck(deps, "database", false, NOW);
    await recordCheck(deps, "database", false, NOW + 5 * MINUTE_MS);
    await recordCheck(deps, "database", true, NOW + 20 * MINUTE_MS);
    expect(notify.mock.calls.map(([content]) => content)).toEqual([
      watchMessage("database", "down", 5),
      watchMessage("database", "up", 20),
    ]);
  });

  it("tries again at the next run when Discord refuses the post", async () => {
    const store = memoryStore();
    const notify = vi.fn(async (_: string) => true);
    const deps = { store, notify };
    await recordCheck(deps, "backup", false, NOW);
    notify.mockResolvedValueOnce(false);
    await recordCheck(deps, "backup", false, NOW + 5 * MINUTE_MS);
    await recordCheck(deps, "backup", false, NOW + 10 * MINUTE_MS);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(JSON.parse(store.values.get("watch:backup") ?? "{}")).toMatchObject({ alerted: true });
  });

  it("keeps each service's state apart", async () => {
    const store = memoryStore();
    const deps = { store, notify: vi.fn(async () => true) };
    await recordCheck(deps, "database", false, NOW);
    await recordCheck(deps, "backup", false, NOW + 5 * MINUTE_MS);
    expect(deps.notify).not.toHaveBeenCalled();
  });
});

describe("backupIsFresh", () => {
  it("accepts a dump younger than three hours", () => {
    expect(backupIsFresh([new Date(NOW - 179 * MINUTE_MS)], NOW)).toBe(true);
  });

  it("rejects an older dump, and an empty bucket", () => {
    expect(backupIsFresh([new Date(NOW - 180 * MINUTE_MS)], NOW)).toBe(false);
    expect(backupIsFresh([], NOW)).toBe(false);
  });

  it("looks at the newest dump", () => {
    const uploads = [new Date(NOW - 500 * MINUTE_MS), new Date(NOW - 60 * MINUTE_MS)];
    expect(backupIsFresh(uploads, NOW)).toBe(true);
  });
});

describe("watchMessage", () => {
  it("agrees with a single minute", () => {
    expect(watchMessage("database", "up", 1)).toContain("après 1 minute de coupure");
  });

  it("agrees with several minutes", () => {
    expect(watchMessage("database", "down", 5)).toContain("depuis 5 minutes");
  });
});
