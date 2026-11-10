import type { AdminJoustSuspect, AdminJoustSuspectsResponse } from "@leximon/contract";
import { type EpochMs, JOUST_SUSPICION, suspicionReasons } from "@leximon/core";
import type { Database } from "@leximon/db";
import { sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Jousters shown at once: the list is read by a person. */
const SUSPECTS_PAGE = 100;

/**
 * `GET /admin/joust-suspects`: the jousters whose ranked answers of the last days look scripted
 * or looked up. One pass over the window's questions, read by the back office only: no index
 * serves it, and none is worth its cost on every answer written.
 */
export async function listJoustSuspects(
  db: Database,
  now: EpochMs,
): Promise<AdminJoustSuspectsResponse> {
  const rules = JOUST_SUSPICION;
  const since = new Date(now - rules.windowMs).toISOString();
  const answerMs = sql`extract(epoch from (q.answered_at - q.served_at)) * 1000`;
  const { rows } = await db.execute<{
    user_id: string;
    banned: boolean | null;
    served: number;
    correct: number;
    median_ms: number | null;
    spread_ms: number | null;
  }>(sql`
    select q.answerer_id as user_id, u.banned,
      count(*)::int as served,
      (count(*) filter (where q.correct))::int as correct,
      round(percentile_cont(0.5) within group (order by ${answerMs}))::int as median_ms,
      round(percentile_cont(0.9) within group (order by ${answerMs})
        - percentile_cont(0.1) within group (order by ${answerMs}))::int as spread_ms
    from joust_questions q
    join jousts j on j.id = q.joust_id
    join users u on u.id = q.answerer_id
    where j.kind = 'ranked' and q.served_at > ${since}
    group by q.answerer_id, u.banned
    having count(*) >= ${rules.minServed}
  `);

  const flagged = rows
    .flatMap((row) => {
      const stats = {
        served: row.served,
        correct: row.correct,
        medianMs: row.median_ms,
        spreadMs: row.spread_ms,
      };
      const reasons = suspicionReasons(rules, stats);
      const { medianMs, spreadMs } = stats;
      if (reasons.length === 0 || medianMs === null || spreadMs === null) return [];
      return [
        { ...stats, medianMs, spreadMs, userId: row.user_id, reasons, banned: row.banned === true },
      ];
    })
    .sort((a, b) => a.medianMs - b.medianMs)
    .slice(0, SUSPECTS_PAGE);

  const badges = await readBadges(
    db,
    flagged.map((suspect) => suspect.userId),
    now,
  );
  return {
    windowDays: Math.round(rules.windowMs / DAY_MS),
    suspects: flagged.map(
      (suspect): AdminJoustSuspect => ({
        ...suspect,
        player: badges.get(suspect.userId) ?? null,
      }),
    ),
  };
}
