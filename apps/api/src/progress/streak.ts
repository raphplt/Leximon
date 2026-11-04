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
  const played = new Set(result.rows.map((row) => row.day));
  return streakOf(streakRulesAt(STREAK_SCHEDULE, now), played, gameDayOf(now).key);
}
