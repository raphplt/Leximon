import type { WishesResponse, WishSeekersResponse } from "@leximon/contract";
import { type EpochMs, wishedCards } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { listTradeableCards, TRADED_VARIANT } from "../trades/players";

const { wishes } = schema;

type Reader = Pick<Database, "select" | "execute">;
type Writer = Pick<Database, "insert" | "execute">;

/** Words a list keeps: the oldest go first, so it stays readable and bounded. */
export const WISHES_KEPT = 100;
/** Players shown as looking for the player's doubles. */
const SEEKERS_SHOWN = 20;

const list = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

/** The cards among `cardIds` the player owns at least once. */
export async function ownedAmong(
  db: Reader,
  userId: string,
  cardIds: readonly string[],
): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();
  const result = await db.execute<{ card_id: string }>(sql`
    select distinct card_id from user_cards
    where user_id = ${userId} and quantity > 0 and card_id in (${list(cardIds)})`);
  return new Set(result.rows.map((row) => row.card_id));
}

/**
 * Adds the words a player met in a joust and does not own to their list, the oldest dropped
 * past what it keeps. Inside the joust's transaction; an upsert per word, so two jousts ending
 * at once both count.
 */
export async function wishJoustWords(
  tx: Writer & Reader,
  userId: string,
  asked: readonly string[],
  now: EpochMs,
): Promise<void> {
  const wished = wishedCards(asked, await ownedAmong(tx, userId, asked));
  if (wished.length === 0) return;
  await tx
    .insert(wishes)
    .values(wished.map((cardId) => ({ userId, cardId, source: "joust", seenAt: new Date(now) })))
    .onConflictDoUpdate({
      target: [wishes.userId, wishes.cardId],
      set: { seenAt: new Date(now), source: sql`excluded.source` },
    });
  await tx.execute(sql`
    delete from wishes where user_id = ${userId} and card_id not in (
      select card_id from wishes where user_id = ${userId}
      order by seen_at desc, card_id limit ${WISHES_KEPT})`);
}

/** `GET /me/wishes`: the player's words still not owned, most recent first. */
export async function readWishes(db: Reader, userId: string): Promise<WishesResponse> {
  const result = await db.execute<{ card_id: string; source: string; seen_at: Date | string }>(sql`
    select w.card_id, w.source, w.seen_at from wishes w
    where w.user_id = ${userId}
      and not exists (select 1 from user_cards uc
        where uc.user_id = w.user_id and uc.card_id = w.card_id and uc.quantity > 0)
    order by w.seen_at desc, w.card_id
    limit ${WISHES_KEPT}`);
  return {
    wishes: result.rows.map((row) => ({
      cardId: row.card_id,
      source: "joust",
      seenAt: new Date(row.seen_at).toISOString(),
    })),
  };
}

/** `DELETE /me/wishes/:cardId`: idempotent, a word not on the list changes nothing. */
export async function removeWish(db: Writer, userId: string, cardId: string): Promise<void> {
  await db.execute(sql`delete from wishes where user_id = ${userId} and card_id = ${cardId}`);
}

/**
 * `GET /me/wish-seekers`: players who wish words the player can trade now, with only those
 * words, the most matches first. Blocked players either way stay out, and so do players without
 * a double to give back, since a trade is card for card.
 */
export async function readWishSeekers(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<WishSeekersResponse> {
  const { cardIds } = await listTradeableCards(db, userId, now);
  if (cardIds.length === 0) return { players: [] };
  const result = await db.execute<{ user_id: string; card_ids: string[] }>(sql`
    select w.user_id, array_agg(w.card_id order by w.card_id) as card_ids
    from wishes w
    where w.card_id in (${list(cardIds)}) and w.user_id <> ${userId}
      and not exists (select 1 from user_cards uc
        where uc.user_id = w.user_id and uc.card_id = w.card_id and uc.quantity > 0)
      and exists (select 1 from user_cards d
        where d.user_id = w.user_id and d.variant = ${TRADED_VARIANT} and d.quantity >= 2)
      and not exists (select 1 from user_blocks b
        where (b.blocker_id = ${userId} and b.blocked_id = w.user_id)
          or (b.blocker_id = w.user_id and b.blocked_id = ${userId}))
    group by w.user_id
    order by count(*) desc, max(w.seen_at) desc, w.user_id
    limit ${SEEKERS_SHOWN}`);
  const badges = await readBadges(
    db,
    result.rows.map((row) => row.user_id),
    now,
  );
  return {
    players: result.rows.flatMap((row) => {
      const player = badges.get(row.user_id);
      return player === undefined ? [] : [{ player, cardIds: row.card_ids }];
    }),
  };
}
