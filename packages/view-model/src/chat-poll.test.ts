import { describe, expect, it } from "vitest";
import { chatPollDelay } from "./chat-poll";

describe("the discussion's polling", () => {
  it("asks every 4 s while messages come", () => {
    expect(chatPollDelay(0)).toBe(4_000);
  });

  it("waits longer after each quiet poll, up to 25 s", () => {
    const delays = Array.from({ length: 8 }, (_, quiet) => chatPollDelay(quiet));
    expect(delays).toEqual([4_000, 6_000, 9_000, 13_500, 20_250, 25_000, 25_000, 25_000]);
  });
});
