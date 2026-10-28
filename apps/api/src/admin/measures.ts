import {
  type AdminFeedbackResponse,
  type AdminMeasures,
  type AdminMeasuresQuery,
  type AdminTester,
  type AdminTestersResponse,
  ageBracketSchema,
  COHORT_DAYS,
  MEASURES_MAX_DAYS,
} from "@leximon/contract";
import { type EpochMs, gameDayOf, levelOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, isNull, type SQLWrapper, sql } from "drizzle-orm";
import { z } from "zod";
import { FRIEND_LINK_SOURCE } from "../beta/arrival";
import { decodeTimeCursor, nextCursor } from "./cursor";
import { InvalidCursorError } from "./queries";
import {
  addDays,
  cohortsFrom,
  type PlayerTrace,
  resolvePeriod,
  retentionBy,
  weekOf,
} from "./retention";

/** Where a player came from: their invitation's label, a friend link, or the `?src=` kept. */
const originSql = sql`coalesce(i.label, case when s.source = ${FRIEND_LINK_SOURCE} then 'Lien d''ami' else 'src:' || s.source end)`;

const {
  boosterOpens,
  guestLinks,
  invites,
  playerAgeBrackets,
  playerDays,
  playerFeedback,
  playerInterest,
  playerSignups,
  players,
  reviewLogs,
  trades,
  userProgress,
  users,
} = schema;

const NO_ORIGIN = "sans lien";
const NO_AGE = "non dit";

/**
 * Players the measures count: everyone seen at least one day, except admins (the owner testing)
 * and guests that became an account (their days moved to it).
 */
const counted = sql`
  coalesce(${users.role}, '') <> 'admin'
  and not exists (select 1 from ${guestLinks} where ${guestLinks.guestId} = ${users.id})
`;

type TraceRow = {
  first_day: string;
  d1: boolean;
  d7: boolean;
  d30: boolean;
  came_back: boolean;
  opened: boolean;
  answered: boolean;
  traded: boolean;
  member: boolean;
  origin: string | null;
  age: string | null;
};

type DailyRow = {
  day: string;
  active: number;
  arrived: number;
  boosters: number;
  answers: number;
  accounts: number;
};

interface Trace extends PlayerTrace {
  readonly origin: string;
  readonly age: string;
}

/** The start of a Paris day, as an instant: the bound of a range over timestamps. */
const parisStart = (day: string) => sql`(${day}::date)::timestamp at time zone 'Europe/Paris'`;
const parisDay = (column: SQLWrapper) => sql`(${column} at time zone 'Europe/Paris')::date`;

/**
 * Activity day by day, cohorts, the hours played, retention by week, origin and age, the funnel
 * and interest in the patron offer, over a period. `null` when the period is invalid.
 */
export async function readMeasures(
  db: Database,
  now: EpochMs,
  query: AdminMeasuresQuery,
): Promise<AdminMeasures | null> {
  const today = gameDayOf(now).key;
  const period = resolvePeriod(query, today, MEASURES_MAX_DAYS);
  if (period === null) return null;
  const { from, to, previousFrom, previousTo } = period;

  const [traces, daily, unique, cohorts, hours, active, interest, first] = await Promise.all([
    db.execute<TraceRow>(sql`
      with arrivals as (
        select ${playerDays.userId} as user_id, min(${playerDays.day}) as first_day
        from ${playerDays}
        join ${users} on ${users.id} = ${playerDays.userId}
        where ${counted}
        group by ${playerDays.userId}
        having min(${playerDays.day}) between ${from}::date and ${to}::date
      )
      select
        a.first_day::text as first_day,
        exists (select 1 from ${playerDays} d where d.user_id = a.user_id and d.day = a.first_day + 1) as d1,
        exists (select 1 from ${playerDays} d where d.user_id = a.user_id and d.day = a.first_day + 7) as d7,
        exists (select 1 from ${playerDays} d where d.user_id = a.user_id and d.day = a.first_day + 30) as d30,
        exists (select 1 from ${playerDays} d where d.user_id = a.user_id and d.day > a.first_day) as came_back,
        exists (select 1 from ${boosterOpens} o where o.user_id = a.user_id) as opened,
        exists (select 1 from ${reviewLogs} r where r.user_id = a.user_id) as answered,
        exists (
          select 1 from ${trades} t
          where t.status = 'completed' and (t.proposer_id = a.user_id or t.recipient_id = a.user_id)
        ) as traded,
        not u.is_anonymous as member,
        ${originSql} as origin,
        b.bracket as age
      from arrivals a
      join ${users} u on u.id = a.user_id
      left join ${playerSignups} s on s.user_id = a.user_id
      left join ${invites} i on i.id = s.invite_id
      left join ${playerAgeBrackets} b on b.user_id = a.user_id
    `),
    db.execute<DailyRow>(sql`
      with days as (
        select generate_series(${previousFrom}::date, ${to}::date, interval '1 day')::date as day
      ),
      active as (
        select ${playerDays.day} as day, count(*)::int as n
        from ${playerDays}
        join ${users} on ${users.id} = ${playerDays.userId}
        where ${counted} and ${playerDays.day} between ${previousFrom}::date and ${to}::date
        group by 1
      ),
      arrived as (
        select first_day as day, count(*)::int as n
        from (
          select min(${playerDays.day}) as first_day
          from ${playerDays}
          join ${users} on ${users.id} = ${playerDays.userId}
          where ${counted}
          group by ${playerDays.userId}
        ) f
        where first_day between ${previousFrom}::date and ${to}::date
        group by 1
      ),
      opened as (
        select ${parisDay(boosterOpens.openedAt)} as day, count(*)::int as n
        from ${boosterOpens}
        join ${users} on ${users.id} = ${boosterOpens.userId}
        where ${counted}
          and ${boosterOpens.openedAt} >= ${parisStart(previousFrom)}
          and ${boosterOpens.openedAt} < ${parisStart(addDays(to, 1))}
        group by 1
      ),
      answered as (
        select ${parisDay(reviewLogs.reviewedAt)} as day, count(*)::int as n
        from ${reviewLogs}
        join ${users} on ${users.id} = ${reviewLogs.userId}
        where ${counted}
          and ${reviewLogs.reviewedAt} >= ${parisStart(previousFrom)}
          and ${reviewLogs.reviewedAt} < ${parisStart(addDays(to, 1))}
        group by 1
      ),
      joined as (
        select ${parisDay(users.createdAt)} as day, count(*)::int as n
        from ${users}
        where ${counted}
          and not ${users.isAnonymous}
          and ${users.createdAt} >= ${parisStart(previousFrom)}
          and ${users.createdAt} < ${parisStart(addDays(to, 1))}
        group by 1
      )
      select
        days.day::text as day,
        coalesce(active.n, 0) as active,
        coalesce(arrived.n, 0) as arrived,
        coalesce(opened.n, 0) as boosters,
        coalesce(answered.n, 0) as answers,
        coalesce(joined.n, 0) as accounts
      from days
      left join active using (day)
      left join arrived using (day)
      left join opened using (day)
      left join answered using (day)
      left join joined using (day)
      order by days.day
    `),
    db.execute<{ current: number; previous: number }>(sql`
      select
        count(distinct ${playerDays.userId}) filter (where ${playerDays.day} >= ${from}::date)::int as current,
        count(distinct ${playerDays.userId}) filter (where ${playerDays.day} <= ${previousTo}::date)::int as previous
      from ${playerDays}
      join ${users} on ${users.id} = ${playerDays.userId}
      where ${counted} and ${playerDays.day} between ${previousFrom}::date and ${to}::date
    `),
    db.execute<{ day: string; offset: number; players: number }>(sql`
      with arrivals as (
        select ${playerDays.userId} as user_id, min(${playerDays.day}) as first_day
        from ${playerDays}
        join ${users} on ${users.id} = ${playerDays.userId}
        where ${counted}
        group by ${playerDays.userId}
        having min(${playerDays.day}) between ${previousFrom}::date and ${to}::date
      )
      select a.first_day::text as day, (d.day - a.first_day)::int as "offset", count(*)::int as players
      from arrivals a
      join ${playerDays} d
        on d.user_id = a.user_id and d.day between a.first_day and a.first_day + ${COHORT_DAYS - 1}::int
      group by 1, 2
    `),
    db.execute<{ weekday: number; hour: number; events: number }>(sql`
      with events as (
        select ${boosterOpens.openedAt} as happened
        from ${boosterOpens}
        join ${users} on ${users.id} = ${boosterOpens.userId}
        where ${counted}
          and ${boosterOpens.openedAt} >= ${parisStart(from)}
          and ${boosterOpens.openedAt} < ${parisStart(addDays(to, 1))}
        union all
        select ${reviewLogs.reviewedAt}
        from ${reviewLogs}
        join ${users} on ${users.id} = ${reviewLogs.userId}
        where ${counted}
          and ${reviewLogs.reviewedAt} >= ${parisStart(from)}
          and ${reviewLogs.reviewedAt} < ${parisStart(addDays(to, 1))}
      )
      select
        (extract(isodow from happened at time zone 'Europe/Paris') - 1)::int as weekday,
        extract(hour from happened at time zone 'Europe/Paris')::int as hour,
        count(*)::int as events
      from events
      group by 1, 2
    `),
    db.execute<{ today: number; d7: number; d30: number }>(sql`
      select
        count(distinct ${playerDays.userId}) filter (where ${playerDays.day} = ${today}::date)::int as today,
        count(distinct ${playerDays.userId}) filter (where ${playerDays.day} > ${today}::date - 7)::int as d7,
        count(distinct ${playerDays.userId})::int as d30
      from ${playerDays}
      join ${users} on ${users.id} = ${playerDays.userId}
      where ${playerDays.day} > ${today}::date - 30 and ${counted}
    `),
    db.execute<{ door: number; notify: number }>(sql`
      select
        count(*) filter (where ${playerInterest.kind} = 'patron_door')::int as door,
        count(*) filter (where ${playerInterest.kind} = 'patron_notify')::int as notify
      from ${playerInterest}
      join ${users} on ${users.id} = ${playerInterest.userId}
      where ${counted}
        and ${playerInterest.createdAt} >= ${parisStart(from)}
        and ${playerInterest.createdAt} < ${parisStart(addDays(to, 1))}
    `),
    db.execute<{ first_day: string | null }>(sql`
      select min(${playerDays.day})::text as first_day
      from ${playerDays}
      join ${users} on ${users.id} = ${playerDays.userId}
      where ${counted}
    `),
  ]);

  const rows = traces.rows;
  const players: Trace[] = rows.map((row) => ({
    firstDay: row.first_day,
    d1: row.d1,
    d7: row.d7,
    d30: row.d30,
    origin: row.origin ?? NO_ORIGIN,
    age: row.age ?? NO_AGE,
  }));
  const count = (test: (row: TraceRow) => boolean) => rows.filter(test).length;
  const [actives] = active.rows;
  const [interested] = interest.rows;
  const [uniqueActive] = unique.rows;

  return {
    period: { ...period, today, firstDay: first.rows[0]?.first_day ?? null },
    daily: daily.rows,
    uniqueActive: { current: uniqueActive?.current ?? 0, previous: uniqueActive?.previous ?? 0 },
    cohorts: cohortsFrom(cohorts.rows, COHORT_DAYS),
    hours: hours.rows,
    funnel: {
      arrived: rows.length,
      openedBooster: count((row) => row.opened),
      answeredChallenge: count((row) => row.answered),
      tradedOnce: count((row) => row.traded),
      createdAccount: count((row) => row.member),
      cameBack: count((row) => row.came_back),
    },
    activeToday: actives?.today ?? 0,
    active7d: actives?.d7 ?? 0,
    active30d: actives?.d30 ?? 0,
    byWeek: retentionBy(players, (player) => weekOf(player.firstDay), today).sort((a, b) =>
      b.key.localeCompare(a.key),
    ),
    byOrigin: retentionBy(players, (player) => player.origin, today).sort(
      (a, b) => b.players - a.players,
    ),
    byAge: retentionBy(players, (player) => player.age, today).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
    interest: { patronDoor: interested?.door ?? 0, patronNotify: interested?.notify ?? 0 },
  };
}

const TESTERS_PAGE = 50;

type TesterRow = {
  id: string;
  email: string;
  is_anonymous: boolean;
  pseudo: string | null;
  origin: string | null;
  age: string | null;
  first_day: string;
  last_day: string;
  days: number;
  boosters: number;
  answers: number;
  xp: number | null;
};

/** Players by the last day they played, newest first, with what the measures know of them. */
export async function listTesters(
  db: Database,
  cursorValue: string | undefined,
): Promise<AdminTestersResponse> {
  const cursor = cursorValue === undefined ? null : decodeTimeCursor(cursorValue);
  if (cursor === undefined) throw new InvalidCursorError();
  const after =
    cursor === null ? sql`true` : sql`(t.last_day, t.id) < (${cursor.at}::date, ${cursor.id})`;
  const result = await db.execute<TesterRow>(sql`
    with t as (
      select
        ${playerDays.userId} as id,
        min(${playerDays.day}) as first_day,
        max(${playerDays.day}) as last_day,
        count(*)::int as days
      from ${playerDays}
      join ${users} on ${users.id} = ${playerDays.userId}
      where ${counted}
      group by ${playerDays.userId}
    )
    select
      t.id, u.email, u.is_anonymous, p.pseudo,
      ${originSql} as origin,
      b.bracket as age,
      t.first_day::text as first_day, t.last_day::text as last_day, t.days,
      (select count(*)::int from ${boosterOpens} o where o.user_id = t.id) as boosters,
      (select count(*)::int from ${reviewLogs} r where r.user_id = t.id) as answers,
      g.xp
    from t
    join ${users} u on u.id = t.id
    left join ${players} p on p.user_id = t.id
    left join ${playerSignups} s on s.user_id = t.id
    left join ${invites} i on i.id = s.invite_id
    left join ${playerAgeBrackets} b on b.user_id = t.id
    left join ${userProgress} g on g.user_id = t.id
    where ${after}
    order by t.last_day desc, t.id desc
    limit ${TESTERS_PAGE + 1}
  `);
  const rows = result.rows;
  return {
    testers: rows.slice(0, TESTERS_PAGE).map(toTester),
    nextCursor: nextCursor(rows, TESTERS_PAGE, (row) => ({ at: row.last_day, id: row.id })),
  };
}

function toTester(row: TesterRow): AdminTester {
  const age = ageBracketSchema.safeParse(row.age);
  return {
    id: row.id,
    email: row.is_anonymous ? null : row.email,
    pseudo: row.pseudo,
    origin: row.origin,
    ageBracket: age.success ? age.data : null,
    firstDay: row.first_day,
    lastDay: row.last_day,
    daysPlayed: row.days,
    boosters: row.boosters,
    answers: row.answers,
    level: levelOf(row.xp ?? 0).level,
  };
}

const FEEDBACK_PAGE = 50;

/** Testers' notes, newest first, and how many are still unread. */
export async function listFeedback(
  db: Database,
  cursorValue: string | undefined,
): Promise<AdminFeedbackResponse> {
  const cursor = cursorValue === undefined ? null : decodeTimeCursor(cursorValue);
  if (cursor === undefined || (cursor !== null && !z.uuid().safeParse(cursor.id).success)) {
    throw new InvalidCursorError();
  }
  const after =
    cursor === null
      ? sql`true`
      : sql`(${playerFeedback.createdAt}, ${playerFeedback.id}) < (${new Date(cursor.at)}, ${cursor.id}::uuid)`;
  const [rows, unread] = await Promise.all([
    db
      .select({
        id: playerFeedback.id,
        userId: playerFeedback.userId,
        email: users.email,
        isAnonymous: users.isAnonymous,
        screen: playerFeedback.screen,
        body: playerFeedback.body,
        createdAt: playerFeedback.createdAt,
        readAt: playerFeedback.readAt,
      })
      .from(playerFeedback)
      .innerJoin(users, eq(users.id, playerFeedback.userId))
      .where(after)
      .orderBy(sql`${playerFeedback.createdAt} desc, ${playerFeedback.id} desc`)
      .limit(FEEDBACK_PAGE + 1),
    db.$count(playerFeedback, isNull(playerFeedback.readAt)),
  ]);
  return {
    feedback: rows.slice(0, FEEDBACK_PAGE).map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.isAnonymous ? null : row.email,
      screen: row.screen,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    })),
    unread,
    nextCursor: nextCursor(rows, FEEDBACK_PAGE, (row) => ({
      at: row.createdAt.toISOString(),
      id: row.id,
    })),
  };
}

/** Marks a note read. Idempotent: the first reading date is kept. */
export async function markFeedbackRead(db: Database, id: string, now: EpochMs): Promise<boolean> {
  const updated = await db
    .update(playerFeedback)
    .set({ readAt: sql`coalesce(${playerFeedback.readAt}, ${new Date(now)})` })
    .where(eq(playerFeedback.id, id))
    .returning({ id: playerFeedback.id });
  return updated.length > 0;
}
