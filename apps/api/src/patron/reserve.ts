import type { FindRefusal, ReserveResponse, WordFindView } from "@leximon/contract";
import {
  type EpochMs,
  earnedFinds,
  findsLeft,
  PATRON_SCHEDULE,
  type PaidPeriod,
  type PatronRules,
  type PatronStanding,
  patronRulesAt,
  reserveSearchKey,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, desc, eq, isNull, like, notExists, or, type SQL, sql } from "drizzle-orm";
import { readPeriods, standingOfRow } from "./patron";

const { patronSubscriptions, players, reserveWords, wordFinds } = schema;

type Reader = Pick<Database, "select">;

/**
 * The reserve patrons find their words in, and the finding. A word is found once: its row in
 * `word_finds` is its primary key, so two patrons at the same instant cannot both have it.
 */

export const RESERVE_PAGE = 30;

export interface FindRow {
  readonly id: string;
  readonly word: string;
  readonly state: WordFindView["state"];
  readonly foundAt: Date;
}

export async function readFinds(db: Reader, userId: string): Promise<FindRow[]> {
  const rows = await db
    .select({
      id: wordFinds.wordId,
      word: reserveWords.word,
      state: wordFinds.state,
      foundAt: wordFinds.foundAt,
    })
    .from(wordFinds)
    .innerJoin(reserveWords, eq(reserveWords.id, wordFinds.wordId))
    .where(eq(wordFinds.userId, userId))
    .orderBy(desc(wordFinds.foundAt));
  return rows.map((row) => ({ ...row, state: row.state as FindRow["state"] }));
}

/** Rights are lost when the subscription stops; a trial earns none, having no paid period. */
export function findsLeftOf(
  rules: Pick<PatronRules, "monthsPerFind">,
  periods: readonly PaidPeriod[],
  finds: readonly Pick<FindRow, "state">[],
  standing: PatronStanding,
  now: EpochMs,
): number {
  return findsLeft({
    earned: earnedFinds(rules, periods, now),
    used: finds.filter((find) => find.state !== "rejected").length,
    returned: finds.filter((find) => find.state === "rejected").length,
    subscribed: standing !== "none",
  });
}

/** Thrown for a cursor this API did not write. */
export class InvalidReserveCursorError extends Error {}

const encodeCursor = (key: string, id: string) =>
  btoa(encodeURIComponent(JSON.stringify([key, id])));

function decodeCursor(cursor: string): readonly [string, string] {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(atob(cursor)));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return [parsed[0], parsed[1]];
    }
  } catch {}
  throw new InvalidReserveCursorError();
}

/** `%` and `_` typed by the player are letters, not patterns. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (match) => `\\${match}`);

/**
 * The words still to find, by beginning of word or by theme, in alphabetical order. Sorted on
 * the bytes of the key, as its index is, so that a page reads the index in order.
 */
export async function searchReserve(
  db: Reader,
  query: {
    readonly q?: string | undefined;
    readonly theme?: string | undefined;
    readonly cursor?: string | undefined;
  },
): Promise<ReserveResponse> {
  const filters: SQL[] = [
    isNull(reserveWords.removedAt),
    notExists(
      db.select({ one: sql`1` }).from(wordFinds).where(eq(wordFinds.wordId, reserveWords.id)),
    ),
  ];
  const key = reserveSearchKey(query.q ?? "");
  if (key !== "") filters.push(like(reserveWords.searchKey, `${escapeLike(key)}%`));
  if (query.theme !== undefined) filters.push(eq(reserveWords.theme, query.theme));
  if (query.cursor !== undefined) {
    const [afterKey, afterId] = decodeCursor(query.cursor);
    const after = or(
      sql`${reserveWords.searchKey} collate "C" > ${afterKey}`,
      and(eq(reserveWords.searchKey, afterKey), sql`${reserveWords.id} collate "C" > ${afterId}`),
    );
    if (after !== undefined) filters.push(after);
  }
  const rows = await db
    .select({
      id: reserveWords.id,
      word: reserveWords.word,
      definition: reserveWords.definition,
      theme: reserveWords.theme,
      partOfSpeech: reserveWords.partOfSpeech,
      searchKey: reserveWords.searchKey,
    })
    .from(reserveWords)
    .where(and(...filters))
    .orderBy(sql`${reserveWords.searchKey} collate "C"`, sql`${reserveWords.id} collate "C"`)
    .limit(RESERVE_PAGE + 1);
  const page = rows.slice(0, RESERVE_PAGE);
  const last = page.at(-1);
  return {
    words: page.map(({ searchKey: _, ...word }) => word),
    nextCursor:
      rows.length > RESERVE_PAGE && last !== undefined
        ? encodeCursor(last.searchKey, last.id)
        : null,
  };
}

export type FindResult =
  | { readonly kind: "found"; readonly find: WordFindView }
  | { readonly kind: "refused"; readonly reason: FindRefusal };

const viewOf = (row: FindRow): WordFindView => ({
  id: row.id,
  word: row.word,
  state: row.state,
  foundAt: row.foundAt.toISOString(),
});

/**
 * Finds a word of the reserve for a patron with a right left. Under the lock of the patron's row,
 * like the webhook that writes the periods: two finds of one patron never spend the same right.
 * Finding again a word one already found answers the same.
 */
export async function findWord(
  db: Database,
  input: { readonly userId: string; readonly wordId: string; readonly now: EpochMs },
): Promise<FindResult> {
  return db.transaction(async (tx): Promise<FindResult> => {
    const [row] = await tx
      .select()
      .from(patronSubscriptions)
      .where(eq(patronSubscriptions.userId, input.userId))
      .for("update");
    const [finds, existing, word, player] = await Promise.all([
      readFinds(tx, input.userId),
      tx
        .select({ userId: wordFinds.userId })
        .from(wordFinds)
        .where(eq(wordFinds.wordId, input.wordId)),
      tx
        .select({ id: reserveWords.id, word: reserveWords.word })
        .from(reserveWords)
        .where(and(eq(reserveWords.id, input.wordId), isNull(reserveWords.removedAt))),
      tx.select({ pseudo: players.pseudo }).from(players).where(eq(players.userId, input.userId)),
    ]);
    const mine = finds.find((find) => find.id === input.wordId);
    if (mine !== undefined) return { kind: "found", find: viewOf(mine) };
    if (existing.length > 0) return { kind: "refused", reason: "taken" };
    const reserved = word[0];
    if (reserved === undefined) return { kind: "refused", reason: "not_in_reserve" };
    if (row === undefined) return { kind: "refused", reason: "no_right" };
    const rules = patronRulesAt(PATRON_SCHEDULE, input.now);
    const periods = await readPeriods(tx, input.userId);
    if (findsLeftOf(rules, periods, finds, standingOfRow(row), input.now) === 0) {
      return { kind: "refused", reason: "no_right" };
    }
    // The card is signed with it: a patron chooses one before finding.
    if ((player[0]?.pseudo ?? null) === null) return { kind: "refused", reason: "no_pseudo" };
    const foundAt = new Date(input.now);
    const inserted = await tx
      .insert(wordFinds)
      .values({ wordId: reserved.id, userId: input.userId, state: "reserved", foundAt })
      .onConflictDoNothing()
      .returning({ wordId: wordFinds.wordId });
    if (inserted.length === 0) return { kind: "refused", reason: "taken" };
    return {
      kind: "found",
      find: viewOf({ id: reserved.id, word: reserved.word, state: "reserved", foundAt }),
    };
  });
}
