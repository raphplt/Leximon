import { describe, expect, it } from "vitest";
import { createSeededRandom, type RandomSource, randomInt } from "./random";

const SEED = "0123456789abcdef0123456789abcdef";

/** Independent transcription of PractRand's C reference, with 64-bit-safe BigInt arithmetic. */
function referenceSfc32(seedHex: string): () => number {
  const mask = 0xffffffffn;
  const word = (index: number) => BigInt(`0x${seedHex.slice(index * 8, index * 8 + 8)}`);
  let a = word(0);
  let b = word(1);
  let c = word(2);
  let d = word(3);
  const next = (): number => {
    const tmp = (a + b + d) & mask; // tmp = a + b + counter++
    d = (d + 1n) & mask;
    a = b ^ (b >> 9n);
    b = (c + (c << 3n)) & mask;
    c = ((((c << 21n) | (c >> 11n)) & mask) + tmp) & mask;
    return Number(tmp);
  };
  for (let i = 0; i < 15; i++) next();
  return next;
}

describe("createSeededRandom", () => {
  it("matches the SFC32 reference algorithm", () => {
    const random = createSeededRandom(SEED);
    const reference = referenceSfc32(SEED);
    for (let i = 0; i < 1000; i++) {
      expect(random.nextUint32()).toBe(reference());
    }
  });

  it("gives the same sequence for the same seed", () => {
    const first = createSeededRandom(SEED);
    const second = createSeededRandom(SEED);
    const sequence = (random: RandomSource) =>
      Array.from({ length: 50 }, () => random.nextUint32());
    expect(sequence(first)).toEqual(sequence(second));
  });

  it("gives different sequences for different seeds", () => {
    const first = createSeededRandom(SEED);
    const second = createSeededRandom("0123456789abcdef0123456789abcdee");
    expect(first.nextUint32()).not.toBe(second.nextUint32());
  });

  it.each(["", "0123", `${SEED}00`, SEED.toUpperCase(), "z".repeat(32)])(
    "rejects an invalid seed: %j",
    (seed) => {
      expect(() => createSeededRandom(seed)).toThrow(RangeError);
    },
  );
});

describe("randomInt", () => {
  it("stays within range", () => {
    const random = createSeededRandom(SEED);
    for (let i = 0; i < 10_000; i++) {
      const value = randomInt(random, 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it("is uniform", () => {
    const random = createSeededRandom(SEED);
    const draws = 300_000;
    const counts = [0, 0, 0];
    for (let i = 0; i < draws; i++) {
      const value = randomInt(random, 3);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    // Each count is within 5 standard deviations of draws / 3.
    const sigma = Math.sqrt(draws * (1 / 3) * (2 / 3));
    for (const count of counts) {
      expect(Math.abs(count - draws / 3)).toBeLessThan(5 * sigma);
    }
  });

  it("rejects values just above the unbiased limit", () => {
    // 2^32 % 3 = 1, so 2^32 - 1 is the only value to reject for a range of 3.
    const values = [2 ** 32 - 1, 5];
    const scripted: RandomSource = { nextUint32: () => values.shift() ?? 0 };
    expect(randomInt(scripted, 3)).toBe(5 % 3);
  });

  it.each([0, -1, 1.5, 2 ** 32 + 1, Number.NaN])("rejects an invalid range: %d", (max) => {
    expect(() => randomInt(createSeededRandom(SEED), max)).toThrow(RangeError);
  });
});
