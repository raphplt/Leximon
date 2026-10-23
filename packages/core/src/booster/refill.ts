/**
 * Timed booster refill.
 *
 * A player regains one booster every `intervalMs`, up to `capacity`. Nothing runs on a schedule:
 * the stock is derived from the last persisted wallet and the current time, whenever it is read.
 *
 * Rules can change over time (a faster refill during an event, a new capacity) without rewriting
 * the past: each period of the schedule applies only to the time it covers.
 *
 * Concurrency: these functions are pure. Callers must serialize updates of a given wallet, by
 * reading and writing it in one transaction that holds a row lock (`SELECT … FOR UPDATE`), with an
 * idempotency key so that a retried request does not spend twice.
 *
 * Boosters earned through challenges are not handled here: they are a separate reserve, not
 * limited by `capacity` (see `bonus/bonus.ts`).
 */

/** Milliseconds since the Unix epoch (`Date.now()`). */
export type EpochMs = number;

export interface RefillPeriod {
  /** When this period starts. The first period of a schedule also covers any earlier time. */
  readonly startsAt: EpochMs;
  /** Maximum number of boosters that waiting can accumulate. Integer, at least 1. */
  readonly capacity: number;
  /** Time needed to regain one booster, in milliseconds. Positive integer. */
  readonly intervalMs: number;
}

/** Refill rules over time, sorted by strictly increasing `startsAt`. */
export type RefillSchedule = readonly [RefillPeriod, ...RefillPeriod[]];

/** What the server persists for each player. */
export interface BoosterWallet {
  /** Boosters held. May exceed the current capacity if it was lowered: nothing is confiscated. */
  readonly stored: number;
  /** Time accumulated towards the next booster, measured with the interval in force at `asOf`. */
  readonly progressMs: number;
  /** Moment the wallet was last brought up to date. */
  readonly asOf: EpochMs;
}

/** The wallet brought up to date at a given moment. */
export interface RefillState extends BoosterWallet {
  /** When the next booster arrives, or `null` if none is pending (stock at or above capacity). */
  readonly nextRefillAt: EpochMs | null;
}

export type ConsumeResult =
  | { readonly ok: true; readonly state: RefillState }
  | { readonly ok: false; readonly reason: "empty"; readonly nextRefillAt: EpochMs };

/** A schedule whose rules never change. */
export function fixedSchedule(capacity: number, intervalMs: number): RefillSchedule {
  return [{ startsAt: Number.MIN_SAFE_INTEGER, capacity, intervalMs }];
}

/** The wallet of a new player: a full stock at `now`. */
export function createFullWallet(schedule: RefillSchedule, now: EpochMs): BoosterWallet {
  assertValidSchedule(schedule);
  assertTimestamp(now, "now");
  const { capacity } = periodAt(schedule, periodIndexAt(schedule, now));
  return { stored: capacity, progressMs: 0, asOf: now };
}

/** Most boosters the free stock holds at `now`. */
export function capacityAt(schedule: RefillSchedule, now: EpochMs): number {
  assertValidSchedule(schedule);
  return periodAt(schedule, periodIndexAt(schedule, now)).capacity;
}

/** Time to regain one booster at `now`, in milliseconds. */
export function intervalAt(schedule: RefillSchedule, now: EpochMs): number {
  assertValidSchedule(schedule);
  return periodAt(schedule, periodIndexAt(schedule, now)).intervalMs;
}

/**
 * Brings `wallet` up to date at `now`.
 *
 * - Each full interval adds one booster, up to the capacity in force at that time.
 * - At or above capacity, the timer is frozen: progress is dropped and nothing accumulates.
 * - When the period changes, progress keeps its proportion: 80 % of the old interval becomes
 *   80 % of the new one.
 * - If `now` is before `asOf` (clock skew), nothing is gained and `asOf` never moves back.
 *
 * @throws {RangeError} on an invalid schedule, wallet or time: a programming error, not a game outcome.
 */
export function computeRefill(
  wallet: BoosterWallet,
  schedule: RefillSchedule,
  now: EpochMs,
): RefillState {
  assertValidSchedule(schedule);
  assertValidWallet(wallet);
  assertTimestamp(now, "now");

  const asOf = Math.max(now, wallet.asOf);
  const progress = advance(wallet, schedule, wallet.asOf, asOf);
  return { ...progress, asOf, nextRefillAt: findNextRefill(progress, schedule, asOf) };
}

/**
 * Spends one booster at `now`.
 *
 * An empty stock is an expected outcome, returned as `{ ok: false }`, not thrown.
 * Spending from a full stock starts the timer at `now`: time spent full is never banked.
 */
export function consumeBooster(
  wallet: BoosterWallet,
  schedule: RefillSchedule,
  now: EpochMs,
): ConsumeResult {
  const current = computeRefill(wallet, schedule, now);

  if (current.stored === 0) {
    // Capacity is at least 1 in every period, so an empty stock always has a refill pending.
    return { ok: false, reason: "empty", nextRefillAt: requirePending(current.nextRefillAt) };
  }

  // At capacity, progress is already 0: the timer starts from `asOf`.
  const spent: Progress = { stored: current.stored - 1, progressMs: current.progressMs };
  return {
    ok: true,
    state: {
      ...spent,
      asOf: current.asOf,
      nextRefillAt: findNextRefill(spent, schedule, current.asOf),
    },
  };
}

interface Progress {
  readonly stored: number;
  readonly progressMs: number;
}

/** Replays the schedule from `from` to `to` (`from <= to`), period by period. */
function advance(start: Progress, schedule: RefillSchedule, from: EpochMs, to: EpochMs): Progress {
  let progress: Progress = { stored: start.stored, progressMs: start.progressMs };
  let index = periodIndexAt(schedule, from);
  let cursor = from;

  for (;;) {
    const period = periodAt(schedule, index);
    const next = schedule[index + 1];
    const segmentEnd = next !== undefined && next.startsAt < to ? next.startsAt : to;

    progress = accrue(progress, period, segmentEnd - cursor);
    if (next === undefined || segmentEnd === to) {
      return progress;
    }

    progress = { ...progress, progressMs: rescale(progress.progressMs, period, next) };
    cursor = segmentEnd;
    index++;
  }
}

/** Applies `durationMs` of a single period. */
function accrue(progress: Progress, period: RefillPeriod, durationMs: number): Progress {
  const { stored } = progress;
  if (stored >= period.capacity) {
    return { stored, progressMs: 0 };
  }

  const total = progress.progressMs + durationMs;
  const gained = Math.floor(total / period.intervalMs);
  if (stored + gained >= period.capacity) {
    return { stored: period.capacity, progressMs: 0 };
  }

  return { stored: stored + gained, progressMs: total - gained * period.intervalMs };
}

/** When the next booster arrives from `from`, taking future periods into account. */
function findNextRefill(start: Progress, schedule: RefillSchedule, from: EpochMs): EpochMs | null {
  let { progressMs } = start;
  let index = periodIndexAt(schedule, from);
  let cursor = from;

  for (;;) {
    const period = periodAt(schedule, index);
    const next = schedule[index + 1];

    if (start.stored < period.capacity) {
      const due = cursor + (period.intervalMs - progressMs);
      if (next === undefined || due <= next.startsAt) {
        return due;
      }
      progressMs = rescale(progressMs + (next.startsAt - cursor), period, next);
    } else {
      progressMs = 0;
    }

    if (next === undefined) {
      return null;
    }
    cursor = next.startsAt;
    index++;
  }
}

/** Converts progress between intervals, keeping its proportion. Always below `to.intervalMs`. */
function rescale(progressMs: number, from: RefillPeriod, to: RefillPeriod): number {
  const scaled = Math.floor((progressMs / from.intervalMs) * to.intervalMs);
  return Math.min(scaled, to.intervalMs - 1);
}

/** Index of the period in force at `time`. */
function periodIndexAt(schedule: RefillSchedule, time: EpochMs): number {
  for (let index = schedule.length - 1; index > 0; index--) {
    if (periodAt(schedule, index).startsAt <= time) {
      return index;
    }
  }
  return 0;
}

function periodAt(schedule: RefillSchedule, index: number): RefillPeriod {
  const period = schedule[index];
  if (period === undefined) {
    throw new RangeError(`No refill period at index ${index}`);
  }
  return period;
}

function requirePending(nextRefillAt: EpochMs | null): EpochMs {
  if (nextRefillAt === null) {
    throw new Error("Invariant violated: an empty stock must have a refill pending");
  }
  return nextRefillAt;
}

function assertValidSchedule(schedule: RefillSchedule): void {
  if (schedule.length === 0) {
    throw new RangeError("schedule must contain at least one period");
  }

  let previousStart = Number.NEGATIVE_INFINITY;
  for (const { startsAt, capacity, intervalMs } of schedule) {
    assertTimestamp(startsAt, "startsAt");
    if (startsAt <= previousStart) {
      throw new RangeError("schedule periods must have strictly increasing startsAt");
    }
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`);
    }
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) {
      throw new RangeError(`intervalMs must be a positive integer, got ${intervalMs}`);
    }
    previousStart = startsAt;
  }
}

function assertValidWallet({ stored, progressMs, asOf }: BoosterWallet): void {
  if (!Number.isSafeInteger(stored) || stored < 0) {
    throw new RangeError(`stored must be a non-negative integer, got ${stored}`);
  }
  if (!Number.isSafeInteger(progressMs) || progressMs < 0) {
    throw new RangeError(`progressMs must be a non-negative integer, got ${progressMs}`);
  }
  assertTimestamp(asOf, "asOf");
}

function assertTimestamp(value: EpochMs, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be an integer timestamp in milliseconds, got ${value}`);
  }
}
