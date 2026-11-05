/**
 * Daily missions: three a day (Paris time), drawn so that each day changes and so that most of
 * them lead away from what the player does most. A mission the player cannot do is never drawn.
 * The player may change one mission a day. Each mission done gives XP and écus, the three of a
 * day a bonus sachet. What a mission gives is known before it is done.
 *
 * Progress is read from what the player did that day, never kept apart: nothing to write on the
 * paths that make it move.
 *
 * Concurrency: these functions are pure. Callers draw a day once (its primary key) and claim
 * under the player's wallet lock.
 */

import type { EpochMs } from "../booster/refill";
import { type RandomSource, randomInt } from "../random";

export const MISSION_KINDS = [
  "open_sachets",
  "good_answers",
  "write_words",
  "review_collection",
  "riddle",
  "trade",
  "recycle",
  "joust",
] as const;
export type MissionKind = (typeof MISSION_KINDS)[number];

/** What the player does to move a mission: the favourite one is the most frequent. */
export const MISSION_GESTURES = [
  "sachets",
  "challenges",
  "riddle",
  "trades",
  "recycle",
  "jousts",
] as const;
export type MissionGesture = (typeof MISSION_GESTURES)[number];

export const GESTURE_OF: Readonly<Record<MissionKind, MissionGesture>> = {
  open_sachets: "sachets",
  good_answers: "challenges",
  write_words: "challenges",
  review_collection: "challenges",
  riddle: "riddle",
  trade: "trades",
  recycle: "recycle",
  joust: "jousts",
};

/** A mission of a day: how much of what, and for one kind, which collection. */
export type Mission =
  | {
      readonly kind: Exclude<MissionKind, "review_collection">;
      readonly target: number;
    }
  | { readonly kind: "review_collection"; readonly target: number; readonly collectionId: string };

export interface MissionRules {
  /** Period start; the rules in force when a day is drawn apply to its missions. */
  readonly startsAt: EpochMs;
  /** Account level from which missions are drawn. */
  readonly opensAtLevel: number;
  readonly perDay: number;
  /** Of the missions of a day, how many at least lead away from the favourite gesture. */
  readonly awayFromFavourite: number;
  /** Missions a player may change in a day. */
  readonly changesPerDay: number;
  /** What each mission asks. */
  readonly targets: Readonly<Record<MissionKind, number>>;
  /** What each mission done gives. */
  readonly xp: number;
  readonly ecus: number;
  /** Bonus sachets once all the missions of a day are claimed. */
  readonly allDoneBoosters: number;
  /** Days back a mission done and not claimed can still be claimed. */
  readonly claimableDays: number;
  /** Days back the favourite gesture is measured. */
  readonly favouriteWindowDays: number;
}

export type MissionSchedule = readonly [MissionRules, ...MissionRules[]];

export function missionRulesAt(schedule: MissionSchedule, time: EpochMs): MissionRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

/** What the player can do on the day of a draw. */
export interface MissionContext {
  /** Kinds the player can do today: the others are never drawn. */
  readonly feasible: ReadonlySet<MissionKind>;
  /** Collections with enough words of the player to review, for `review_collection`. */
  readonly collections: readonly string[];
  readonly favourite: MissionGesture | null;
  /** Kinds drawn the day before: avoided when there are enough others. */
  readonly yesterday: readonly MissionKind[];
}

/**
 * The gesture of the most days among the last ones, or `null` with none. Ties go to the first
 * of `MISSION_GESTURES`, the sachet first: most players start there.
 */
export function favouriteGesture(
  days: Readonly<Partial<Record<MissionGesture, number>>>,
): MissionGesture | null {
  let favourite: MissionGesture | null = null;
  let most = 0;
  for (const gesture of MISSION_GESTURES) {
    const count = days[gesture] ?? 0;
    if (count > most) {
      favourite = gesture;
      most = count;
    }
  }
  return favourite;
}

/**
 * Draws the missions of a day: distinct kinds, at most `perDay - awayFromFavourite` of the
 * favourite gesture, distinct gestures while there are enough, yesterday's kinds last. Fewer
 * missions when the player can do fewer kinds.
 */
export function drawMissions(
  rules: MissionRules,
  context: MissionContext,
  random: RandomSource,
): Mission[] {
  const missions: Mission[] = [];
  while (missions.length < rules.perDay) {
    const next = drawOne(rules, context, missions, random);
    if (next === null) break;
    missions.push(next);
  }
  return missions;
}

/**
 * A new mission in place of the one at `slot`, under the same constraints as the draw and of
 * another kind than every mission of the day; `null` when there is none.
 */
export function changeMission(
  rules: MissionRules,
  context: MissionContext,
  missions: readonly Mission[],
  slot: number,
  random: RandomSource,
): Mission | null {
  const replaced = missions[slot];
  if (replaced === undefined) return null;
  const others = missions.filter((_, index) => index !== slot);
  return drawOne(
    rules,
    { ...context, yesterday: [...context.yesterday, replaced.kind] },
    others,
    random,
    replaced.kind,
  );
}

function drawOne(
  rules: MissionRules,
  context: MissionContext,
  drawn: readonly Mission[],
  random: RandomSource,
  excluded?: MissionKind,
): Mission | null {
  const favouriteAllowed = rules.perDay - rules.awayFromFavourite;
  const favouriteCount = drawn.filter(
    (mission) => GESTURE_OF[mission.kind] === context.favourite,
  ).length;
  const candidates = MISSION_KINDS.filter(
    (kind) =>
      kind !== excluded &&
      context.feasible.has(kind) &&
      (kind !== "review_collection" || context.collections.length > 0) &&
      !drawn.some((mission) => mission.kind === kind) &&
      (GESTURE_OF[kind] !== context.favourite || favouriteCount < favouriteAllowed),
  );
  const gestures = new Set(drawn.map((mission) => GESTURE_OF[mission.kind]));
  const preferred = [
    candidates.filter(
      (kind) => !gestures.has(GESTURE_OF[kind]) && !context.yesterday.includes(kind),
    ),
    candidates.filter((kind) => !gestures.has(GESTURE_OF[kind])),
    candidates.filter((kind) => !context.yesterday.includes(kind)),
    candidates,
  ].find((pool) => pool.length > 0);
  if (preferred === undefined) return null;
  const kind = preferred[randomInt(random, preferred.length)] ?? preferred[0];
  if (kind === undefined) return null;
  const target = rules.targets[kind];
  if (kind !== "review_collection") return { kind, target };
  const collectionId = context.collections[randomInt(random, context.collections.length)];
  return collectionId === undefined ? null : { kind, target, collectionId };
}

/** What the player did on a day, as missions count it. */
export interface DayActivity {
  readonly sachets: number;
  readonly goodAnswers: number;
  readonly wordsWritten: number;
  /** Right answers by collection of the word. */
  readonly goodAnswersByCollection: Readonly<Record<string, number>>;
  readonly riddleFound: boolean;
  readonly trades: number;
  readonly recycles: number;
  /** Own runs of jousts finished. */
  readonly jousts: number;
}

/** How far a mission is, capped at its target. */
export function missionProgress(mission: Mission, activity: DayActivity): number {
  const done = (() => {
    switch (mission.kind) {
      case "open_sachets":
        return activity.sachets;
      case "good_answers":
        return activity.goodAnswers;
      case "write_words":
        return activity.wordsWritten;
      case "review_collection":
        return activity.goodAnswersByCollection[mission.collectionId] ?? 0;
      case "riddle":
        return activity.riddleFound ? 1 : 0;
      case "trade":
        return activity.trades;
      case "recycle":
        return activity.recycles;
      case "joust":
        return activity.jousts;
    }
  })();
  return Math.min(done, mission.target);
}

export function missionDone(mission: Mission, activity: DayActivity): boolean {
  return missionProgress(mission, activity) >= mission.target;
}

/** A drawn day and what was already claimed of it. */
export interface MissionDay {
  readonly day: string;
  readonly missions: readonly Mission[];
  readonly claimed: readonly number[];
  readonly bonusClaimed: boolean;
}

/** What a claim gives for one day: the slots done and not claimed yet, and whether the bonus. */
export interface MissionDayClaim {
  readonly day: string;
  readonly slots: readonly number[];
  /** All the missions of the day are claimed with this claim, and the bonus not yet. */
  readonly bonus: boolean;
}

export function claimOfDay(
  rules: MissionRules,
  day: MissionDay,
  activity: DayActivity,
): MissionDayClaim {
  const slots = day.missions.flatMap((mission, slot) =>
    !day.claimed.includes(slot) && missionDone(mission, activity) ? [slot] : [],
  );
  const claimedAfter = day.claimed.length + slots.length;
  return {
    day: day.day,
    slots,
    bonus:
      !day.bonusClaimed &&
      rules.allDoneBoosters > 0 &&
      day.missions.length > 0 &&
      claimedAfter === day.missions.length,
  };
}
