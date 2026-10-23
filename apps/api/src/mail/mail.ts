import type { MailLetter, MailResponse, PlayerBadge } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, type MailPayload, schema } from "@leximon/db";
import { and, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { purgeRows } from "../purge";

const { clanMessages, mailLetters, trades } = schema;

/** Letters are erased after this long, read or not. */
export const MAIL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAIL_PAGE = 30;
/** Characters of a message shown in the letter that names the player. */
const EXCERPT_LENGTH = 120;

type LetterRow = typeof mailLetters.$inferSelect;
type NewLetter = typeof mailLetters.$inferInsert;

// --- Written by the queue's consumer ------------------------------------------------------------

/**
 * Letters about offers, from each offer's current state: the recipient of a pending offer, the
 * proposer of an offer accepted or declined. Once the offer is no longer pending, the recipient's
 * letter is read: there is nothing left to answer. Replaying a message writes nothing twice.
 */
export async function writeTradeLetters(
  db: Database,
  tradeIds: readonly string[],
  now: EpochMs,
): Promise<void> {
  if (tradeIds.length === 0) return;
  const rows = await db
    .select()
    .from(trades)
    .where(inArray(trades.id, [...new Set(tradeIds)]));
  const letters: NewLetter[] = [];
  const answered: { readonly userId: string; readonly dedupeKey: string }[] = [];
  for (const trade of rows) {
    const resolvedAt = trade.resolvedAt ?? new Date(now);
    if (trade.status === "pending") {
      if (trade.recipientId === null || trade.expiresAt.getTime() <= now) continue;
      letters.push({
        userId: trade.recipientId,
        kind: "offer_received",
        payload: { tradeId: trade.id, playerId: trade.proposerId },
        dedupeKey: `trade:${trade.id}:received`,
        createdAt: trade.createdAt,
      });
      continue;
    }
    if (trade.recipientId !== null) {
      answered.push({ userId: trade.recipientId, dedupeKey: `trade:${trade.id}:received` });
    }
    if (trade.proposerId === null || trade.status === "cancelled") continue;
    letters.push({
      userId: trade.proposerId,
      kind: trade.status === "completed" ? "offer_completed" : "offer_declined",
      payload: { tradeId: trade.id, playerId: trade.recipientId },
      dedupeKey: `trade:${trade.id}:${trade.status}`,
      createdAt: resolvedAt,
    });
  }
  await insertLetters(db, letters);
  if (answered.length > 0) {
    await db
      .update(mailLetters)
      .set({ readAt: new Date(now) })
      .where(
        and(
          isNull(mailLetters.readAt),
          or(
            ...answered.map((letter) =>
              and(
                eq(mailLetters.userId, letter.userId),
                eq(mailLetters.dedupeKey, letter.dedupeKey),
              ),
            ),
          ),
        ),
      );
  }
}

/**
 * Letters to the members a message names: still in the clan, other than its author, and neither
 * blocking the author nor blocked by them. A message removed before the consumer runs names
 * nobody.
 */
export async function writeMentionLetters(
  db: Database,
  messageIds: readonly number[],
): Promise<void> {
  if (messageIds.length === 0) return;
  const rows = await db
    .select({
      id: clanMessages.id,
      clanId: clanMessages.clanId,
      authorId: clanMessages.authorId,
      mentions: clanMessages.mentions,
      createdAt: clanMessages.createdAt,
    })
    .from(clanMessages)
    .where(
      and(
        inArray(clanMessages.id, [...new Set(messageIds)]),
        eq(clanMessages.kind, "message"),
        isNull(clanMessages.deletedAt),
        isNull(clanMessages.hiddenAt),
      ),
    );
  for (const message of rows) {
    const { authorId } = message;
    const named = [...new Set((message.mentions ?? []).map((mention) => mention.userId))].filter(
      (userId) => userId !== authorId,
    );
    if (authorId === null || named.length === 0) continue;
    await db.execute(sql`
      insert into mail_letters (user_id, kind, payload, dedupe_key, created_at)
      select m.user_id, 'clan_mention',
        jsonb_build_object('clanId', m.clan_id, 'messageId', ${message.id}::int, 'playerId', ${authorId}::text),
        ${`mention:${message.id}`}, ${message.createdAt}
      from clan_members m
      where m.clan_id = ${message.clanId}
        and m.user_id in (${sql.join(
          named.map((userId) => sql`${userId}`),
          sql`, `,
        )})
        and not exists (select 1 from user_blocks b
          where (b.blocker_id = m.user_id and b.blocked_id = ${authorId})
             or (b.blocker_id = ${authorId} and b.blocked_id = m.user_id))
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

/**
 * Letters to the chief and deputies of a clan a player asked to enter, while the request still
 * waits. A new request after a withdrawn one is a new letter.
 */
export async function writeRequestLetters(
  db: Database,
  requests: readonly { readonly clanId: string; readonly userId: string }[],
): Promise<void> {
  for (const { clanId, userId } of requests) {
    await db.execute(sql`
      insert into mail_letters (user_id, kind, payload, dedupe_key, created_at)
      select m.user_id, 'clan_request',
        jsonb_build_object('clanId', r.clan_id, 'playerId', r.user_id),
        'request:' || r.clan_id || ':' || r.user_id || ':'
          || (extract(epoch from r.created_at) * 1000)::bigint,
        r.created_at
      from clan_join_requests r
      join clan_members m on m.clan_id = r.clan_id and m.role in ('chief', 'deputy')
      where r.clan_id = ${clanId} and r.user_id = ${userId}
      on conflict (user_id, dedupe_key) do nothing`);
  }
}

async function insertLetters(db: Database, letters: readonly NewLetter[]): Promise<void> {
  if (letters.length === 0) return;
  await db
    .insert(mailLetters)
    .values([...letters])
    .onConflictDoNothing({ target: [mailLetters.userId, mailLetters.dedupeKey] });
}

// --- Read by the player -------------------------------------------------------------------------

/**
 * `GET /me/mail`: a page of letters, newest first, with the players and excerpts as they read
 * now, the count of unread letters and the words slipping away.
 */
export async function readMail(
  db: Database,
  input: { readonly userId: string; readonly before: number | undefined; readonly now: EpochMs },
): Promise<MailResponse> {
  const { userId, before, now } = input;
  const rows = await db
    .select()
    .from(mailLetters)
    .where(
      and(
        eq(mailLetters.userId, userId),
        before === undefined ? undefined : lt(mailLetters.id, before),
      ),
    )
    .orderBy(desc(mailLetters.id))
    .limit(MAIL_PAGE + 1);
  const page = rows.slice(0, MAIL_PAGE);

  const parties = await readTradeParties(db, page, userId);
  const playerOf = (row: LetterRow): string | null =>
    "tradeId" in row.payload ? (parties.get(row.payload.tradeId) ?? null) : row.payload.playerId;
  const [badges, excerpts, counts] = await Promise.all([
    readBadges(
      db,
      page.flatMap((row) => {
        const playerId = playerOf(row);
        return playerId === null ? [] : [playerId];
      }),
      now,
    ),
    readExcerpts(db, page),
    db.execute<{ unread: number; due_words: number; first_due: string | null }>(sql`
      with due as (
        select um.card_id, um.due from user_mastery um
        where um.user_id = ${userId} and um.due <= ${new Date(now)}
          and exists (select 1 from user_cards uc
            where uc.user_id = um.user_id and uc.card_id = um.card_id and uc.quantity > 0)
      )
      select
        (select count(*)::int from mail_letters
          where user_id = ${userId} and read_at is null) as unread,
        (select count(*)::int from due) as due_words,
        (select card_id from due order by due, card_id limit 1) as first_due`),
  ]);
  const count = counts.rows[0];
  return {
    letters: page.flatMap((row) => toLetter(row, playerOf(row), badges, excerpts)),
    unread: count?.unread ?? 0,
    slipping:
      count === undefined || count.first_due === null
        ? null
        : { cardId: count.first_due, others: Math.max(0, count.due_words - 1) },
    hasMore: rows.length > MAIL_PAGE,
  };
}

/**
 * The other side of each offer a letter points to, read from the offer itself: a guest who
 * signed up since is found under their account, a player who left is `null`.
 */
async function readTradeParties(
  db: Database,
  rows: readonly LetterRow[],
  userId: string,
): Promise<Map<string, string | null>> {
  const ids = rows.flatMap((row) => ("tradeId" in row.payload ? [row.payload.tradeId] : []));
  if (ids.length === 0) return new Map();
  const found = await db
    .select({ id: trades.id, proposerId: trades.proposerId, recipientId: trades.recipientId })
    .from(trades)
    .where(inArray(trades.id, ids));
  return new Map(
    found.map((trade) => [
      trade.id,
      trade.proposerId === userId ? trade.recipientId : trade.proposerId,
    ]),
  );
}

/** The opening words of each message a letter points to; `null` once it was removed. */
async function readExcerpts(
  db: Database,
  rows: readonly LetterRow[],
): Promise<Map<number, string | null>> {
  const ids = rows.flatMap((row) => ("messageId" in row.payload ? [row.payload.messageId] : []));
  if (ids.length === 0) return new Map();
  const messages = await db
    .select({
      id: clanMessages.id,
      body: clanMessages.body,
      deletedAt: clanMessages.deletedAt,
      hiddenAt: clanMessages.hiddenAt,
    })
    .from(clanMessages)
    .where(inArray(clanMessages.id, ids));
  return new Map(
    messages.map((message) => [
      message.id,
      message.body === null || message.deletedAt !== null || message.hiddenAt !== null
        ? null
        : excerpt(message.body),
    ]),
  );
}

export function excerpt(body: string): string {
  const flat = body.replaceAll(/\s+/g, " ");
  if (flat.length <= EXCERPT_LENGTH) return flat;
  const cut = flat.slice(0, EXCERPT_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > EXCERPT_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function toLetter(
  row: LetterRow,
  playerId: string | null,
  badges: ReadonlyMap<string, PlayerBadge>,
  excerpts: ReadonlyMap<number, string | null>,
): MailLetter[] {
  const payload: MailPayload = row.payload;
  const base = {
    id: row.id,
    player: playerId === null ? null : (badges.get(playerId) ?? null),
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
  switch (row.kind) {
    case "offer_received":
    case "offer_completed":
    case "offer_declined":
      return "tradeId" in payload ? [{ kind: row.kind, ...base, tradeId: payload.tradeId }] : [];
    case "clan_mention":
      return "messageId" in payload
        ? [
            {
              kind: row.kind,
              ...base,
              clanId: payload.clanId,
              excerpt: excerpts.get(payload.messageId) ?? null,
            },
          ]
        : [];
    case "clan_request":
      return "clanId" in payload ? [{ kind: row.kind, ...base, clanId: payload.clanId }] : [];
    default:
      throw new Error(`Unknown letter: ${JSON.stringify(row.kind satisfies never)}`);
  }
}

/** `POST /me/mail/read`: every letter up to `upTo` is read. Returns what stays unread. */
export async function markMailRead(
  db: Database,
  input: { readonly userId: string; readonly upTo: number; readonly now: EpochMs },
): Promise<number> {
  const { userId, upTo, now } = input;
  await db
    .update(mailLetters)
    .set({ readAt: new Date(now) })
    .where(
      and(eq(mailLetters.userId, userId), lte(mailLetters.id, upTo), isNull(mailLetters.readAt)),
    );
  const [row] = await db
    .select({ unread: sql<number>`count(*)::int` })
    .from(mailLetters)
    .where(and(eq(mailLetters.userId, userId), isNull(mailLetters.readAt)));
  return row?.unread ?? 0;
}

/** The daily maintenance: letters older than the retention go, read or not. */
export function purgeMail(db: Database, now: EpochMs): Promise<number> {
  return purgeRows(db, mailLetters, lt(mailLetters.createdAt, new Date(now - MAIL_RETENTION_MS)));
}
