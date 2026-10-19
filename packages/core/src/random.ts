/**
 * Deterministic randomness for game draws.
 *
 * The server generates a 128-bit seed with a cryptographic generator for each draw, stores it,
 * and expands it here with SFC32. A draw is therefore unpredictable before it happens and exactly
 * reproducible afterwards (audit, support, probability checks).
 */

export interface RandomSource {
  /** Next unsigned 32-bit integer. */
  nextUint32(): number;
}

const SEED_HEX = /^[0-9a-f]{32}$/;
const UINT32_RANGE = 2 ** 32;
/** Outputs discarded after seeding, as recommended for SFC32. */
const WARM_UP_ROUNDS = 15;

/** Creates a random source from a 128-bit seed written as 32 lowercase hex characters. */
export function createSeededRandom(seedHex: string): RandomSource {
  if (!SEED_HEX.test(seedHex)) {
    throw new RangeError("seed must be 32 lowercase hexadecimal characters");
  }

  let a = Number.parseInt(seedHex.slice(0, 8), 16);
  let b = Number.parseInt(seedHex.slice(8, 16), 16);
  let c = Number.parseInt(seedHex.slice(16, 24), 16);
  let d = Number.parseInt(seedHex.slice(24, 32), 16);

  // SFC32 as in PractRand (Chris Doty-Humphrey): `d` is the counter, used before incrementing.
  const nextUint32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (((c << 21) | (c >>> 11)) + t) | 0;
    return t >>> 0;
  };

  for (let round = 0; round < WARM_UP_ROUNDS; round++) {
    nextUint32();
  }
  return { nextUint32 };
}

/** Uniform integer in `[0, maxExclusive)`, without modulo bias. */
export function randomInt(random: RandomSource, maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new RangeError(`maxExclusive must be an integer between 1 and 2^32, got ${maxExclusive}`);
  }

  // Values at or above `limit` would make some results more likely than others.
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  for (;;) {
    const value = random.nextUint32();
    if (value < limit) {
      return value % maxExclusive;
    }
  }
}
