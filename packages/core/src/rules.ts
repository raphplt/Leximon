/**
 * Game settings in force over time.
 *
 * To change a setting, append a new period with its start date. Never edit or remove a past
 * period: players' wallets and the draw audit depend on what was in force at the time.
 */

import type { DrawSchedule } from "./booster/draw";
import type { RefillSchedule } from "./booster/refill";

const MINUTE = 60_000;
const SINCE_LAUNCH = Number.MIN_SAFE_INTEGER;

export const REFILL_SCHEDULE: RefillSchedule = [
  { startsAt: SINCE_LAUNCH, capacity: 6, intervalMs: 30 * MINUTE },
];

export const DRAW_SCHEDULE: DrawSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    cardsPerBooster: 5,
    // Per 10,000: 60 %, 25 %, 10 %, 4 %, 0.9 %, 0.1 %.
    weights: {
      common: 6000,
      uncommon: 2500,
      rare: 1000,
      precious: 400,
      epic: 90,
      legendary: 10,
    },
    guaranteedMinRarity: "uncommon",
    pity: { afterBoosters: 10, minRarity: "precious" },
  },
];
