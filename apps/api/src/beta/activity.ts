import { type EpochMs, gameDayOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";

/**
 * Notes that the player opened the game today (Paris time), the basis of retention. Called from
 * the route every screen loads once; a second call the same day changes nothing.
 */
export async function recordPlayedDay(db: Database, userId: string, now: EpochMs): Promise<void> {
  await db
    .insert(schema.playerDays)
    .values({ userId, day: gameDayOf(now).key })
    .onConflictDoNothing();
}
