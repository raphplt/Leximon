import { sql } from "drizzle-orm";
import type { Database } from "../client";

/**
 * Figures of one A/B test, per variant, read from the event log (D-030): the measures named in
 * docs/cahiers-des-charges/ouverture.md. Days are counted in Paris time. Only the log is read,
 * never game tables: the measurement stays apart from players' data.
 */
export interface VariantFigures {
  readonly variant: string;
  /** Players seen at least once since `since`. */
  readonly players: number;
  readonly openings: number;
  /** Days with at least one event, over all players. */
  readonly activeDays: number;
  readonly finished: number;
  /** Openings finished through « Tout révéler ». */
  readonly skipped: number;
  /** Players whose first day is old enough to measure a return on day 1, and those who came back. */
  readonly day1Eligible: number;
  readonly day1Returned: number;
  readonly day7Eligible: number;
  readonly day7Returned: number;
}

interface Row extends Record<string, unknown> {
  variant: string;
  players: string;
  openings: string;
  active_days: string;
  finished: string;
  skipped: string;
  day1_eligible: string;
  day1_returned: string;
  day7_eligible: string;
  day7_returned: string;
}

export async function experimentFigures(
  db: Database,
  experimentKey: string,
  since: Date,
  now: Date,
): Promise<VariantFigures[]> {
  const { rows } = await db.execute<Row>(sql`
    with events as (
      select subject, name, props, variants ->> ${experimentKey} as variant,
             (received_at at time zone 'Europe/Paris')::date as day
      from analytics_events
      where received_at >= ${since} and received_at < ${now} and variants ? ${experimentKey}
    ),
    players as (
      select subject, variant, min(day) as first_day from events group by subject, variant
    ),
    days as (select distinct subject, day from events),
    today as (select (${now}::timestamptz at time zone 'Europe/Paris')::date as day)
    select p.variant,
      count(*) as players,
      (select count(*) from events e where e.variant = p.variant and e.name = 'opening_started') as openings,
      (select count(*) from days d join players q using (subject) where q.variant = p.variant) as active_days,
      (select count(*) from events e where e.variant = p.variant and e.name = 'opening_finished') as finished,
      (select count(*) from events e where e.variant = p.variant and e.name = 'opening_finished'
         and e.props ->> 'revealed' = 'all_at_once') as skipped,
      count(*) filter (where p.first_day + 1 < (select day from today)) as day1_eligible,
      count(*) filter (where p.first_day + 1 < (select day from today) and exists (
        select 1 from days d where d.subject = p.subject and d.day = p.first_day + 1)) as day1_returned,
      count(*) filter (where p.first_day + 7 < (select day from today)) as day7_eligible,
      count(*) filter (where p.first_day + 7 < (select day from today) and exists (
        select 1 from days d where d.subject = p.subject and d.day = p.first_day + 7)) as day7_returned
    from players p
    group by p.variant
    order by p.variant`);
  return rows.map((row) => ({
    variant: row.variant,
    players: Number(row.players),
    openings: Number(row.openings),
    activeDays: Number(row.active_days),
    finished: Number(row.finished),
    skipped: Number(row.skipped),
    day1Eligible: Number(row.day1_eligible),
    day1Returned: Number(row.day1_returned),
    day7Eligible: Number(row.day7_eligible),
    day7Returned: Number(row.day7_returned),
  }));
}
