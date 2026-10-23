/**
 * Game settings in force over time.
 *
 * To change a setting, append a new period with its start date. Never edit or remove a past
 * period: players' wallets and the draw audit depend on what was in force at the time.
 */

import type { GuestSchedule } from "./account/guest-limit";
import type { PseudoSchedule } from "./account/pseudo";
import type { BonusSchedule } from "./bonus/bonus";
import type { DrawSchedule } from "./booster/draw";
import type { RefillSchedule } from "./booster/refill";
import type { ClanSchedule } from "./clan/clan";
import type { ClanGoalSchedule } from "./clan/goal";
import type { ClanLevelRules } from "./clan/level";
import type { MasterySchedule } from "./mastery/mastery";
import type { XpSchedule } from "./progress/progress";
import type { LevelRewardSchedule } from "./progress/rewards";
import type { UnlockSchedule } from "./progress/unlocks";
import type { TradeSchedule } from "./trade/trade";

const MINUTE = 60_000;
const SINCE_LAUNCH = Number.MIN_SAFE_INTEGER;
/** Midnight in Paris on 2026-10-21, when the owner decided level rewards and features by level. */
const LEVELS_DECIDED = Date.UTC(2026, 9, 20, 22);
/** Midnight in Paris on 2026-10-23, when the owner decided levels on proven recall. */
const PROVEN_RECALL_DECIDED = Date.UTC(2026, 9, 22, 22);

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
    // Calibrated by simulation (docs/rnd/collection-sim.md). Never shown to players.
    pity: [
      { minRarity: "epic", afterBoosters: 40 },
      { minRarity: "legendary", afterBoosters: 150 },
    ],
  },
];

const DAY = 24 * 60 * MINUTE;

// FSRS targets 90 % recall. Since proven recall, a level needs a right answer that many days
// after the previous review.
export const MASTERY_SCHEDULE: MasterySchedule = [
  {
    startsAt: SINCE_LAUNCH,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
    levelBy: "stability",
  },
  {
    startsAt: PROVEN_RECALL_DECIDED,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
    levelBy: "provenRecall",
  },
];

// Trade guards.
export const TRADE_SCHEDULE: TradeSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    offerTtlMs: 3 * DAY,
    cardsPerSide: [{ fromLevel: 1, maxCards: 3 }],
    offersPerDay: 10,
    minLevel: 5,
    heldRarity: "epic",
    heldForMs: 7 * DAY,
  },
  // One card for one from level 5, up to three per side from level 10.
  {
    startsAt: LEVELS_DECIDED,
    offerTtlMs: 3 * DAY,
    cardsPerSide: [
      { fromLevel: 5, maxCards: 1 },
      { fromLevel: 10, maxCards: 3 },
    ],
    offersPerDay: 10,
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

// Experience of the account level. Starting values, to calibrate by simulation.
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

// Boosters a guest opens before an account is required.
export const GUEST_SCHEDULE: GuestSchedule = [{ startsAt: SINCE_LAUNCH, boostersBeforeSignup: 2 }];

// Level rewards. Titles are provisional.
export const LEVEL_REWARD_SCHEDULE: LevelRewardSchedule = [
  {
    startsAt: LEVELS_DECIDED,
    milestoneEvery: 5,
    majorEvery: 10,
    titles: {
      5: "Lexicographe en herbe",
      15: "Fine plume",
      25: "Rat de bibliothèque",
      35: "Grand glossateur",
      45: "Puits de science",
    },
    reserveSlotsUntil: 50,
    pinnedSlotsUntil: 30,
    pinnedSlotsAtStart: 3,
    cosmeticsOnlyAbove: 50,
    avatarEveryBeyond: 20,
    garniMinRarity: "rare",
    // Engraved avatars: portraits from the cards' engravings, named by their card id.
    startingAvatars: [
      "metaphraste",
      "bachelette",
      "grimelin",
      "cassandre",
      "preopinant",
      "ricanerie",
    ],
    avatars: {
      10: "metoposcope",
      20: "fanfreluche",
      30: "cuistre",
      40: "fluteau",
      50: "chatieur",
      60: "soupette",
      80: "encaveur",
      100: "bequillard",
      120: "zani",
      140: "pochon",
    },
    startingFrame: "simple",
    frames: { 10: "gilded", 20: "ink" },
  },
];

// Pseudo of a player.
export const PSEUDO_SCHEDULE: PseudoSchedule = [
  { startsAt: SINCE_LAUNCH, minLength: 3, maxLength: 20, changeEveryMs: 30 * 24 * 60 * MINUTE },
];

// Clans. Emblem engravings are provisional, like the avatars.
export const CLAN_SCHEDULE: ClanSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    nameMinLength: 3,
    nameMaxLength: 30,
    mottoMaxLength: 80,
    messageMaxLength: 500,
    messageIntervalMs: 2_000,
    chiefAbsenceMs: 14 * 24 * 60 * MINUTE,
    muteDurationsMs: [60 * MINUTE, 24 * 60 * MINUTE, 7 * 24 * 60 * MINUTE],
    messageRetentionMs: 90 * 24 * 60 * MINUTE,
    emblemEngravings: [
      "aiguiere",
      "aumoniere",
      "baudrier",
      "bougette",
      "alcarraza",
      "boghei",
      "archiere",
      "accastillage",
    ],
    emblemColors: ["sang", "or", "indigo", "vert-de-gris", "ocre", "prune", "craie", "encre"],
  },
];

// The clan's own level. Starting values, to be checked by simulation.
export const CLAN_LEVEL: ClanLevelRules = {
  curve: { base: 500, step: 250 },
  illuminatedLevel: 5,
  bannerFrom: 10,
  bannerEvery: 5,
  banners: [
    "bucephale",
    "astrolatre",
    "bordigue",
    "boulingrin",
    "asclepiion",
    "argyropee",
    "approcheur",
    "barbouquine",
  ],
  emblemUnlocks: [
    { kind: "color", id: "vermillon" },
    { kind: "engraving", id: "antitonnerre" },
    { kind: "color", id: "turquoise" },
    { kind: "engraving", id: "brisoir" },
    { kind: "color", id: "argent" },
    { kind: "engraving", id: "calige" },
    { kind: "color", id: "safran" },
    { kind: "engraving", id: "barbette" },
    { kind: "color", id: "azur" },
    { kind: "engraving", id: "cabasset" },
    { kind: "color", id: "emeraude" },
    { kind: "engraving", id: "brimborion" },
    { kind: "color", id: "corail" },
    { kind: "engraving", id: "artison" },
    { kind: "color", id: "bronze" },
    { kind: "engraving", id: "appeau" },
  ],
};

// Weekly goal of a clan, in correct challenge answers, and the clan XP a week brings. Targets
// are provisional.
export const CLAN_GOAL_SCHEDULE: ClanGoalSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    answersPerActiveMember: { bronze: 15, silver: 30, gold: 50, illuminated: 60 },
    activeWindowMs: 7 * 24 * 60 * MINUTE,
    minContribution: 15,
    bonusBoosters: { bronze: 0, silver: 1, gold: 1, illuminated: 1 },
    xpPerAnswer: 1,
    answersCountedPerMember: 100,
    tierXp: { bronze: 50, silver: 100, gold: 200, illuminated: 300 },
  },
];

// Features opened by level; trade levels are in TRADE_SCHEDULE.
export const UNLOCK_SCHEDULE: UnlockSchedule = [
  {
    startsAt: LEVELS_DECIDED,
    levels: {
      choose_collection: 3,
      public_profile: 8,
      join_clan: 10,
      create_clan: 15,
      jousts: 15,
    },
    // A stable slug of the catalog.
    starterCollection: "fondateurs",
  },
];
