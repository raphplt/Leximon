import type { EditionRefusal, EditionsResponse } from "@leximon/contract";
import {
  cardEditionOf,
  type EpochMs,
  ownedEditions,
  PATRON_SCHEDULE,
  patronRulesAt,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, inArray } from "drizzle-orm";
import { ensurePlayer } from "../trades/players";
import { readPeriods } from "./patron";

const { cardEditions, players, userCards } = schema;

type Reader = Pick<Database, "select">;

/**
 * Library editions: how a patron prints their cards. An edition belongs to the player, not to a
 * copy, so a trade never moves it; owned editions are kept for life.
 */

async function ownedBy(db: Reader, userId: string, now: EpochMs): Promise<Set<string>> {
  const rules = patronRulesAt(PATRON_SCHEDULE, now);
  return new Set(ownedEditions(rules, await readPeriods(db, userId), now));
}

async function albumOf(db: Reader, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ edition: players.cardEdition })
    .from(players)
    .where(eq(players.userId, userId));
  return row?.edition ?? null;
}

/** `GET /me/editions`: choices for an edition no longer owned are left out. */
export async function readEditions(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<EditionsResponse> {
  const [owned, album, rows] = await Promise.all([
    ownedBy(db, userId, now),
    albumOf(db, userId),
    db
      .select({ cardId: cardEditions.cardId, edition: cardEditions.edition })
      .from(cardEditions)
      .where(eq(cardEditions.userId, userId)),
  ]);
  const cards: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.edition === null || owned.has(row.edition)) cards[row.cardId] = row.edition;
  }
  return {
    owned: [...owned],
    album: album !== null && owned.has(album) ? album : null,
    cards,
  };
}

/** The edition of each of these cards printed in one, for the profile others see. */
export async function readCardEditions(
  db: Reader,
  userId: string,
  cardIds: readonly string[],
  now: EpochMs,
): Promise<Record<string, string>> {
  if (cardIds.length === 0) return {};
  const owned = await ownedBy(db, userId, now);
  if (owned.size === 0) return {};
  const [album, rows] = await Promise.all([
    albumOf(db, userId),
    db
      .select({ cardId: cardEditions.cardId, edition: cardEditions.edition })
      .from(cardEditions)
      .where(and(eq(cardEditions.userId, userId), inArray(cardEditions.cardId, [...cardIds]))),
  ]);
  const chosen = new Map(rows.map((row) => [row.cardId, row.edition]));
  const editions: Record<string, string> = {};
  for (const cardId of cardIds) {
    const edition = cardEditionOf({ album, card: chosen.get(cardId) }, owned);
    if (edition !== null) editions[cardId] = edition;
  }
  return editions;
}

export type EditionWriteResult =
  | { readonly kind: "ok" }
  | { readonly kind: "refused"; readonly reason: EditionRefusal };

/**
 * `PUT /me/editions/album`: the whole album in an edition, or ordinary. Cards' own choices go, so
 * that every card prints alike. The player's row is locked against a concurrent choice.
 */
export async function setAlbumEdition(
  db: Database,
  input: { readonly userId: string; readonly edition: string | null; readonly now: EpochMs },
): Promise<EditionWriteResult> {
  const { userId, edition, now } = input;
  await ensurePlayer(db, userId);
  return db.transaction(async (tx): Promise<EditionWriteResult> => {
    await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.userId, userId))
      .for("update");
    if (edition !== null && !(await ownedBy(tx, userId, now)).has(edition)) {
      return { kind: "refused", reason: "edition_not_owned" };
    }
    await tx.update(players).set({ cardEdition: edition }).where(eq(players.userId, userId));
    await tx.delete(cardEditions).where(eq(cardEditions.userId, userId));
    return { kind: "ok" };
  });
}

/** `PUT /me/editions/cards/:cardId`: one owned card in an edition, or ordinary. */
export async function setCardEdition(
  db: Database,
  input: {
    readonly userId: string;
    readonly cardId: string;
    readonly edition: string | null;
    readonly now: EpochMs;
  },
): Promise<EditionWriteResult> {
  const { userId, cardId, edition, now } = input;
  await ensurePlayer(db, userId);
  return db.transaction(async (tx): Promise<EditionWriteResult> => {
    await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.userId, userId))
      .for("update");
    if (edition !== null && !(await ownedBy(tx, userId, now)).has(edition)) {
      return { kind: "refused", reason: "edition_not_owned" };
    }
    const [copy] = await tx
      .select({ cardId: userCards.cardId })
      .from(userCards)
      .where(
        and(eq(userCards.userId, userId), eq(userCards.cardId, cardId), gt(userCards.quantity, 0)),
      )
      .limit(1);
    if (copy === undefined) return { kind: "refused", reason: "card_not_owned" };
    const updatedAt = new Date(now);
    await tx
      .insert(cardEditions)
      .values({ userId, cardId, edition, updatedAt })
      .onConflictDoUpdate({
        target: [cardEditions.userId, cardEditions.cardId],
        set: { edition, updatedAt },
      });
    return { kind: "ok" };
  });
}
