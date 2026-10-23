import { describe, expect, it } from "vitest";
import { inBatches } from "./purge";

describe("inBatches", () => {
  it("runs the statement until a batch comes back short, and sums what it touched", async () => {
    let left = 7;
    const limits: number[] = [];
    const total = await inBatches(async (limit) => {
      limits.push(limit);
      const touched = Math.min(limit, left);
      left -= touched;
      return { rowCount: touched };
    }, 3);
    expect(total).toBe(7);
    expect(limits).toEqual([3, 3, 3]);
  });

  it("stops after one statement when nothing matches, a full batch needs one more", async () => {
    let calls = 0;
    expect(await inBatches(async () => ({ rowCount: calls++ === 0 ? null : 0 }), 3)).toBe(0);
    expect(calls).toBe(1);
    let left = 3;
    calls = 0;
    const total = await inBatches(async (limit) => {
      calls++;
      const touched = Math.min(limit, left);
      left -= touched;
      return { rowCount: touched };
    }, 3);
    expect([total, calls]).toEqual([3, 2]);
  });
});
