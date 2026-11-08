import type { FinderIndex, ReserveFile } from "@leximon/contract";
import { reserveSearchKey } from "@leximon/core";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../client";
import { players, reserveWords, userCards, wordFinds } from "../schema/index";

/**
 * The words patrons find: the reserve they pick from, loaded from the content pipeline, and what
 * a catalogue publication does for the words found.
 */

/** The copy given to the patron who found the word: never traded, recycled or counted for XP. */
export const FINDER_VARIANT = "finder";

const BATCH = 500;

function* batches<T>(rows: readonly T[]): Generator<T[]> {
  for (let start = 0; start < rows.length; start += BATCH) yield rows.slice(start, start + BATCH);
}

/**
 * Loads a reserve: its words are added or refreshed, and those it no longer lists leave the
 * reserve (a word found stays found). Returns how many words it holds and how many left.
 */
export async function publishReserve(
  db: Database,
  file: ReserveFile,
  now: Date,
): Promise<{ readonly words: number; readonly removed: number }> {
  return db.transaction(async (tx) => {
    for (const batch of batches(file.words)) {
      await tx
        .insert(reserveWords)
        .values(
          batch.map((word) => ({
            ...word,
            searchKey: reserveSearchKey(word.word),
            release: file.version,
            removedAt: null,
          })),
        )
        .onConflictDoUpdate({
          target: reserveWords.id,
          set: {
            word: sql`excluded.word`,
            definition: sql`excluded.definition`,
            theme: sql`excluded.theme`,
            partOfSpeech: sql`excluded.part_of_speech`,
            searchKey: sql`excluded.search_key`,
            release: sql`excluded.release`,
            removedAt: null,
          },
        });
    }
    const removed = await tx
      .update(reserveWords)
      .set({ removedAt: now })
      .where(and(ne(reserveWords.release, file.version), isNull(reserveWords.removedAt)))
      .returning({ id: reserveWords.id });
    return { words: file.words.length, removed: removed.length };
  });
}

/**
 * The words found and published with this catalogue: each finder gets their copy, once. Run
 * after the catalogue is applied, since the copy points at the card.
 */
export async function publishFinds(
  db: Database,
  cardIds: readonly string[],
  now: Date,
): Promise<number> {
  if (cardIds.length === 0) return 0;
  return db.transaction(async (tx) => {
    let published = 0;
    for (const batch of batches(cardIds)) {
      const found = await tx
        .update(wordFinds)
        .set({ state: "published", settledAt: now })
        .where(and(inArray(wordFinds.wordId, batch), eq(wordFinds.state, "reserved")))
        .returning({ wordId: wordFinds.wordId, userId: wordFinds.userId });
      if (found.length === 0) continue;
      await tx
        .insert(userCards)
        .values(
          found.map((find) => ({
            userId: find.userId,
            cardId: find.wordId,
            variant: FINDER_VARIANT,
            quantity: 1,
            firstObtainedAt: now,
            lastObtainedAt: now,
          })),
        )
        .onConflictDoNothing();
      published += found.length;
    }
    return published;
  });
}

/** The pseudo signing each published card, as of now: a renamed patron is renamed on it. */
export async function readFinders(db: Database): Promise<FinderIndex> {
  const rows = await db
    .select({ cardId: wordFinds.wordId, pseudo: players.pseudo })
    .from(wordFinds)
    .innerJoin(players, eq(players.userId, wordFinds.userId))
    .where(eq(wordFinds.state, "published"));
  const cards: Record<string, string> = {};
  for (const row of rows) if (row.pseudo !== null) cards[row.cardId] = row.pseudo;
  return { cards };
}

/** The words found and waiting for their collection, for the content pipeline. */
export async function reservedFinds(
  db: Database,
): Promise<{ readonly id: string; readonly word: string }[]> {
  return db
    .select({ id: wordFinds.wordId, word: reserveWords.word })
    .from(wordFinds)
    .innerJoin(reserveWords, eq(reserveWords.id, wordFinds.wordId))
    .where(eq(wordFinds.state, "reserved"))
    .orderBy(wordFinds.foundAt);
}

/** A word found that the quality check sets aside: the patron gets their right back. */
export async function rejectFind(db: Database, wordId: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(wordFinds)
    .set({ state: "rejected", settledAt: now })
    .where(and(eq(wordFinds.wordId, wordId), eq(wordFinds.state, "reserved")))
    .returning({ wordId: wordFinds.wordId });
  return rows.length > 0;
}
