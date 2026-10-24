import { type EpochMs, FRIEND_SCHEDULE, friendRulesAt } from "@leximon/core";
import type { Database } from "@leximon/db";
import { sql } from "drizzle-orm";
import { writeFindEvents, writeGildedEvents, writeLevelEvents } from "./feed";
import { qualifyReferrals } from "./referrals";

export interface FriendEvents {
  /** Players who got cards: their rare finds and complete collections enter the feed. */
  readonly cards: readonly string[];
  /** Players who answered right: a word may have reached the Dorure. */
  readonly answers: readonly string[];
  /** Players who passed a level: the feed, and the reward of whoever invited them. */
  readonly levels: readonly string[];
  readonly requests: readonly { readonly senderId: string; readonly recipientId: string }[];
  readonly accepted: readonly { readonly userId: string; readonly friendId: string }[];
  readonly reactions: readonly number[];
}

/**
 * The friends' part of the game events consumer. Like the rest, it trusts only ids: each letter
 * and feed event is written from what the database says now, once (`dedupe_key`).
 */
export async function handleFriendEvents(
  db: Database,
  events: FriendEvents,
  now: EpochMs,
): Promise<void> {
  await writeFindEvents(db, events.cards, now);
  await writeGildedEvents(db, events.answers, now);
  await writeLevelEvents(db, events.levels, now);
  await qualifyReferrals(db, events.levels, now);
  await writeFriendRequestLetters(db, events.requests, now);
  await writeAcceptedLetters(db, events.accepted, now);
  await writeReactionLetters(db, events.reactions, now);
}

/** A letter to the recipient of each request still waiting; a new request is a new letter. */
async function writeFriendRequestLetters(
  db: Database,
  requests: FriendEvents["requests"],
  now: EpochMs,
): Promise<void> {
  const rules = friendRulesAt(FRIEND_SCHEDULE, now);
  for (const { senderId, recipientId } of requests) {
    await db.execute(sql`
      insert into mail_letters (user_id, kind, payload, dedupe_key, created_at)
      select r.recipient_id, 'friend_request', jsonb_build_object('playerId', r.sender_id),
        'friend-request:' || r.sender_id || ':' || extract(epoch from r.created_at)::bigint,
        r.created_at
      from friend_requests r
      where r.sender_id = ${senderId} and r.recipient_id = ${recipientId}
        and r.declined_at is null and r.created_at > ${new Date(now - rules.requestTtlMs)}
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

/** A letter to the player whose request was accepted, while they are still friends. */
async function writeAcceptedLetters(
  db: Database,
  accepted: FriendEvents["accepted"],
  now: EpochMs,
): Promise<void> {
  for (const { userId, friendId } of accepted) {
    await db.execute(sql`
      insert into mail_letters (user_id, kind, payload, dedupe_key, created_at)
      select f.user_id, 'friend_accepted', jsonb_build_object('playerId', f.friend_id),
        'friend-accepted:' || f.friend_id || ':' || extract(epoch from f.created_at)::bigint,
        ${new Date(now)}
      from friendships f
      where f.user_id = ${friendId} and f.friend_id = ${userId}
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

/**
 * One letter per feed event, to its author, at the first reaction; the letter counts the
 * reactions when it is read. It names the friend who reacted first.
 */
async function writeReactionLetters(
  db: Database,
  eventIds: readonly number[],
  now: EpochMs,
): Promise<void> {
  for (const eventId of new Set(eventIds)) {
    await db.execute(sql`
      insert into mail_letters (user_id, kind, payload, dedupe_key, created_at)
      select e.user_id, 'friend_reaction',
        jsonb_build_object('eventId', e.id, 'playerId', first.user_id), 'reaction:' || e.id,
        ${new Date(now)}
      from friend_feed_events e
      join lateral (select x.user_id from friend_reactions x where x.event_id = e.id
        order by x.created_at, x.user_id limit 1) first on true
      where e.id = ${eventId}
      on conflict (user_id, dedupe_key) do nothing`);
  }
}
