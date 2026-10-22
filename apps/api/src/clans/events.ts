import { type GameEvent, gameEventSchema } from "@leximon/contract";
import { type EpochMs, gameWeekOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { sql } from "drizzle-orm";
import type { Context } from "hono";
import type { AppEnv } from "../context";
import { clansOf } from "./clans";
import { recountClanWeek } from "./goal";

const { clans } = schema;

/** A new Legendary enters the clan's journal if it came this recently (the queue's delay at most). */
const LEGENDARY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sends game events after the request's transaction (D-038). They are hints: a failed send never
 * fails the request, it is logged, and the next event or the daily maintenance catches up.
 */
export function sendGameEvents(c: Context<AppEnv>, events: readonly GameEvent[]): void {
  if (events.length === 0) return;
  const sending = c.env.GAME_EVENTS.sendBatch(events.map((body) => ({ body }))).catch(
    (error: unknown) => {
      console.error("Game events not sent", {
        count: events.length,
        message: error instanceof Error ? error.message : String(error),
      });
    },
  );
  try {
    c.executionCtx.waitUntil(sending);
  } catch {
    // No execution context outside the Workers runtime (tests): the send just runs on.
  }
}

export interface GameEventsReport {
  readonly clans: number;
  readonly invalid: number;
}

/**
 * The queue's consumer (D-038). Trusts nothing in the messages but who and which clan: the goal,
 * the library and the journal are recounted from the database, once per clan for the whole
 * batch. Replaying a batch changes nothing.
 */
export async function handleGameEvents(
  db: Database,
  bodies: readonly unknown[],
  sentAt: readonly EpochMs[],
  now: EpochMs,
): Promise<GameEventsReport> {
  const userIds = new Set<string>();
  const clanIds = new Set<string>();
  const weeks = new Set<string>([gameWeekOf(now).key]);
  let invalid = 0;
  bodies.forEach((body, index) => {
    const event = gameEventSchema.safeParse(body);
    if (!event.success) {
      invalid++;
      return;
    }
    if (event.data.type === "cards_obtained") userIds.add(event.data.userId);
    else clanIds.add(event.data.clanId);
    // Cards obtained on Sunday night and counted on Monday still count for their week.
    weeks.add(gameWeekOf(sentAt[index] ?? now).key);
  });

  const memberships = await clansOf(db, [...userIds]);
  for (const membership of memberships.values()) clanIds.add(membership.clanId);
  for (const [userId, membership] of memberships) {
    await announceLegendaries(db, { userId, ...membership, now });
  }
  for (const clanId of clanIds) {
    for (const week of weeks) await recountClanWeek(db, clanId, week, now);
    await recountLibrary(db, clanId, now);
  }
  return { clans: clanIds.size, invalid };
}

/**
 * Writes the player's new Legendaries into the clan's journal (P67): cards first obtained since
 * they joined, within the last day. The event key makes each one enter once.
 */
async function announceLegendaries(
  db: Database,
  input: {
    readonly userId: string;
    readonly clanId: string;
    readonly joinedAt: Date;
    readonly now: EpochMs;
  },
): Promise<void> {
  const { userId, clanId, joinedAt, now } = input;
  const since = new Date(Math.max(joinedAt.getTime(), now - LEGENDARY_WINDOW_MS));
  await db.execute(sql`
    insert into clan_messages (clan_id, kind, event, event_key, created_at)
    select ${clanId}, 'event',
      jsonb_build_object('type', 'legendary', 'userId', ${userId}::text, 'cardId', uc.card_id),
      'legendary:' || ${userId}::text || ':' || uc.card_id, uc.first_obtained_at
    from (select distinct on (card_id) card_id, first_obtained_at from user_cards
      where user_id = ${userId} and first_obtained_at >= ${since}
      order by card_id, first_obtained_at) uc
    join cards k on k.id = uc.card_id and k.rarity = 'legendary'
    order by uc.first_obtained_at
    on conflict (clan_id, event_key) where event_key is not null do nothing`);
}

/** The clan's library (K-04): cards of each collection held by at least one member, in one statement. */
export async function recountLibrary(db: Database, clanId: string, now: EpochMs): Promise<void> {
  await db.execute(sql`
    with counts as (
      select k.collection_id, count(distinct uc.card_id)::int as owned
      from clan_members m
      join user_cards uc on uc.user_id = m.user_id and uc.quantity > 0
      join cards k on k.id = uc.card_id
      where m.clan_id = ${clanId}
      group by k.collection_id
    ), removed as (
      delete from clan_library l
      where l.clan_id = ${clanId}
        and l.collection_id not in (select collection_id from counts)
    ), upserted as (
      insert into clan_library (clan_id, collection_id, owned)
      select ${clanId}, collection_id, owned from counts
      on conflict (clan_id, collection_id) do update set owned = excluded.owned
    )
    update clans set library_counted_at = ${new Date(now)} where id = ${clanId}`);
}

/**
 * The daily safety net (D-038): recounts the clans that played this week or the last, in case
 * their last event was lost. Bounded per run; the oldest counts go first.
 */
export async function recountActiveClans(db: Database, now: EpochMs, limit = 500): Promise<number> {
  const current = gameWeekOf(now);
  const previous = gameWeekOf(current.start - 1);
  const rows = await db
    .select({ id: clans.id })
    .from(clans)
    .where(
      sql`exists (select 1 from clan_weeks w where w.clan_id = ${clans.id}
        and w.week in (${current.key}, ${previous.key}))`,
    )
    .orderBy(sql`${clans.libraryCountedAt} asc nulls first`)
    .limit(limit);
  for (const row of rows) {
    await recountClanWeek(db, row.id, previous.key, now);
    await recountClanWeek(db, row.id, current.key, now);
    await recountLibrary(db, row.id, now);
  }
  return rows.length;
}
