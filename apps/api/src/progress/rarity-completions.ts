import type { Rarity, XpRules } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { type SQL, sql } from "drizzle-orm";

const { cards, userCards, userRarityCompletions } = schema;

type Writer = Pick<Database, "$with">;

/** A word a player is getting for the first time, by booster or by trade. */
export interface NewWord {
  readonly userId: string;
  readonly cardId: string;
}

export interface RarityCompletion {
  readonly userId: string;
  readonly collectionId: string;
  readonly rarity: Rarity;
  readonly xp: number;
}

/**
 * Data-modifying CTE recording the rarities these new words complete: every drawable card of the
 * word's rarity in its collection is owned once, or arrives in this same statement. Returns the
 * completions it wrote; one already recorded is skipped, so its XP is never earned twice.
 *
 * Copies written by the same statement are not visible to it, hence the new words passed in.
 * A trade and a booster committed at the same instant could each miss the other's last word:
 * left alone, it needs both to bring the very last cards of one rarity at once.
 */
export function rarityCompletions(
  tx: Writer,
  rules: XpRules,
  newWords: readonly NewWord[],
  now: Date,
) {
  const arriving = sql.join(
    newWords.map((word) => sql`(${word.userId}::text, ${word.cardId}::text)`),
    sql`, `,
  );
  return tx
    .$with("rarity_completions", {
      userId: sql<string>`user_id`.as("user_id"),
      collectionId: sql<string>`collection_id`.as("collection_id"),
      rarity: sql<Rarity>`rarity`.as("rarity"),
      xp: sql<number>`xp`.as("xp"),
    })
    .as(sql`
      insert into ${userRarityCompletions} (user_id, collection_id, rarity, xp, completed_at)
      select n.user_id, k.collection_id, k.rarity,
        (${JSON.stringify(rules.rarityCompleted)}::jsonb ->> k.rarity::text)::int, ${now}
      from (select distinct w.user_id, nk.collection_id, nk.rarity
        from (values ${arriving}) as w (user_id, card_id)
        join ${cards} nk on nk.id = w.card_id) as n
      join ${cards} k on k.collection_id = n.collection_id and k.rarity = n.rarity
        and k.retired_at is null
      group by n.user_id, k.collection_id, k.rarity
      having bool_and(
        exists (select 1 from ${userCards} uc where uc.user_id = n.user_id and uc.card_id = k.id)
        or (n.user_id, k.id) in (values ${arriving}))
      on conflict do nothing
      returning user_id, collection_id, rarity, xp`);
}

/** XP a player earns from the completions of the statement, to add to their gain. */
export function completionXpOf(userId: string): SQL<number> {
  return sql<number>`coalesce((select sum(xp)::int from rarity_completions
    where user_id = ${userId}), 0)`;
}

/** The completions of the statement, as JSON, for the statement's result. */
export const completionsJson = sql<RarityCompletion[]>`(select coalesce(json_agg(json_build_object(
  'userId', user_id, 'collectionId', collection_id, 'rarity', rarity, 'xp', xp)), '[]')
  from rarity_completions)`;
