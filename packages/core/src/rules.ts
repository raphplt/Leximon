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
import type { EcuSchedule } from "./ecus/ecus";
import type { FriendSchedule } from "./friend/friend";
import type { JoustSchedule } from "./joust/joust";
import type { LeagueSchedule } from "./joust/leagues";
import type { MasterySchedule } from "./mastery/mastery";
import type { PracticeSchedule } from "./mastery/practice";
import type { NotifySchedule } from "./notify/notify";
import type { PatronSchedule } from "./patron/patron";
import type { BannerSchedule } from "./profile/banners";
import type { CarnetSchedule } from "./progress/carnet";
import type { MissionSchedule } from "./progress/missions";
import type { XpSchedule } from "./progress/progress";
import type { LevelRewardSchedule } from "./progress/rewards";
import type { StreakSchedule } from "./progress/streak";
import type { UnlockSchedule } from "./progress/unlocks";
import type { WelcomeSchedule } from "./progress/welcome";
import type { RiddleSchedule } from "./riddle/riddle";
import type { TradeSchedule } from "./trade/trade";

const MINUTE = 60_000;
const SINCE_LAUNCH = Number.MIN_SAFE_INTEGER;
// Midnight in Paris, 6 November 2026: profile, clans and jousts open at lower levels.
const SOCIAL_SOONER = Date.parse("2026-11-05T23:00:00Z");
/** Midnight in Paris on 2026-10-21, when the owner decided level rewards and features by level. */
const LEVELS_DECIDED = Date.UTC(2026, 9, 20, 22);
/** Midnight in Paris on 2026-10-23, when the owner decided levels on proven recall. */
const PROVEN_RECALL_DECIDED = Date.UTC(2026, 9, 22, 22);
/** Midnight in Paris on 2026-10-24, when the owner decided friends and friend links. */
const FRIENDS_DECIDED = Date.UTC(2026, 9, 23, 22);
/** Midnight in Paris on 2026-10-26, when the owner decided e-mail notifications. */
const NOTIFY_DECIDED = Date.UTC(2026, 9, 25, 23);
/** Midnight in Paris on 2026-10-30, when the owner decided practice series. */
const PRACTICE_DECIDED = Date.UTC(2026, 9, 29, 23);
/** Midnight in Paris on 2026-10-31, when the owner decided the riddle of the day. */
const RIDDLE_DECIDED = Date.UTC(2026, 9, 30, 23);
/** Midnight in Paris on 2026-11-01, when the owner gave the riddle more letters. */
const RIDDLE_MORE_LETTERS = Date.UTC(2026, 9, 31, 23);
// Midnight in Paris, 4 November 2026: the review comes first, cards start on a blank page.
const REVIEW_DECIDED = Date.UTC(2026, 10, 3, 23);
/**
 * Midnight in Paris on 2026-11-07: the economy decided on 2026-11-05 from the beta's figures
 * (slower clock, longer guest trial), a day after it was decided so testers hear of it first.
 */
const ECONOMY_DECIDED = Date.UTC(2026, 10, 6, 23);
// Profile banners, decided on 2026-11-08.
const BANNERS_DECIDED = Date.UTC(2026, 10, 7, 23);
// Midnight in Paris, 9 November 2026: fewer écus per mission, decided on
// 2026-11-08 after simulating every reward source together.
const REBALANCED = Date.UTC(2026, 10, 8, 23);
// 21:40 in Paris, 8 November 2026: the owner brought the smaller stock forward to that evening.
const STOCK_TRIMMED = Date.parse("2026-11-08T20:40:00Z");

export const REFILL_SCHEDULE: RefillSchedule = [
  { startsAt: SINCE_LAUNCH, capacity: 6, intervalMs: 30 * MINUTE },
  // The most assiduous opened 25 to 38 sachets a day: fewer fall from the clock, more are earned
  // by playing. Three visits a day keep about what they had.
  { startsAt: ECONOMY_DECIDED, capacity: 8, intervalMs: 60 * MINUTE },
  // The clock gave over 80 % of the sachets: no more than 6 pile up between two visits.
  { startsAt: STOCK_TRIMMED, capacity: 6, intervalMs: 60 * MINUTE },
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

// FSRS targets 90 % recall. Since proven recall, a level needs a right answer typed from memory
// that many days after the previous review; a word of 6 letters or more forgives one slip.
export const MASTERY_SCHEDULE: MasterySchedule = [
  {
    startsAt: SINCE_LAUNCH,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
    levelBy: "stability",
    slipToleranceFromLetters: 6,
    startLevel: "sketch",
  },
  {
    startsAt: PROVEN_RECALL_DECIDED,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
    levelBy: "provenRecall",
    slipToleranceFromLetters: 6,
    startLevel: "sketch",
  },
  {
    startsAt: REVIEW_DECIDED,
    requestRetention: 0.9,
    maximumIntervalDays: 365,
    levelThresholdDays: { ink: 7, gilded: 30 },
    levelBy: "provenRecall",
    slipToleranceFromLetters: 6,
    startLevel: "blank",
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
    rarityCompleted: {
      common: 100,
      uncommon: 150,
      rare: 250,
      precious: 400,
      epic: 600,
      legendary: 1000,
    },
  },
];

// Boosters a guest opens before an account is required.
// Most guests stopped exactly at the limit of 2: a full stock lets them see a challenge and a bonus.
export const GUEST_SCHEDULE: GuestSchedule = [
  { startsAt: SINCE_LAUNCH, boostersBeforeSignup: 2 },
  { startsAt: ECONOMY_DECIDED, boostersBeforeSignup: 6 },
];

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
      55: "Fort en thème",
      65: "Docteur ès mots",
      75: "Mémoire vivante",
      85: "Gardien du Littré",
      95: "Immortel",
      115: "Trésor de la langue",
      135: "Phénix des hôtes de ces bois",
    },
    reserveSlotsUntil: 50,
    pinnedSlotsUntil: 30,
    pinnedSlotsAtStart: 3,
    cosmeticsOnlyAbove: 50,
    avatarEveryBeyond: 20,
    garniMinRarity: "rare",
    preciousGarniMinRarity: "precious",
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
    frames: {
      10: "gilded",
      20: "ink",
      30: "pearls",
      40: "verdigris",
      50: "twist",
      60: "lace",
      70: "indigo",
      80: "wax",
      90: "rays",
      100: "bright-gold",
      120: "iridescent",
      150: "royal-sun",
    },
  },
];

const RECYCLE_VALUE = { common: 1, uncommon: 2, rare: 5, precious: 15, epic: 50, legendary: 200 };

// Calibrated on a regular player at 8 sachets a day (rnd/doublons-sim): a missing word costs eight
// times what recycling its rarity gives, a Légendaire about seven weeks of duplicates.
export const ECU_SCHEDULE: EcuSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    recycleValue: RECYCLE_VALUE,
    missingWordPrice: {
      common: 8,
      uncommon: 16,
      rare: 40,
      precious: 120,
      epic: 400,
      legendary: 1_600,
    },
    recycledTogether: ["common", "uncommon", "rare", "precious"],
    copiesKept: 2,
    perfectStart: { questions: 5, ecus: 5 },
  },
];

// Most players stopped after their first day: the welcome week gives a reason to come back the
// next ones, the best gift last. A gift only, so it starts when it ships.
export const WELCOME_SCHEDULE: WelcomeSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    days: [
      [{ kind: "bonus_booster" }, { kind: "bonus_booster" }],
      [{ kind: "garni_booster" }],
      [{ kind: "bonus_booster" }, { kind: "bonus_booster" }],
      // A beginner, for a beginner.
      [{ kind: "avatar", avatar: "bejaune" }],
      [{ kind: "garni_booster" }],
      [{ kind: "bonus_booster" }, { kind: "bonus_booster" }],
      [{ kind: "precious_garni_booster" }, { kind: "title", title: "Habitué des rayons" }],
    ],
  },
];

// Three missions a day lead the player to every part of the game. List and gains provisional.
export const MISSION_SCHEDULE: MissionSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    opensAtLevel: 2,
    perDay: 3,
    awayFromFavourite: 2,
    changesPerDay: 1,
    targets: {
      open_sachets: 3,
      good_answers: 5,
      write_words: 2,
      review_collection: 3,
      riddle: 1,
      trade: 1,
      recycle: 1,
      joust: 1,
    },
    xp: 30,
    ecus: 10,
    allDoneBoosters: 1,
    claimableDays: 7,
    favouriteWindowDays: 14,
  },
  // A Légendaire bought with écus came after two or three weeks instead of four to eight.
  {
    startsAt: REBALANCED,
    opensAtLevel: 2,
    perDay: 3,
    awayFromFavourite: 2,
    changesPerDay: 1,
    targets: {
      open_sachets: 3,
      good_answers: 5,
      write_words: 2,
      review_collection: 3,
      riddle: 1,
      trade: 1,
      recycle: 1,
      joust: 1,
    },
    xp: 30,
    ecus: 5,
    allDoneBoosters: 1,
    claimableDays: 7,
    favouriteWindowDays: 14,
  },
];

const ten = { kind: "ecus", amount: 10 } as const;
const sachet = { kind: "bonus_booster" } as const;
const garni = { kind: "garni_booster" } as const;

// After the welcome week, a carnet of 28 cases every 4 weeks, one case a day played. Periods
// start on Monday 2026-11-09, the calendar the seasons will follow. Rewards provisional; the last
// case will add the period's cosmetic once seasons have one.
export const CARNET_SCHEDULE: CarnetSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    firstPeriodDay: "2026-11-09",
    periodDays: 28,
    cases: Array.from({ length: 28 }, (_, index) => {
      const day = index + 1;
      if (day === 28) return [{ kind: "precious_garni_booster" } as const];
      if (day % 7 === 0) return [garni];
      if (day % 7 === 3) return [sachet];
      return [ten];
    }),
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
      practice_choice: 3,
      public_profile: 8,
      join_clan: 10,
      create_clan: 15,
      jousts: 15,
    },
    // A stable slug of the catalog.
    starterCollection: "fondateurs",
  },
  {
    // The social side comes sooner: most players had left before level 10.
    startsAt: SOCIAL_SOONER,
    levels: {
      choose_collection: 3,
      practice_choice: 3,
      public_profile: 5,
      join_clan: 5,
      create_clan: 10,
      jousts: 8,
    },
    starterCollection: "fondateurs",
  },
];

// Jousts: decks of 10 cards on 25 points, 5 drawn from each, 15 seconds a question. The clock is
// to be tried at 10, 15 and 20 seconds with the testers; gains provisional.
export const JOUST_SCHEDULE: JoustSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    openToAll: false,
    deckSize: 10,
    drawn: 5,
    deckBudget: 25,
    cost: { common: 1, uncommon: 2, rare: 3, precious: 4, epic: 5, legendary: 6 },
    minimumMastery: "sketch",
    choices: 4,
    answerMs: 15_000,
    graceMs: 2_000,
    runMs: 5 * MINUTE,
    replyMs: 24 * 60 * MINUTE,
    maxWaiting: 5,
    maxToPlay: 3,
    seenWithinMs: 24 * 60 * MINUTE,
    pairCooldownMs: 24 * 60 * MINUTE,
    xpPlayed: 20,
    xpWon: 20,
    rewardedPerDay: 5,
    firstWinBoosters: 1,
    glicko: {
      initial: { rating: 1500, deviation: 350, volatility: 0.06 },
      tau: 0.5,
      periodDays: 7,
    },
  },
];

// Leagues of ranked jousts, a tournament each week in groups of 30 filled by automatons. The
// automatons' points set how hard each league is to leave while the groups are not full: a player
// who wins one joust in two at 5 a day settles in the middle leagues. Provisional, from the
// simulation in rnd/tournament-sim.
export const LEAGUE_SCHEDULE: LeagueSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    firstWeekDay: "2026-11-09",
    groupSize: 30,
    rankedPerDay: 5,
    points: { won: 3, draw: 1, lost: 0 },
    moves: {
      page: { up: 10, down: 0 },
      ecuyer: { up: 8, down: 3 },
      chevalier: { up: 7, down: 5 },
      banneret: { up: 6, down: 5 },
      marechal: { up: 5, down: 6 },
      connetable: { up: 4, down: 7 },
      champion: { up: 0, down: 8 },
    },
    bots: {
      page: { mean: 5, spread: 5 },
      ecuyer: { mean: 20, spread: 10 },
      chevalier: { mean: 30, spread: 12 },
      banneret: { mean: 40, spread: 12 },
      marechal: { mean: 50, spread: 12 },
      connetable: { mean: 60, spread: 12 },
      champion: { mean: 70, spread: 12 },
    },
    weekEcus: {
      page: 10,
      ecuyer: 15,
      chevalier: 20,
      banneret: 25,
      marechal: 30,
      connetable: 35,
      champion: 40,
    },
    upRewards: [garni],
    championPodium: { places: 3, rewards: [{ kind: "precious_garni_booster" }] },
  },
];

// Review series: words due and new words first, then free practice on the most fragile words.
// The player picks the length and how many new words to start each day.
export const PRACTICE_SCHEDULE: PracticeSchedule = [
  {
    startsAt: PRACTICE_DECIDED,
    seriesSize: 10,
    minWords: 4,
    missedWindowMs: 30 * 24 * 60 * MINUTE,
    recentWords: 30,
    xpPerAnswer: 5,
    dailyXpCap: 100,
    lengths: [10],
    newWordsPerDay: [Number.MAX_SAFE_INTEGER],
    defaultNewWordsPerDay: Number.MAX_SAFE_INTEGER,
    newWordEvery: Number.MAX_SAFE_INTEGER,
    catchUps: 0,
    catchUpGap: 3,
    fragilePool: 1,
    dailyChallengeLength: 5,
    practiceCountsForDaily: false,
    hardSpelledPercent: 0,
    pairsWords: 4,
    pairsMinQuestions: Number.MAX_SAFE_INTEGER,
  },
  {
    startsAt: REVIEW_DECIDED,
    seriesSize: 10,
    minWords: 4,
    missedWindowMs: 30 * 24 * 60 * MINUTE,
    recentWords: 30,
    xpPerAnswer: 5,
    dailyXpCap: 100,
    lengths: [5, 10, 20],
    newWordsPerDay: [5, 10, 20],
    defaultNewWordsPerDay: 10,
    newWordEvery: 3,
    catchUps: 3,
    catchUpGap: 3,
    fragilePool: 3,
    dailyChallengeLength: 5,
    practiceCountsForDaily: true,
    hardSpelledPercent: 50,
    pairsWords: 4,
    pairsMinQuestions: 5,
  },
];

// The streak of days played.
export const STREAK_SCHEDULE: StreakSchedule = [{ startsAt: REVIEW_DECIDED, forgivenPerWeek: 2 }];

/** The day of riddle number 1, in Paris. */
export const RIDDLE_FIRST_DAY = "2026-10-31";

// The riddle of the day.
export const RIDDLE_SCHEDULE: RiddleSchedule = [
  {
    startsAt: RIDDLE_DECIDED,
    rarities: ["common", "uncommon"],
    minLetters: 5,
    maxLetters: 12,
    minDefinitionWords: 8,
    startLetters: 0,
    letterSteps: 3,
    hiddenLetters: null,
    xp: 50,
  },
  {
    startsAt: RIDDLE_MORE_LETTERS,
    rarities: ["common", "uncommon"],
    minLetters: 5,
    maxLetters: 12,
    minDefinitionWords: 8,
    startLetters: 1,
    letterSteps: 3,
    hiddenLetters: 2,
    xp: 50,
  },
];

// Friends, friend links and their feed.
export const FRIEND_SCHEDULE: FriendSchedule = [
  {
    startsAt: FRIENDS_DECIDED,
    maxFriends: 200,
    requestsPerDay: 20,
    maxPendingSent: 50,
    requestTtlMs: 30 * DAY,
    declinedCooldownMs: 7 * DAY,
    betaPlacesPerPlayer: 3,
    referralLevel: 5,
    referralRewardsPerMonth: 5,
    referralBoosters: 1,
    feedLevelStep: 5,
    feedTtlMs: 30 * DAY,
  },
];

export const NOTIFY_SCHEDULE: NotifySchedule = [
  {
    startsAt: NOTIFY_DECIDED,
    reminderDays: [1, 3, 7, 14, 30],
    reminderHour: 18,
    newsDelayMs: 30 * MINUTE,
    quietFromHour: 21,
    quietUntilHour: 8,
  },
];

/** "Proches de mon niveau" in the list of players: this many levels on each side. */
export const NEAR_LEVEL_SPREAD = 2;

// The profile's banner: eight free tints and motifs earned by level, league, a complete collection
// or écus. Price provisional; the season's motif comes with the season.
export const BANNER_SCHEDULE: BannerSchedule = [
  {
    startsAt: BANNERS_DECIDED,
    tints: ["bordeaux", "bottle", "prussian", "leather", "bishop", "ochre", "ink", "slate"],
    startingMotif: "plain",
    levels: { 15: "fleurons", 30: "scrolls", 45: "damask" },
    leagues: { chevalier: "checky", marechal: "quarterly", champion: "cloth_of_gold" },
    completeCollection: "binding",
    forEcus: { marbled: 250, printer: 250 },
  },
];

// The patron subscription. The founding month is set when sales open, and each month's cosmetic
// once it is drawn: a month is never announced before its 1st, whatever is written here.
export const PATRON_SCHEDULE: PatronSchedule = [
  {
    startsAt: SINCE_LAUNCH,
    trialDays: 14,
    prices: { monthly: 399, yearly: 2999 },
    foundingMonth: null,
    cosmetics: {},
    monthsPerFind: 3,
    extraPinnedSlots: 3,
    launchEditions: ["sanguine", "lavis", "encre"],
    editions: {},
  },
];
