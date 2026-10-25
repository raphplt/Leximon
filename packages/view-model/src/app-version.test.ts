import { describe, expect, it } from "vitest";
import { versionBelow } from "./app-version";

describe("versionBelow", () => {
  it("compares each part as a number, major first", () => {
    expect(versionBelow("1.9.0", "1.10.0")).toBe(true);
    expect(versionBelow("2.0.0", "1.10.3")).toBe(false);
    expect(versionBelow("1.2.3", "1.2.4")).toBe(true);
  });

  it("lets the minimum itself through", () => {
    expect(versionBelow("1.2.0", "1.2.0")).toBe(false);
  });

  it("never blocks on an unreadable version", () => {
    expect(versionBelow("1.2", "9.0.0")).toBe(false);
    expect(versionBelow("1.0.0", "next")).toBe(false);
  });
});
