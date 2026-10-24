import type { FriendCardsResponse } from "@leximon/contract";
import {
  type EpochMs,
  isAtLeast,
  possibleTrades,
  RARITIES,
  TRADE_SCHEDULE,
  tradeRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { TRADED_VARIANT } from "../trades/players";

const { friendships, players, userCards } = schema;

/**
 * A copy of this card leaves the collection now: a duplicate, and for rare cards one held long
 * enough. The same rule as the offers, in SQL, for the alias `uc` of `user_cards` joined to `c`
 * of `cards`.
 */
function tradeableSql(now: EpochMs) {
  const rules = tradeRulesAt(TRADE_SCHEDULE, now);
  const held = RARITIES.filter((rarity) => isAtLeast(rarity, rules.heldRarity));
  return sql`uc.quantity >= 2 and (c.rarity::text not in (${sql.join(
    held.map((rarity) => sql`${rarity}`),
    sql`, `,
  )}) or uc.last_obtained_at <= ${new Date(now - rules.heldForMs)})`;
}

/**
 * Trades possible with each friend: as many as the poorer side has tradeable cards the other one
 * does not own at all. One query for the whole list; duplicates are few, so each side is small.
 */
export async function possibleTradeCounts(
  db: Database,
  userId: string,
  friendIds: readonly string[],
  now: EpochMs,
): Promise<Map<string, number>> {
  if (friendIds.length === 0) return new Map();
  const tradeable = tradeableSql(now);
  const ids = sql.join(
    friendIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute<{ friend_id: string; give: number; get: number }>(sql`
    with friends as (select unnest(array[${ids}]::text[]) as friend_id),
    mine as (
      select uc.card_id from user_cards uc join cards c on c.id = uc.card_id
      where uc.user_id = ${userId} and uc.variant = ${TRADED_VARIANT} and ${tradeable}
    ),
    theirs as (
      select uc.user_id, uc.card_id from user_cards uc join cards c on c.id = uc.card_id
      where uc.user_id in (select friend_id from friends) and uc.variant = ${TRADED_VARIANT}
        and ${tradeable}
    )
    select f.friend_id,
      (select count(*)::int from mine m where not exists (select 1 from user_cards o
        where o.user_id = f.friend_id and o.card_id = m.card_id and o.quantity > 0)) as give,
      (select count(*)::int from theirs t where t.user_id = f.friend_id and not exists (
        select 1 from user_cards o
        where o.user_id = ${userId} and o.card_id = t.card_id and o.quantity > 0)) as get
    from friends f`);
  return new Map(
    result.rows.map((row) => [row.friend_id, possibleTrades(row.give, row.get)] as const),
  );
}

export type FriendCardsResult =
  | { readonly kind: "found"; readonly response: FriendCardsResponse }
  | { readonly kind: "not_found" };

/**
 * `GET /me/friends/:code/cards`: the distinct cards a friend owns, to compare albums and suggest
 * trades. Only a friend sees them: they reveal the collection.
 */
export async function readFriendCards(
  db: Database,
  input: { readonly userId: string; readonly code: string; readonly now: EpochMs },
): Promise<FriendCardsResult> {
  const [friend] = await db
    .select({ userId: friendships.friendId })
    .from(friendships)
    .innerJoin(players, eq(players.userId, friendships.friendId))
    .where(and(eq(friendships.userId, input.userId), eq(players.code, input.code)));
  if (friend === undefined) return { kind: "not_found" };
  const [rows, badges] = await Promise.all([
    db
      .selectDistinct({ cardId: userCards.cardId })
      .from(userCards)
      .where(and(eq(userCards.userId, friend.userId), gt(userCards.quantity, 0)))
      .orderBy(asc(userCards.cardId)),
    readBadges(db, [friend.userId], input.now),
  ]);
  const player = badges.get(friend.userId);
  if (player === undefined) return { kind: "not_found" };
  return { kind: "found", response: { player, cardIds: rows.map((row) => row.cardId) } };
}
