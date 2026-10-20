import { describe, expect, it } from "vitest";
import { cardRelease, peekAmount, stackRelease, tearProgress } from "./gesture";

describe("tearProgress", () => {
  it("measures the share of the strip torn, from either end", () => {
    expect(tearProgress(0, 300)).toBe(0);
    expect(tearProgress(150, 300)).toBe(0.5);
    expect(tearProgress(-150, 300)).toBe(0.5);
  });

  it("stays between 0 and 1", () => {
    expect(tearProgress(900, 300)).toBe(1);
    expect(tearProgress(50, 0)).toBe(0);
  });
});

describe("peekAmount", () => {
  it("fans the stack out on a diagonal drag only", () => {
    expect(peekAmount(60, 60)).toBeGreaterThan(0.5);
    expect(peekAmount(-40, 50)).toBeGreaterThan(0);
    expect(peekAmount(0, -100)).toBe(0);
    expect(peekAmount(100, 4)).toBe(0);
  });

  it("ignores a tiny move and caps a long one", () => {
    expect(peekAmount(5, 5)).toBe(0);
    expect(peekAmount(400, 400)).toBe(1);
  });
});

describe("stackRelease", () => {
  it("reveals on a tap or a swipe up", () => {
    expect(stackRelease(2, 3)).toBe("reveal");
    expect(stackRelease(10, -80)).toBe("reveal");
  });

  it("springs back after a peek or a swipe down", () => {
    expect(stackRelease(70, 70)).toBe("none");
    expect(stackRelease(0, 80)).toBe("none");
  });
});

describe("cardRelease", () => {
  it("shows the next card on a tap or a long enough swipe", () => {
    expect(cardRelease(1, 1, 300)).toBe("next");
    expect(cardRelease(-120, 10, 300)).toBe("next");
  });

  it("springs back on a short drag", () => {
    expect(cardRelease(50, 0, 300)).toBe("none");
  });
});
