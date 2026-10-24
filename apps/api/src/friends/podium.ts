import type { PodiumResponse } from "@leximon/contract";
import {
  crownedPlayers,
  type EpochMs,
  type GameDay,
  gameWeekOf,
  type PodiumEntry,
  rankPodium,
} from "@leximon/core";
import type { Database } from "@leximon/db";
import { sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { friendIdsOf } from "./friends";

type Reader = Pick<Database, "execute">;

/**
 * Correct challenge answers of these players over a week, from the answers log. Bounded by the
 * friends cap; each player is one range of the `(user_id, reviewed_at)` index.
 */
async function weekAnswers(
  db: Reader,
  userIds: readonly string[],
  week: GameDay,
): Promise<PodiumEntry[]> {
  if (userIds.length === 0) return [];
  const ids = sql.join(
    userIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute<{ user_id: string; answers: number }>(sql`
    select u.user_id, (select count(*)::int from review_logs r
      where r.user_id = u.user_id and r.correct
        and r.reviewed_at >= ${new Date(week.start)} and r.reviewed_at < ${new Date(week.end)}) as answers
    from unnest(array[${ids}]::text[]) as u(user_id)`);
  return result.rows.map((row) => ({ userId: row.user_id, answers: row.answers }));
}

/** `GET /me/friends/podium`: the player and their friends, on this week's correct answers. */
export async function readPodium(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<PodiumResponse> {
  const week = gameWeekOf(now);
  const players = [userId, ...(await friendIdsOf(db, userId, now))];
  const ranked = rankPodium(await weekAnswers(db, players, week));
  const badges = await readBadges(db, players, now);
  return {
    weekEnd: new Date(week.end).toISOString(),
    entries: ranked.flatMap((entry) => {
      const player = badges.get(entry.userId);
      return player === undefined
        ? []
        : [{ player, answers: entry.answers, rank: entry.rank, self: entry.userId === userId }];
    }),
  };
}

/**
 * Who of the player's friends wears the crown: first of last week's podium among the player and
 * their friends of today.
 */
export async function lastWeekCrowns(
  db: Database,
  userId: string,
  friendIds: readonly string[],
  now: EpochMs,
): Promise<ReadonlySet<string>> {
  if (friendIds.length === 0) return new Set();
  const lastWeek = gameWeekOf(gameWeekOf(now).start - 1);
  return crownedPlayers(await weekAnswers(db, [userId, ...friendIds], lastWeek));
}
