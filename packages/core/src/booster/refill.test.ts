import { describe, expect, it } from "vitest";
import {
  type BoosterWallet,
  capacityAt,
  computeRefill,
  consumeBooster,
  createFullWallet,
  type EpochMs,
  fixedSchedule,
  intervalAt,
  type RefillSchedule,
  refillToFull,
} from "./refill";

const MINUTE = 60_000;
const T0: EpochMs = Date.UTC(2026, 9, 19, 12, 0, 0);
const at = (minutes: number): EpochMs => T0 + minutes * MINUTE;

const schedule = fixedSchedule(10, 10 * MINUTE);
const wallet = (stored: number, progressMinutes = 0, asOfMinutes = 0): BoosterWallet => ({
  stored,
  progressMs: progressMinutes * MINUTE,
  asOf: at(asOfMinutes),
});

/** Ten boosters every 10 minutes, then a change at `changeAtMinutes`. */
const scheduleChangingAt = (
  changeAtMinutes: number,
  change: { capacity?: number; intervalMinutes?: number },
): RefillSchedule => [
  { startsAt: Number.MIN_SAFE_INTEGER, capacity: 10, intervalMs: 10 * MINUTE },
  {
    startsAt: at(changeAtMinutes),
    capacity: change.capacity ?? 10,
    intervalMs: (change.intervalMinutes ?? 10) * MINUTE,
  },
];

describe("computeRefill", () => {
  it("keeps a full stock full, with no pending refill", () => {
    expect(computeRefill(wallet(10), schedule, at(45))).toEqual({
      stored: 10,
      progressMs: 0,
      asOf: at(45),
      nextRefillAt: null,
    });
  });

  it("adds one booster per full interval and keeps partial progress", () => {
    expect(computeRefill(wallet(3), schedule, at(25))).toEqual({
      stored: 5,
      progressMs: 5 * MINUTE,
      asOf: at(25),
      nextRefillAt: at(30),
    });
  });

  it("counts an interval as complete exactly on its boundary", () => {
    expect(computeRefill(wallet(3), schedule, at(10))).toEqual({
      stored: 4,
      progressMs: 0,
      asOf: at(10),
      nextRefillAt: at(20),
    });
  });

  it("does not add anything before the interval completes", () => {
    expect(computeRefill(wallet(3), schedule, at(9))).toEqual({
      stored: 3,
      progressMs: 9 * MINUTE,
      asOf: at(9),
      nextRefillAt: at(10),
    });
  });

  it("builds on progress already accumulated", () => {
    expect(computeRefill(wallet(3, 7), schedule, at(5))).toEqual({
      stored: 4,
      progressMs: 2 * MINUTE,
      asOf: at(5),
      nextRefillAt: at(13),
    });
  });

  it("caps the stock at capacity and freezes the timer", () => {
    expect(computeRefill(wallet(8), schedule, at(24 * 60))).toEqual({
      stored: 10,
      progressMs: 0,
      asOf: at(24 * 60),
      nextRefillAt: null,
    });
  });

  it("ignores time going backwards (clock skew)", () => {
    expect(computeRefill(wallet(3, 0, 30), schedule, at(20))).toEqual({
      stored: 3,
      progressMs: 0,
      asOf: at(30),
      nextRefillAt: at(40),
    });
  });

  it("normalizes progress longer than an interval", () => {
    expect(computeRefill(wallet(3, 25), schedule, at(0))).toEqual({
      stored: 5,
      progressMs: 5 * MINUTE,
      asOf: at(0),
      nextRefillAt: at(5),
    });
  });

  it("returns the same state when called twice at the same moment", () => {
    const once = computeRefill(wallet(2), schedule, at(37));
    expect(computeRefill(once, schedule, at(37))).toEqual(once);
  });
});

describe("computeRefill when the capacity changes", () => {
  it("never confiscates boosters above a lowered capacity", () => {
    expect(computeRefill(wallet(10), fixedSchedule(8, 10 * MINUTE), at(30))).toEqual({
      stored: 10,
      progressMs: 0,
      asOf: at(30),
      nextRefillAt: null,
    });
  });

  it("resumes refilling once the stock drops below a lowered capacity", () => {
    const lowered = fixedSchedule(8, 10 * MINUTE);
    let current: BoosterWallet = wallet(10);
    const pending: (EpochMs | null)[] = [];
    for (let spent = 0; spent < 3; spent++) {
      const result = consumeBooster(current, lowered, at(30));
      if (!result.ok) throw new Error("expected a booster to spend");
      current = result.state;
      pending.push(result.state.nextRefillAt);
    }
    expect(current.stored).toBe(7);
    expect(pending).toEqual([null, null, at(40)]);
  });

  it("applies a raised capacity only from when it starts", () => {
    expect(computeRefill(wallet(10), scheduleChangingAt(60, { capacity: 12 }), at(75))).toEqual({
      stored: 11,
      progressMs: 5 * MINUTE,
      asOf: at(75),
      nextRefillAt: at(80),
    });
  });
});

describe("computeRefill when the interval changes", () => {
  it("does not apply a new interval to time already elapsed", () => {
    expect(
      computeRefill(wallet(0), scheduleChangingAt(60, { intervalMinutes: 5 }), at(62)),
    ).toEqual({
      stored: 6,
      progressMs: 2 * MINUTE,
      asOf: at(62),
      nextRefillAt: at(65),
    });
  });

  it("keeps the proportion of progress across the change", () => {
    // 8 of 10 minutes at the change becomes 4 of 5, then 2 more minutes complete a booster.
    expect(
      computeRefill(wallet(0), scheduleChangingAt(58, { intervalMinutes: 5 }), at(60)),
    ).toEqual({
      stored: 6,
      progressMs: 1 * MINUTE,
      asOf: at(60),
      nextRefillAt: at(64),
    });
  });

  it("accounts for a change already scheduled in the next refill time", () => {
    // At 57, 7 of 10 minutes becomes 3.5 of 5: the booster arrives 1.5 minutes later.
    const result = computeRefill(
      wallet(5, 2, 52),
      scheduleChangingAt(57, { intervalMinutes: 5 }),
      at(52),
    );
    expect(result.nextRefillAt).toBe(at(58.5));
  });
});

describe("computeRefill input validation", () => {
  const period = { startsAt: Number.MIN_SAFE_INTEGER, capacity: 10, intervalMs: MINUTE };

  it.each([
    ["no period", [] as unknown as RefillSchedule],
    ["capacity of 0", [{ ...period, capacity: 0 }]],
    ["fractional capacity", [{ ...period, capacity: 2.5 }]],
    ["interval of 0", [{ ...period, intervalMs: 0 }]],
    ["negative interval", [{ ...period, intervalMs: -MINUTE }]],
    ["non-finite interval", [{ ...period, intervalMs: Number.POSITIVE_INFINITY }]],
    [
      "periods out of order",
      [period, { ...period, startsAt: at(60) }, { ...period, startsAt: at(30) }],
    ],
    [
      "two periods starting together",
      [period, { ...period, startsAt: at(30) }, { ...period, startsAt: at(30) }],
    ],
  ])("rejects an invalid schedule: %s", (_label, badSchedule) => {
    expect(() => computeRefill(wallet(0), badSchedule as RefillSchedule, at(0))).toThrow(
      RangeError,
    );
  });

  it.each([
    ["negative stock", wallet(-1)],
    ["fractional stock", wallet(1.5)],
    ["negative progress", wallet(1, -1)],
    ["fractional progress", { stored: 1, progressMs: 0.5, asOf: at(0) }],
    ["non-integer date", { stored: 1, progressMs: 0, asOf: Number.NaN }],
  ])("rejects an invalid wallet: %s", (_label, badWallet) => {
    expect(() => computeRefill(badWallet, schedule, at(0))).toThrow(RangeError);
  });

  it("rejects a non-integer current time", () => {
    expect(() => computeRefill(wallet(0), schedule, Number.NaN)).toThrow(RangeError);
  });
});

describe("consumeBooster", () => {
  it("spends one booster and keeps progress towards the next one", () => {
    expect(consumeBooster(wallet(5), schedule, at(25))).toEqual({
      ok: true,
      state: { stored: 6, progressMs: 5 * MINUTE, asOf: at(25), nextRefillAt: at(30) },
    });
  });

  it("starts the timer when spending from a full stock", () => {
    expect(consumeBooster(wallet(10), schedule, at(90))).toEqual({
      ok: true,
      state: { stored: 9, progressMs: 0, asOf: at(90), nextRefillAt: at(100) },
    });
  });

  it("reports an empty stock as an outcome, with the next refill time", () => {
    expect(consumeBooster(wallet(0), schedule, at(4))).toEqual({
      ok: false,
      reason: "empty",
      nextRefillAt: at(10),
    });
  });

  it("can spend a booster that has just been refilled", () => {
    expect(consumeBooster(wallet(0), schedule, at(10))).toEqual({
      ok: true,
      state: { stored: 0, progressMs: 0, asOf: at(10), nextRefillAt: at(20) },
    });
  });
});

describe("refill economy", () => {
  /** Small deterministic PRNG so failures are reproducible. */
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const HORIZON_MINUTES = 3 * 24 * 60;

  /** Plays irregularly until the horizon, checking invariants after every action. */
  function playRandomly(rules: RefillSchedule, seed: number): number {
    const random = mulberry32(seed);
    let current: BoosterWallet = wallet(10);
    let obtained = 0;
    let minute = 0;

    while (minute <= HORIZON_MINUTES) {
      const now = at(minute);
      const result = consumeBooster(current, rules, now);
      if (result.ok) {
        current = result.state;
        obtained++;
      }

      const state = computeRefill(current, rules, now);
      expect(state.stored).toBeGreaterThanOrEqual(0);
      expect(state.asOf).toBe(now);
      if (state.nextRefillAt !== null) {
        expect(state.nextRefillAt).toBeGreaterThan(now);
      }

      // Bursts of activity and long absences.
      minute += random() < 0.8 ? Math.floor(random() * 15) : Math.floor(random() * 600);
    }
    return obtained;
  }

  it("gives a player who opens as soon as possible exactly the theoretical maximum", () => {
    let current: BoosterWallet = wallet(10);
    let obtained = 0;
    for (let minute = 0; minute <= HORIZON_MINUTES; minute++) {
      for (;;) {
        const result = consumeBooster(current, schedule, at(minute));
        if (!result.ok) break;
        current = result.state;
        obtained++;
      }
    }
    expect(obtained).toBe(10 + HORIZON_MINUTES / 10);
  });

  it.each([1, 2, 3, 42, 2026])("never beats the maximum with fixed rules (seed %i)", (seed) => {
    expect(playRandomly(schedule, seed)).toBeLessThanOrEqual(10 + HORIZON_MINUTES / 10);
  });

  it.each([1, 2, 3, 42, 2026])("stays within bounds when rules change (seed %i)", (seed) => {
    // A two-hour event every day: twice as fast, double capacity.
    const rules: RefillSchedule = [
      { startsAt: Number.MIN_SAFE_INTEGER, capacity: 10, intervalMs: 10 * MINUTE },
      ...[0, 1, 2].flatMap((day) => [
        { startsAt: at(day * 1440 + 600), capacity: 20, intervalMs: 5 * MINUTE },
        { startsAt: at(day * 1440 + 720), capacity: 10, intervalMs: 10 * MINUTE },
      ]),
    ];
    // Each event adds at most 120 / 5 boosters and 10 of extra capacity; each change at most 1.
    const bound = 10 + HORIZON_MINUTES / 10 + 3 * (120 / 5 + 10) + rules.length;
    expect(playRandomly(rules, seed)).toBeLessThanOrEqual(bound);
  });
});

describe("createFullWallet", () => {
  it("starts a new player with a full stock", () => {
    expect(createFullWallet(schedule, at(5))).toEqual({ stored: 10, progressMs: 0, asOf: at(5) });
  });

  it("uses the capacity in force at that moment", () => {
    expect(createFullWallet(scheduleChangingAt(60, { capacity: 12 }), at(61)).stored).toBe(12);
  });
});

describe("refillToFull", () => {
  const schedule = fixedSchedule(6, 1_000);

  it("fills the stock and stops the timer", () => {
    expect(refillToFull({ stored: 2, progressMs: 400, asOf: 0 }, schedule, 500)).toEqual({
      stored: 6,
      progressMs: 0,
      asOf: 500,
      nextRefillAt: null,
    });
  });

  it("refuses a stock already full, refilled meanwhile included", () => {
    expect(refillToFull({ stored: 6, progressMs: 0, asOf: 0 }, schedule, 0)).toBeNull();
    expect(refillToFull({ stored: 5, progressMs: 0, asOf: 0 }, schedule, 1_000)).toBeNull();
  });

  it("reads the capacity of the period in force", () => {
    expect(capacityAt(schedule, 0)).toBe(6);
  });

  it("reads the refill interval of the period in force", () => {
    expect(intervalAt(fixedSchedule(6, 30 * 60_000), 0)).toBe(30 * 60_000);
  });
});
