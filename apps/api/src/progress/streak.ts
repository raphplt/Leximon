import {
  type EpochMs,
  gameDayOf,
  STREAK_SCHEDULE,
  type Streak,
  streakOf,
  streakRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { sql } from "drizzle-orm";

const { boosterOpens, practiceAnswers, reviewLogs, riddlePlays } = schema;

/**
 * The player's streak, read from what they did rather than kept apart: nothing to write on the
 * paths that make a day count, and nothing to repair if one of them fails. Each source is read by
 * its index on the player.
 */
export async function readStreak(db: Database, userId: string, now: EpochMs): Promise<Streak> {
  const played = await readPlayedDays(db, userId);
  return streakOf(streakRulesAt(STREAK_SCHEDULE, now), played, gameDayOf(now).key);
}

/**
 * The days a player played (keys `YYYY-MM-DD`, Paris time): a sachet opened, a challenge
 * answered or the riddle played. The streak and the carnet both count them.
 */
export async function readPlayedDays(
  db: Pick<Database, "execute">,
  userId: string,
): Promise<Set<string>> {
  const result = await db.execute<{ day: string }>(sql`
    select (${boosterOpens.openedAt} at time zone 'Europe/Paris')::date::text as day
      from ${boosterOpens} where ${boosterOpens.userId} = ${userId}
    union
    select (${reviewLogs.reviewedAt} at time zone 'Europe/Paris')::date::text
      from ${reviewLogs} where ${reviewLogs.userId} = ${userId}
    union
    select (${practiceAnswers.answeredAt} at time zone 'Europe/Paris')::date::text
      from ${practiceAnswers} where ${practiceAnswers.userId} = ${userId}
    union
    select ${riddlePlays.day}::text from ${riddlePlays} where ${riddlePlays.userId} = ${userId}
  `);
  return new Set(result.rows.map((row) => row.day));
}
