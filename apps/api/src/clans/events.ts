import { type GameEvent, gameEventSchema } from "@leximon/contract";
import { type EpochMs, gameWeekOf } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { inArray, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { AppEnv } from "../context";
import { errorSummary } from "../error-summary";
import { handleFriendEvents } from "../friends/events";
import { writeMentionLetters, writeRequestLetters, writeTradeLetters } from "../mail/mail";
import { lastLetterId, playersWithNews } from "../notifications/notifications";
import { clansOf } from "./clans";
import { recountClanWeek } from "./goal";

const { clans } = schema;

/** A new Legendary enters the clan's journal if it came this recently (the queue's delay at most). */
const LEGENDARY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Sends game events after the request's transaction. They are hints: a failed send never
 * fails the request, it is logged, and the next event or the daily maintenance catches up.
 */
export function sendGameEvents(c: Context<AppEnv>, events: readonly GameEvent[]): void {
  if (events.length === 0) return;
  const sending = c.env.GAME_EVENTS.sendBatch(events.map((body) => ({ body }))).catch(
    (error: unknown) => {
      console.error("Game events not sent", {
        count: events.length,
        ...errorSummary(error),
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
  /** Library recounts put off: a `library_due` message is sent for each, after its delay. */
  readonly deferred: readonly LibraryDeferral[];
  /** Players who got a letter worth an e-mail: a `news_due` message is sent for each. */
  readonly news: readonly string[];
  /** E-mails due now, sent by the caller, which holds the mailer. */
  readonly newsDue: readonly string[];
  readonly remindersDue: readonly string[];
}

export interface LibraryDeferral {
  readonly clanId: string;
  readonly delaySeconds: number;
}

/**
 * The consumer's batches are small and frequent: a clan's library (every member's cards) is
 * recounted at most this often, and what comes in between waits for the next count.
 */
export const LIBRARY_RECOUNT_INTERVAL_MS = 5 * 60 * 1000;
/** Room for the clocks of the queue and of the consumer, which are not quite the same. */
const CLOCK_MARGIN_MS = 2_000;

/**
 * The queue's consumer. Trusts nothing in the messages but ids: the goal, the library and the
 * journal are recounted from the database, once per clan for the whole batch (the library at
 * most every 5 minutes), and letters are written from what the database says now. Replaying a
 * batch changes nothing.
 */
export async function handleGameEvents(
  db: Database,
  bodies: readonly unknown[],
  sentAt: readonly EpochMs[],
  now: EpochMs,
): Promise<GameEventsReport> {
  const answerIds = new Set<string>();
  const changedClans = new Set<string>();
  const tradeIds = new Set<string>();
  const messageIds = new Set<number>();
  const requests = new Map<string, { clanId: string; userId: string }>();
  const levelIds = new Set<string>();
  const friendRequests = new Map<string, { senderId: string; recipientId: string }>();
  const accepted = new Map<string, { userId: string; friendId: string }>();
  const reactions = new Set<number>();
  const newsDue = new Set<string>();
  const remindersDue = new Set<string>();
  const weeks = new Set<string>([gameWeekOf(now).key]);
  // When the newest event that moves a player's cards, or a clan's library, was sent.
  const cardsSentAt = new Map<string, EpochMs>();
  const librarySentAt = new Map<string, EpochMs>();
  let invalid = 0;
  bodies.forEach((body, index) => {
    const event = gameEventSchema.safeParse(body);
    if (!event.success) {
      invalid++;
      return;
    }
    const at = sentAt[index] ?? now;
    switch (event.data.type) {
      case "cards_obtained":
      case "answer_given":
      case "clan_changed":
        if (event.data.type === "cards_obtained") latest(cardsSentAt, event.data.userId, at);
        else if (event.data.type === "answer_given") answerIds.add(event.data.userId);
        else {
          changedClans.add(event.data.clanId);
          latest(librarySentAt, event.data.clanId, at);
        }
        // An answer given on Sunday night and counted on Monday still counts for its week.
        weeks.add(gameWeekOf(at).key);
        break;
      case "library_due":
        latest(librarySentAt, event.data.clanId, at);
        break;
      case "trade_changed":
        tradeIds.add(event.data.tradeId);
        break;
      case "clan_mentions":
        messageIds.add(event.data.messageId);
        break;
      case "clan_request": {
        const { clanId, userId } = event.data;
        requests.set(`${clanId}:${userId}`, { clanId, userId });
        break;
      }
      case "level_up":
        levelIds.add(event.data.userId);
        break;
      case "friend_request": {
        const { senderId, recipientId } = event.data;
        friendRequests.set(`${senderId}:${recipientId}`, { senderId, recipientId });
        break;
      }
      case "friend_accepted": {
        const { userId, friendId } = event.data;
        accepted.set(`${userId}:${friendId}`, { userId, friendId });
        break;
      }
      case "friend_reaction":
        reactions.add(event.data.eventId);
        break;
      case "news_due":
        newsDue.add(event.data.userId);
        break;
      case "reminders_due":
        for (const userId of event.data.userIds) remindersDue.add(userId);
        break;
    }
  });

  // Letters written from here on are this batch's: their players may get an e-mail.
  const lettersBefore = await lastLetterId(db);
  await writeTradeLetters(db, [...tradeIds], now);
  await writeMentionLetters(db, [...messageIds]);
  await writeRequestLetters(db, [...requests.values()]);
  await handleFriendEvents(
    db,
    {
      cards: [...cardsSentAt.keys()],
      answers: [...answerIds],
      levels: [...levelIds],
      requests: [...friendRequests.values()],
      accepted: [...accepted.values()],
      reactions: [...reactions],
    },
    now,
  );

  const memberships = await clansOf(db, [...cardsSentAt.keys()]);
  for (const [userId, membership] of memberships) {
    latest(librarySentAt, membership.clanId, cardsSentAt.get(userId) ?? now);
    await announceLegendaries(db, { userId, ...membership, now });
  }
  // The goal counts answers only: new cards move the library and the journal, not the goal.
  // Members came or went: everyone's share is recounted; otherwise only the players who answered.
  const goals = new Map<string, Set<string> | null>();
  for (const clanId of changedClans) goals.set(clanId, null);
  for (const [userId, { clanId }] of await clansOf(db, [...answerIds])) {
    const answered = goals.get(clanId);
    if (answered === null) continue;
    goals.set(clanId, (answered ?? new Set<string>()).add(userId));
  }
  for (const [clanId, answered] of goals) {
    const only = answered === null ? undefined : [...answered];
    for (const week of weeks) await recountClanWeek(db, clanId, week, now, only);
  }

  const deferred: LibraryDeferral[] = [];
  for (const [clanId, step] of await libraryRecounts(db, librarySentAt, now)) {
    if (step === "count") await recountLibrary(db, clanId, now);
    else if (step !== "skip") deferred.push({ clanId, delaySeconds: step.delaySeconds });
  }
  return {
    clans: new Set([...goals.keys(), ...librarySentAt.keys()]).size,
    invalid,
    deferred,
    news: await playersWithNews(db, lettersBefore),
    newsDue: [...newsDue],
    remindersDue: [...remindersDue],
  };
}

function latest<K>(times: Map<K, EpochMs>, key: K, at: EpochMs): void {
  times.set(key, Math.max(times.get(key) ?? at, at));
}

type LibraryStep = "count" | "skip" | { readonly delaySeconds: number };

/**
 * What to do with each library an event moved. Counted after the newest event was sent: it
 * already holds those cards, nothing to do. Counted too recently: put off until the interval
 * is over. Otherwise, counted now.
 */
async function libraryRecounts(
  db: Database,
  newestEvent: ReadonlyMap<string, EpochMs>,
  now: EpochMs,
): Promise<Map<string, LibraryStep>> {
  if (newestEvent.size === 0) return new Map();
  const rows = await db
    .select({ id: clans.id, countedAt: clans.libraryCountedAt })
    .from(clans)
    .where(inArray(clans.id, [...newestEvent.keys()]));
  const steps = new Map<string, LibraryStep>();
  for (const { id, countedAt } of rows) {
    const sent = newestEvent.get(id) ?? now;
    const counted = countedAt?.getTime() ?? null;
    if (counted !== null && counted >= sent + CLOCK_MARGIN_MS) {
      steps.set(id, "skip");
    } else if (counted === null || now - counted >= LIBRARY_RECOUNT_INTERVAL_MS) {
      steps.set(id, "count");
    } else {
      const wait = counted + LIBRARY_RECOUNT_INTERVAL_MS - now;
      steps.set(id, { delaySeconds: Math.max(1, Math.ceil(wait / 1000)) });
    }
  }
  return steps;
}

/**
 * Writes the player's new Legendaries into the clan's journal: cards first obtained since
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

/** The clan's library: cards of each collection held by at least one member, in one statement. */
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
 * The daily safety net: recounts the clans that played this week or the last, in case
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
