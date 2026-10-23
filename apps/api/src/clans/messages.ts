import type { ClanEvent, ClanMessage, PlayerBadge } from "@leximon/contract";
import {
  CLAN_SCHEDULE,
  canAct,
  checkClanMessage,
  clanRulesAt,
  type EpochMs,
  type Mention,
  mentionCandidates,
  nextMessageAt,
  PSEUDO_SCHEDULE,
  pseudoRulesAt,
  resolveMentions,
} from "@leximon/core";
import { type ClanEventPayload, type Database, schema } from "@leximon/db";
import { and, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import type { Refused } from "./clans";

const { clanMembers, clanMessages, clans, moderationReports, players, userBlocks } = schema;

const refuse = (reason: Refused["reason"]): Refused => ({ kind: "refused", reason });

const messageFields = {
  id: clanMessages.id,
  kind: clanMessages.kind,
  authorId: clanMessages.authorId,
  body: clanMessages.body,
  event: clanMessages.event,
  mentions: clanMessages.mentions,
  createdAt: clanMessages.createdAt,
  deletedAt: clanMessages.deletedAt,
  hiddenAt: clanMessages.hiddenAt,
};
type MessageRow = Pick<typeof clanMessages.$inferSelect, keyof typeof messageFields>;
type Reader = Pick<Database, "select">;

/** Players the viewer blocked or who blocked them: they vanish from the discussion. */
function blockedEitherWay(viewerId: string) {
  return sql`(select ${userBlocks.blockedId} from ${userBlocks} where ${userBlocks.blockerId} = ${viewerId}
    union select ${userBlocks.blockerId} from ${userBlocks} where ${userBlocks.blockedId} = ${viewerId})`;
}

export type ListMessagesResult =
  | { readonly kind: "ok"; readonly messages: ClanMessage[]; readonly hasMore: boolean }
  | Refused;

/**
 * `GET /clans/:id/messages`: members only, newest first. `after` returns what came since
 * the last message received, `before` pages back in time.
 */
export async function listMessages(
  db: Database,
  input: {
    readonly viewerId: string;
    readonly clanId: string;
    readonly after: number | undefined;
    readonly before: number | undefined;
    readonly limit: number;
    readonly now: EpochMs;
  },
): Promise<ListMessagesResult> {
  const { viewerId, clanId, after, before, limit, now } = input;
  const latest = db
    .select(messageFields)
    .from(clanMessages)
    .where(
      and(
        eq(clanMessages.clanId, clanId),
        after === undefined ? undefined : gt(clanMessages.id, after),
        before === undefined ? undefined : lt(clanMessages.id, before),
        or(
          sql`${clanMessages.authorId} is null`,
          sql`${clanMessages.authorId} not in ${blockedEitherWay(viewerId)}`,
        ),
      ),
    )
    .orderBy(desc(clanMessages.id))
    .limit(limit + 1)
    .as("latest");
  // One round trip for the membership and the page: the discussion is polled every few seconds.
  // No row: not a member; one row with no message: nothing new.
  const joined = await db
    .select({
      message: {
        id: latest.id,
        kind: latest.kind,
        authorId: latest.authorId,
        body: latest.body,
        event: latest.event,
        mentions: latest.mentions,
        createdAt: latest.createdAt,
        deletedAt: latest.deletedAt,
        hiddenAt: latest.hiddenAt,
      },
    })
    .from(clanMembers)
    .leftJoinLateral(latest, sql`true`)
    .where(and(eq(clanMembers.userId, viewerId), eq(clanMembers.clanId, clanId)))
    .orderBy(desc(latest.id));
  if (joined.length === 0) return refuse("not_member");
  const rows = joined.flatMap((row) => (row.message === null ? [] : [row.message]));
  const page = rows.slice(0, limit);
  const badges = await readBadges(db, page.flatMap(involvedPlayers), now);
  return {
    kind: "ok",
    messages: page.flatMap((row) => toMessage(row, badges, viewerId)),
    hasMore: rows.length > limit,
  };
}

function involvedPlayers(row: MessageRow): string[] {
  if (row.kind === "message") return row.authorId === null ? [] : [row.authorId];
  const event = row.event;
  return event !== null && "userId" in event ? [event.userId] : [];
}

function toMessage(
  row: MessageRow,
  badges: ReadonlyMap<string, PlayerBadge>,
  viewerId: string,
): ClanMessage[] {
  const createdAt = row.createdAt.toISOString();
  if (row.kind === "event") {
    if (row.event === null) return [];
    return [{ kind: "event", id: row.id, event: toEvent(row.event, badges), createdAt }];
  }
  const removed = row.hiddenAt !== null ? "hidden" : row.deletedAt !== null ? "deleted" : null;
  return [
    {
      kind: "message",
      id: row.id,
      author: row.authorId === null ? null : (badges.get(row.authorId) ?? null),
      body: removed === null ? row.body : null,
      removed,
      mine: row.authorId === viewerId,
      mentions:
        removed === null
          ? (row.mentions ?? []).map(({ start, end, userId }) => ({
              start,
              end,
              me: userId === viewerId,
            }))
          : [],
      createdAt,
    },
  ];
}

function toEvent(event: ClanEventPayload, badges: ReadonlyMap<string, PlayerBadge>): ClanEvent {
  switch (event.type) {
    case "joined":
    case "left":
    case "excluded":
      return { type: event.type, player: badges.get(event.userId) ?? null };
    case "role":
      return { type: "role", player: badges.get(event.userId) ?? null, role: event.role };
    case "legendary":
      return { type: "legendary", player: badges.get(event.userId) ?? null, cardId: event.cardId };
    case "tier":
      return { type: "tier", tier: event.tier };
    case "level":
      return { type: "level", level: event.level };
    case "renamed":
      return { type: "renamed", name: event.name };
    default:
      throw new Error(`Unknown clan event: ${JSON.stringify(event satisfies never)}`);
  }
}

export type PostMessageResult =
  | {
      readonly kind: "posted";
      readonly message: ClanMessage;
      /** Members named in it, other than its author: they get a letter. */
      readonly mentioned: boolean;
    }
  | (Refused & { readonly retryAt?: string });

/**
 * `POST /clans/:id/messages`. Filtered when sent: a refused message is not stored and
 * the author learns why. The member's row is locked for the pace of one message every 2 s, so two
 * quick sends cannot both pass.
 */
export async function postMessage(
  db: Database,
  input: {
    readonly userId: string;
    readonly clanId: string;
    readonly body: string;
    readonly canWrite: boolean;
    readonly now: EpochMs;
  },
): Promise<PostMessageResult> {
  const { userId, clanId, canWrite, now } = input;
  const rules = clanRulesAt(CLAN_SCHEDULE, now);
  if (!canWrite) return refuse("sanctioned");
  const checked = checkClanMessage(rules, input.body);
  if (!checked.ok) return refuse(`message_${checked.reason}`);

  return db.transaction(async (tx): Promise<PostMessageResult> => {
    const [member] = await tx
      .select({ mutedUntil: clanMembers.mutedUntil, lastMessageAt: clanMembers.lastMessageAt })
      .from(clanMembers)
      .where(and(eq(clanMembers.userId, userId), eq(clanMembers.clanId, clanId)))
      .for("update");
    if (member === undefined) return refuse("not_member");
    if (member.mutedUntil !== null && member.mutedUntil.getTime() > now) {
      return { ...refuse("muted"), retryAt: member.mutedUntil.toISOString() };
    }
    const retryAt = nextMessageAt(rules, member.lastMessageAt?.getTime() ?? null, now);
    if (retryAt !== null)
      return { ...refuse("too_soon"), retryAt: new Date(retryAt).toISOString() };

    const mentions = await findMentions(tx, clanId, checked.text, now);
    const [row] = await tx
      .insert(clanMessages)
      .values({
        clanId,
        kind: "message",
        authorId: userId,
        body: checked.text,
        mentions: mentions.length === 0 ? null : mentions,
        createdAt: new Date(now),
      })
      .returning();
    if (row === undefined) throw new Error("Message insert returned no row");
    await tx
      .update(clanMembers)
      .set({ lastMessageAt: new Date(now) })
      .where(eq(clanMembers.userId, userId));
    const badges = await readBadges(tx, [userId], now);
    const [message] = toMessage(row, badges, userId);
    if (message === undefined) throw new Error("A message without its view");
    return {
      kind: "posted",
      message,
      mentioned: mentions.some((mention) => mention.userId !== userId),
    };
  });
}

/** The members a message names with "@", looked up by pseudo key among the clan's members. */
async function findMentions(
  db: Reader,
  clanId: string,
  body: string,
  now: EpochMs,
): Promise<Mention[]> {
  const candidates = mentionCandidates(body, pseudoRulesAt(PSEUDO_SCHEDULE, now).maxLength);
  if (candidates.length === 0) return [];
  const rows = await db
    .select({ userId: players.userId, key: players.pseudoKey })
    .from(clanMembers)
    .innerJoin(players, eq(players.userId, clanMembers.userId))
    .where(
      and(
        eq(clanMembers.clanId, clanId),
        inArray(players.pseudoKey, [...new Set(candidates.map((candidate) => candidate.key))]),
      ),
    );
  const members = new Map(rows.flatMap((row) => (row.key === null ? [] : [[row.key, row.userId]])));
  return resolveMentions(candidates, members);
}

export type DeleteMessageResult = { readonly kind: "ok" } | Refused;

/**
 * `DELETE /clans/:id/messages/:messageId`: its author, the chief or a deputy. The row stays,
 * without its text; a report already made keeps its own copy.
 */
export async function deleteMessage(
  db: Database,
  input: {
    readonly userId: string;
    readonly clanId: string;
    readonly messageId: number;
    readonly now: EpochMs;
  },
): Promise<DeleteMessageResult> {
  const { userId, clanId, messageId, now } = input;
  const [member] = await db
    .select({ role: clanMembers.role })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, userId), eq(clanMembers.clanId, clanId)));
  if (member === undefined) return refuse("not_member");
  const [message] = await db
    .select({ authorId: clanMessages.authorId, kind: clanMessages.kind })
    .from(clanMessages)
    .where(and(eq(clanMessages.id, messageId), eq(clanMessages.clanId, clanId)));
  if (message === undefined || message.kind !== "message") return refuse("player_not_found");
  if (message.authorId !== userId && !canAct(member.role, "delete_message")) {
    return refuse("not_allowed");
  }
  await db
    .update(clanMessages)
    .set({ body: null, deletedAt: new Date(now), deletedBy: userId })
    .where(and(eq(clanMessages.id, messageId), sql`${clanMessages.deletedAt} is null`));
  return { kind: "ok" };
}

export type ReportResult = { readonly kind: "ok" } | Refused;

/**
 * `POST /clans/:id/messages/:messageId/report`: a member reports another's message.
 * The text is copied into the report, and the message is kept until the report is handled.
 * Reporting twice changes nothing.
 */
export async function reportMessage(
  db: Database,
  input: {
    readonly userId: string;
    readonly clanId: string;
    readonly messageId: number;
    readonly now: EpochMs;
  },
): Promise<ReportResult> {
  const { userId, clanId, messageId, now } = input;
  const [member] = await db
    .select({ clanId: clanMembers.clanId })
    .from(clanMembers)
    .where(and(eq(clanMembers.userId, userId), eq(clanMembers.clanId, clanId)));
  if (member === undefined) return refuse("not_member");
  const [message] = await db
    .select({
      authorId: clanMessages.authorId,
      body: clanMessages.body,
      kind: clanMessages.kind,
      pseudo: players.pseudo,
    })
    .from(clanMessages)
    .leftJoin(players, eq(players.userId, clanMessages.authorId))
    .where(and(eq(clanMessages.id, messageId), eq(clanMessages.clanId, clanId)));
  if (
    message === undefined ||
    message.kind !== "message" ||
    message.authorId === null ||
    message.body === null
  ) {
    return refuse("player_not_found");
  }
  if (message.authorId === userId) return refuse("self");
  await db
    .insert(moderationReports)
    .values({
      id: crypto.randomUUID(),
      reporterId: userId,
      reportedId: message.authorId,
      pseudo: message.pseudo ?? "",
      targetKind: "message",
      targetKey: String(messageId),
      content: message.body,
      clanId,
      messageId,
      createdAt: new Date(now),
    })
    .onConflictDoNothing();
  return { kind: "ok" };
}

/**
 * `POST /clans/:id/report`: reports the clan's name or motto, as written now. It points at the
 * chief, who chose them. Members of any clan may report, the player being a member of the game.
 */
export async function reportClanName(
  db: Database,
  input: { readonly userId: string; readonly clanId: string; readonly now: EpochMs },
): Promise<ReportResult> {
  const { userId, clanId, now } = input;
  const [row] = await db
    .select({
      name: clans.name,
      motto: clans.motto,
      chiefId: clanMembers.userId,
      pseudo: players.pseudo,
    })
    .from(clans)
    .innerJoin(clanMembers, and(eq(clanMembers.clanId, clans.id), eq(clanMembers.role, "chief")))
    .innerJoin(players, eq(players.userId, clanMembers.userId))
    .where(eq(clans.id, clanId));
  if (row === undefined) return refuse("clan_not_found");
  if (row.chiefId === userId) return refuse("self");
  await db
    .insert(moderationReports)
    .values({
      id: crypto.randomUUID(),
      reporterId: userId,
      reportedId: row.chiefId,
      pseudo: row.pseudo ?? "",
      targetKind: "clan_name",
      targetKey: clanId,
      content: row.motto === "" ? row.name : `${row.name} · ${row.motto}`,
      clanId,
      createdAt: new Date(now),
    })
    .onConflictDoNothing();
  return { kind: "ok" };
}

/** Messages around a reported one, for the team (the report's context). */
export async function messageContext(
  db: Pick<Database, "select">,
  clanId: string,
  messageId: number,
): Promise<{ id: number; author: string | null; body: string | null }[]> {
  const rows = await db
    .select({ id: clanMessages.id, body: clanMessages.body, author: players.pseudo })
    .from(clanMessages)
    .leftJoin(players, eq(players.userId, clanMessages.authorId))
    .where(
      and(
        eq(clanMessages.clanId, clanId),
        eq(clanMessages.kind, "message"),
        sql`${clanMessages.id} in (select id from (
            (select id from clan_messages where clan_id = ${clanId} and kind = 'message'
              and id <= ${messageId} order by id desc limit 4)
            union all
            (select id from clan_messages where clan_id = ${clanId} and kind = 'message'
              and id > ${messageId} order by id limit 3)) around)`,
      ),
    )
    .orderBy(clanMessages.id);
  return rows;
}
