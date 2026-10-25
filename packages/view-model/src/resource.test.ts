import { afterEach, describe, expect, it, vi } from "vitest";
import { sharedResource } from "./resource";

afterEach(() => {
  vi.useRealTimers();
});

function counting<T>(values: readonly T[]) {
  let calls = 0;
  const resource = sharedResource(async () => {
    const value = values[Math.min(calls, values.length - 1)];
    calls++;
    if (value === undefined) throw new Error("no value");
    return value;
  });
  return { resource, calls: () => calls };
}

describe("a shared resource's read", () => {
  it("reads the API once for screens that ask at the same time, then reuses the copy", async () => {
    const { resource, calls } = counting(["first", "second"]);
    expect(await Promise.all([resource.read(), resource.read()])).toEqual(["first", "first"]);
    expect(await resource.read()).toBe("first");
    expect(calls()).toBe(1);
  });

  it("reads the API again once the copy is older than asked", async () => {
    vi.useFakeTimers();
    const { resource, calls } = counting(["first", "second"]);
    await resource.read(60_000);
    vi.advanceTimersByTime(30_000);
    expect(await resource.read(60_000)).toBe("first");
    vi.advanceTimersByTime(31_000);
    expect(await resource.read(60_000)).toBe("second");
    expect(calls()).toBe(2);
  });

  it("keeps what an action published, without counting it as a read of the API", async () => {
    const { resource, calls } = counting(["read"]);
    resource.publish("published");
    expect(await resource.read()).toBe("published");
    expect(await resource.read(60_000)).toBe("read");
    expect(calls()).toBe(1);
  });

  it("reports a failed read, and tries again next time", async () => {
    let fail = true;
    const resource = sharedResource(async () => {
      if (fail) throw new Error("down");
      return "back";
    });
    await expect(resource.read()).rejects.toThrow("down");
    fail = false;
    expect(await resource.read()).toBe("back");
  });

  it("says it failed until a retry starts, and tells the screens each time", async () => {
    let fail = true;
    const resource = sharedResource(async () => {
      if (fail) throw new Error("down");
      return "back";
    });
    const seen: boolean[] = [];
    resource.subscribe(() => seen.push(resource.failed()));
    await resource.read().catch(() => {});
    expect(resource.failed()).toBe(true);

    fail = false;
    resource.ensure();
    expect(resource.failed()).toBe(false);
    expect(await resource.read()).toBe("back");
    expect(seen).toEqual([true, false, false]);
  });
});
