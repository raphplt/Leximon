import type { FeedEvent, FeedResponse, FriendReactionKind } from "@leximon/contract";
import { type EpochMs, FRIEND_SCHEDULE, feedLevels, friendRulesAt, levelOf } from "@leximon/core";
import { type Database, type FriendEventPayload, schema } from "@leximon/db";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { purgeRows } from "../purge";
import { friendIdsOf } from "./friends";

const { friendFeedEvents, friendReactions, friendships, userProgress } = schema;

const FEED_PAGE = 15;
/** Finds and answers this recent enter the feed: the queue's delay at most. */
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Players who share what they find: everyone without a row of preferences. */
function sharesFinds(userId: unknown) {
  return sql`coalesce((select p.share_finds from user_preferences p where p.user_id = ${userId}), true)`;
}

// --- Writing, by the queue's consumer -------------------------------------------------------------

/**
 * Epic and Legendary cards found, and collections completed, by players who got cards. Each find
 * is written once (`dedupeKey`), dated when the card was first obtained.
 */
export async function writeFindEvents(db: Database, userIds: readonly string[], now: EpochMs) {
  for (const userId of new Set(userIds)) {
    await db.execute(sql`
      insert into friend_feed_events (user_id, kind, payload, dedupe_key, created_at)
      select ${userId}, 'rare_find', jsonb_build_object('cardId', uc.card_id),
        'find:' || uc.card_id, uc.first_obtained_at
      from (select distinct on (card_id) card_id, first_obtained_at from user_cards
        where user_id = ${userId} and first_obtained_at >= ${new Date(now - FEED_WINDOW_MS)}
        order by card_id, first_obtained_at) uc
      join cards k on k.id = uc.card_id and k.rarity in ('epic', 'legendary')
      where ${sharesFinds(userId)}
      order by uc.first_obtained_at
      on conflict (user_id, dedupe_key) do nothing`);
    // A collection is complete when every card of it ever published is owned.
    await db.execute(sql`
      insert into friend_feed_events (user_id, kind, payload, dedupe_key, created_at)
      select ${userId}, 'collection_complete', jsonb_build_object('collectionId', k.collection_id),
        'collection:' || k.collection_id, ${new Date(now)}
      from cards k
      left join user_cards uc on uc.user_id = ${userId} and uc.card_id = k.id and uc.quantity > 0
      where ${sharesFinds(userId)}
      group by k.collection_id
      having count(*) = count(uc.card_id)
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

/** Words that reached the Dorure for the first time, from the answers of these players. */
export async function writeGildedEvents(db: Database, userIds: readonly string[], now: EpochMs) {
  for (const userId of new Set(userIds)) {
    await db.execute(sql`
      insert into friend_feed_events (user_id, kind, payload, dedupe_key, created_at)
      select ${userId}, 'gilded', jsonb_build_object('cardId', r.card_id),
        'gilded:' || r.card_id, min(r.reviewed_at)
      from review_logs r
      where r.user_id = ${userId} and r.correct and r.level_after = 'gilded'
        and r.reviewed_at >= ${new Date(now - FEED_WINDOW_MS)}
        and ${sharesFinds(userId)}
        and not exists (select 1 from review_logs p
          where p.user_id = r.user_id and p.card_id = r.card_id
            and p.reviewed_at < r.reviewed_at and p.level_after = 'gilded')
      group by r.card_id
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

/** The account level, when a player just reached a multiple of the feed's step. */
export async function writeLevelEvents(db: Database, userIds: readonly string[], now: EpochMs) {
  if (userIds.length === 0) return;
  const rules = friendRulesAt(FRIEND_SCHEDULE, now);
  const rows = await db
    .select({ userId: userProgress.userId, xp: userProgress.xp })
    .from(userProgress)
    .where(inArray(userProgress.userId, [...new Set(userIds)]));
  for (const row of rows) {
    const { level } = levelOf(row.xp);
    // Only the level just reached: a level passed long ago never comes back as news.
    for (const reached of feedLevels(rules, level - 1, level)) {
      await db.execute(sql`
        insert into friend_feed_events (user_id, kind, payload, dedupe_key, created_at)
        select ${row.userId}, 'level', jsonb_build_object('level', ${reached}::int),
          ${`level:${reached}`}, ${new Date(now)}
        where ${sharesFinds(row.userId)}
        on conflict (user_id, dedupe_key) do nothing`);
    }
  }
}

// --- Reading ------------------------------------------------------------------------------------

/** `GET /me/friends/feed`: friends' events and the player's own, newest first. */
export async function readFeed(
  db: Database,
  input: { readonly userId: string; readonly before: number | undefined; readonly now: EpochMs },
): Promise<FeedResponse> {
  const { userId, now } = input;
  const rules = friendRulesAt(FRIEND_SCHEDULE, now);
  const authors = [userId, ...(await friendIdsOf(db, userId, now))];
  const rows = await db
    .select({
      id: friendFeedEvents.id,
      userId: friendFeedEvents.userId,
      kind: friendFeedEvents.kind,
      payload: friendFeedEvents.payload,
      createdAt: friendFeedEvents.createdAt,
    })
    .from(friendFeedEvents)
    .where(
      and(
        inArray(friendFeedEvents.userId, authors),
        sql`${friendFeedEvents.createdAt} > ${new Date(now - rules.feedTtlMs)}`,
        sharesFinds(friendFeedEvents.userId),
        input.before === undefined ? undefined : lt(friendFeedEvents.id, input.before),
      ),
    )
    .orderBy(desc(friendFeedEvents.id))
    .limit(FEED_PAGE + 1);
  const page = rows.slice(0, FEED_PAGE);
  const ids = page.map((row) => row.id);
  const [badges, reactions] = await Promise.all([
    readBadges(
      db,
      page.map((row) => row.userId),
      now,
    ),
    ids.length === 0
      ? Promise.resolve([])
      : db
          .select({
            eventId: friendReactions.eventId,
            userId: friendReactions.userId,
            reaction: friendReactions.reaction,
          })
          .from(friendReactions)
          .where(inArray(friendReactions.eventId, ids)),
  ]);
  const events = page.flatMap((row): FeedEvent[] => {
    const player = badges.get(row.userId);
    if (player === undefined) return [];
    const given = reactions.filter((reaction) => reaction.eventId === row.id);
    const counts = new Map<FriendReactionKind, number>();
    for (const reaction of given) {
      counts.set(reaction.reaction, (counts.get(reaction.reaction) ?? 0) + 1);
    }
    const base = {
      id: row.id,
      player,
      createdAt: row.createdAt.toISOString(),
      reactions: [...counts].map(([reaction, count]) => ({ reaction, count })),
      mine: given.find((reaction) => reaction.userId === userId)?.reaction ?? null,
    };
    return toEvent(row.kind, row.payload, base);
  });
  return { events, hasMore: rows.length > FEED_PAGE };
}

function toEvent(
  kind: (typeof schema.FRIEND_EVENT_KINDS)[number],
  payload: FriendEventPayload,
  base: Omit<FeedEvent, "kind" | "cardId" | "level" | "collectionId">,
): FeedEvent[] {
  switch (kind) {
    case "rare_find":
    case "gilded":
      return "cardId" in payload ? [{ kind, ...base, cardId: payload.cardId }] : [];
    case "level":
      return "level" in payload ? [{ kind, ...base, level: payload.level }] : [];
    case "collection_complete":
      return "collectionId" in payload
        ? [{ kind, ...base, collectionId: payload.collectionId }]
        : [];
    default:
      return kind satisfies never;
  }
}

// --- Reactions ----------------------------------------------------------------------------------

export type ReactResult =
  | { readonly kind: "ok"; readonly first: boolean }
  | { readonly kind: "event_not_found" };

/**
 * `PUT /me/friend-reactions/:eventId`: one reaction per player and event, changed by a new one.
 * Only a friend of the author reacts, never the author. `first` says whether the player had not
 * reacted yet, which brings a letter to the author.
 */
export async function react(
  db: Database,
  input: {
    readonly userId: string;
    readonly eventId: number;
    readonly reaction: FriendReactionKind;
    readonly now: EpochMs;
  },
): Promise<ReactResult> {
  const rules = friendRulesAt(FRIEND_SCHEDULE, input.now);
  const [event] = await db
    .select({ id: friendFeedEvents.id })
    .from(friendFeedEvents)
    .innerJoin(
      friendships,
      and(eq(friendships.friendId, friendFeedEvents.userId), eq(friendships.userId, input.userId)),
    )
    .where(
      and(
        eq(friendFeedEvents.id, input.eventId),
        sql`${friendFeedEvents.createdAt} > ${new Date(input.now - rules.feedTtlMs)}`,
      ),
    );
  if (event === undefined) return { kind: "event_not_found" };
  const result = await db.execute<{ inserted: boolean }>(sql`
    insert into friend_reactions (event_id, user_id, reaction, created_at)
    values (${input.eventId}, ${input.userId}, ${input.reaction}, ${new Date(input.now)})
    on conflict (event_id, user_id) do update set reaction = excluded.reaction
    returning (xmax = 0) as inserted`);
  return { kind: "ok", first: result.rows[0]?.inserted ?? false };
}

/** `DELETE /me/friend-reactions/:eventId`. Twice changes nothing. */
export async function unreact(
  db: Database,
  input: { readonly userId: string; readonly eventId: number },
): Promise<void> {
  await db
    .delete(friendReactions)
    .where(
      and(eq(friendReactions.eventId, input.eventId), eq(friendReactions.userId, input.userId)),
    );
}

/** Erases events past the feed's delay, their reactions with them; returns how many. */
export function purgeFeed(db: Database, now: EpochMs): Promise<number> {
  const rules = friendRulesAt(FRIEND_SCHEDULE, now);
  return purgeRows(
    db,
    friendFeedEvents,
    lt(friendFeedEvents.createdAt, new Date(now - rules.feedTtlMs)),
  );
}
