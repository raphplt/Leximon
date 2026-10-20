/**
 * Game settings in force over time.
 *
 * To change a setting, append a new period with its start date. Never edit or remove a past
 * period: players' wallets and the draw audit depend on what was in force at the time.
 */

import type { GuestSchedule } from "./account/guest-limit";
import type { BonusSchedule } from "./bonus/bonus";
import type { DrawSchedule } from "./booster/draw";
import type { RefillSchedule } from "./booster/refill";
import type { MasterySchedule } from "./mastery/mastery";
import type { XpSchedule } from "./progress/progress";
import type { TradeSchedule } from "./trade/trade";

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
    // Calibrated by simulation (docs/rnd/collection-sim.md). Never shown to players (P17).
    pity: [
      { minRarity: "epic", afterBoosters: 40 },
      { minRarity: "legendary", afterBoosters: 150 },
    ],
  },
];

const DAY = 24 * 60 * MINUTE;

// FSRS targets 90 % recall; levels follow memory stability (D-025).
export const MASTERY_SCHEDULE: MasterySchedule = [
  {
    startsAt: SINCE_LAUNCH,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
  },
];

// Trade guards (D-026).
export const TRADE_SCHEDULE: TradeSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    offerTtlMs: 3 * DAY,
    maxCardsPerSide: 3,
    offersPerDay: 10,
    minAccountAgeMs: 3 * DAY,
    minLevel: 5,
    heldRarity: "epic",
    heldForMs: 7 * DAY,
  },
];

// Bonus boosters earned through challenges, kept in a reserve apart from the free stock.
export const BONUS_SCHEDULE: BonusSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    dailyGoal: { answers: 5, correct: 3 },
    dailyReward: 1,
    gildedReward: 1,
    reserveCap: 10,
  },
];

// Experience of the account level (P48). Starting values, to calibrate by simulation.
export const XP_SCHEDULE: XpSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    boosterOpened: 10,
    firstBoosterOfDay: 20,
    newWord: { common: 5, uncommon: 10, rare: 15, precious: 25, epic: 35, legendary: 50 },
    correctAnswer: 15,
    masteryLevelUp: 25,
    tradeCompleted: 20,
  },
];

// Boosters a guest opens before an account is required (P37).
export const GUEST_SCHEDULE: GuestSchedule = [{ startsAt: SINCE_LAUNCH, boostersBeforeSignup: 2 }];
