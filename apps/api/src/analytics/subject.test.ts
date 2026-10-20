import { describe, expect, it } from "vitest";
import { analyticsSubject } from "./subject";

describe("analyticsSubject", () => {
  it("gives a player the same 128-bit subject every time", async () => {
    const subject = await analyticsSubject("secret", "user-1");
    expect(subject).toMatch(/^[0-9a-f]{32}$/);
    expect(await analyticsSubject("secret", "user-1")).toBe(subject);
  });

  it("depends on the secret, so the log alone cannot be traced back", async () => {
    expect(await analyticsSubject("other", "user-1")).not.toBe(
      await analyticsSubject("secret", "user-1"),
    );
    expect(await analyticsSubject("secret", "user-2")).not.toBe(
      await analyticsSubject("secret", "user-1"),
    );
  });
});
