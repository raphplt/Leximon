import { describe, expect, it } from "vitest";
import { decodeTradeCursor, encodeTradeCursor } from "./cursor";

describe("trade cursors", () => {
  it("round-trip and stay URL-safe", () => {
    const cursor = { createdAt: 1_792_000_000_123, id: "0b6f3c1e-8a3d-4f5e-9c2b-7d1a2e3f4a5b" };
    const encoded = encodeTradeCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeTradeCursor(encoded)).toEqual(cursor);
  });

  it.each([
    ["not base64", "%%%"],
    ["not JSON", btoa("nope")],
    ["wrong shape", btoa(JSON.stringify({ createdAt: 1, id: "x" }))],
    ["not a UUID", btoa(JSON.stringify([1, "x'; drop table trades; --"]))],
    ["negative time", btoa(JSON.stringify([-1, "0b6f3c1e-8a3d-4f5e-9c2b-7d1a2e3f4a5b"]))],
  ])("reject a malformed cursor: %s", (_label, value) => {
    expect(decodeTradeCursor(value)).toBeUndefined();
  });
});
