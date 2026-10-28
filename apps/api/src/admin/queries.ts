import type {
  AdminAction,
  AdminActionsResponse,
  AdminCardStats,
  AdminCatalog,
  AdminOverview,
  AdminPlayerDetail,
  AdminPlayerKind,
  AdminPlayerSort,
  AdminPlayerSummary,
  AdminPlayersResponse,
  AdminTrade,
  AdminTradesResponse,
  AdminWaitlistResponse,
  SortDirection,
  TradeStatus,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  computeRefill,
  createFullWallet,
  type EpochMs,
  levelOf,
  type Rarity,
  REFILL_SCHEDULE,
  reserveCapacity,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { eq, type SQL, sql } from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";
import { readWaitlistOpening } from "../campaigns/campaigns";
import { invitableAddress } from "../waitlist/invite";
import {
  decodeCursor,
  decodeTimeCursor,
  encodeCursor,
  nextCursor,
  type TimeCursor,
} from "./cursor";

/**
 * Reads of the back office. Off the players' critical path and rare: a few round trips per page
 * are fine, but every list is paginated and every query is bounded.
 */

const {
  adminActions,
  boosterOpens,
  boosterWallets,
  cards,
  collections,
  guestLinks,
  playerDays,
  players,
  reviewLogs,
  tradeItems,
  trades,
  userCards,
  userMastery,
  userProgress,
  users,
  waitlistSignups,
} = schema;

const DAY_MS = 86_400_000;
export const PAGE_SIZE = 50;

/** A cursor that cannot be read is a client error, not an empty page. */
export class InvalidCursorError extends Error {
  constructor() {
    super("invalid_cursor");
  }
}

function cursorFrom(value: string | undefined): TimeCursor | null {
  if (value === undefined) return null;
  const cursor = decodeTimeCursor(value);
  if (cursor === undefined) throw new InvalidCursorError();
  return cursor;
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** Address of the admin browsing; `requireAdmin` has just read their session. */
export async function readAdminEmail(db: Database, adminId: string): Promise<string> {
  const [row] = await db.select({ email: users.email }).from(users).where(eq(users.id, adminId));
  if (row === undefined) throw new Error(`Admin ${adminId} missing right after its session check`);
  return row.email;
}

export async function readOverview(db: Database, now: EpochMs): Promise<AdminOverview> {
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);
  const result = await db.execute<Record<string, number>>(sql`
    select
      (select count(*)::int from ${users} where not ${users.isAnonymous}) as members,
      (select count(*)::int from ${users} where ${users.isAnonymous}) as guests,
      (select count(*)::int from ${users} where ${users.banned}) as banned,
      (select count(*)::int from ${users}
        where not ${users.isAnonymous} and ${users.createdAt} >= ${week}) as new_members_7d,
      (select count(*)::int from ${users}
        where ${users.isAnonymous} and ${users.createdAt} >= ${week}) as new_guests_7d,
      (select count(*)::int from ${boosterOpens} where ${boosterOpens.openedAt} >= ${day}) as opens_24h,
      (select count(*)::int from ${boosterOpens} where ${boosterOpens.openedAt} >= ${week}) as opens_7d,
      (select count(*)::int from ${reviewLogs} where ${reviewLogs.reviewedAt} >= ${day}) as answers_24h,
      (select count(*)::int from ${reviewLogs} where ${reviewLogs.reviewedAt} >= ${week}) as answers_7d,
      (select count(*)::int from ${trades}
        where ${trades.status} = 'pending' and ${trades.expiresAt} > ${new Date(now)}) as trades_pending,
      (select count(*)::int from ${trades}
        where ${trades.status} = 'completed' and ${trades.resolvedAt} >= ${week}) as trades_completed_7d,
      (select count(*)::int from ${waitlistSignups}) as waitlist,
      (select count(*)::int from ${waitlistSignups}
        where ${waitlistSignups.createdAt} >= ${week}) as waitlist_7d
  `);
  const row = result.rows[0] ?? {};
  const n = (key: string) => Number(row[key] ?? 0);
  return {
    players: {
      members: n("members"),
      guests: n("guests"),
      banned: n("banned"),
      newMembers7d: n("new_members_7d"),
      newGuests7d: n("new_guests_7d"),
    },
    boosters: { last24h: n("opens_24h"), last7d: n("opens_7d") },
    answers: { last24h: n("answers_24h"), last7d: n("answers_7d") },
    trades: { pending: n("trades_pending"), completed7d: n("trades_completed_7d") },
    waitlist: { total: n("waitlist"), last7d: n("waitlist_7d") },
  };
}

type PlayerRow = {
  id: string;
  email: string;
  is_anonymous: boolean;
  role: string | null;
  banned: boolean | null;
  created_at: string;
  code: string | null;
  pseudo: string | null;
  xp: number;
};

const playerColumns = sql`
  ${users.id} as id, ${users.email} as email, ${users.isAnonymous} as is_anonymous,
  ${users.role} as role, ${users.banned} as banned, ${users.createdAt} as created_at,
  ${players.code} as code, ${players.pseudo} as pseudo, coalesce(${userProgress.xp}, 0) as xp`;

const playerJoins = sql`
  from ${users}
  left join ${players} on ${players.userId} = ${users.id}
  left join ${userProgress} on ${userProgress.userId} = ${users.id}`;

function toSummary(row: PlayerRow): AdminPlayerSummary {
  return {
    id: row.id,
    // A guest's address is a placeholder made up by the anonymous plugin.
    email: row.is_anonymous ? null : row.email,
    pseudo: row.pseudo,
    isGuest: row.is_anonymous,
    isAdmin: row.role === ADMIN_ROLE,
    banned: row.banned === true,
    playerCode: row.code,
    level: levelOf(row.xp).level,
    createdAt: iso(row.created_at),
  };
}

const KIND_FILTERS: Record<AdminPlayerKind, SQL> = {
  all: sql`true`,
  member: sql`not ${users.isAnonymous}`,
  guest: sql`${users.isAnonymous}`,
  banned: sql`${users.banned}`,
  admin: sql`${users.role} = ${ADMIN_ROLE}`,
};

/** `%` and `_` typed by the admin are searched for literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

type PlayerListRow = PlayerRow & {
  pseudo: string | null;
  cards: number;
  boosters: number;
  answers: number;
  days: number;
  last_day: string | null;
  total: number;
  sort_value: string;
};

/**
 * How each column sorts: a value never null, so that the cursor can compare it, and the shape the
 * cursor's copy of it must have before it goes back to the database.
 */
const PLAYER_SORTS: Record<
  AdminPlayerSort,
  { readonly key: SQL; readonly cast: (value: string) => SQL; readonly valid: RegExp }
> = {
  created: {
    key: sql`p.created_at`,
    cast: (value) => sql`${value}::timestamptz`,
    valid: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:\d{2})?$/,
  },
  lastDay: {
    key: sql`coalesce(p.last_day::date, '0001-01-01'::date)`,
    cast: (value) => sql`${value}::date`,
    valid: /^\d{4}-\d{2}-\d{2}$/,
  },
  // Players without a pseudo come after the others, whichever the direction of the letters.
  pseudo: {
    key: sql`(coalesce(p.pseudo_key, '~') collate "C")`,
    cast: (value) => sql`(${value}::text collate "C")`,
    valid: /^[^\n]{1,64}$/,
  },
  level: { key: sql`p.xp`, cast: (value) => sql`${value}::int`, valid: /^\d{1,10}$/ },
  cards: { key: sql`p.cards`, cast: (value) => sql`${value}::int`, valid: /^\d{1,10}$/ },
  boosters: { key: sql`p.boosters`, cast: (value) => sql`${value}::int`, valid: /^\d{1,10}$/ },
  answers: { key: sql`p.answers`, cast: (value) => sql`${value}::int`, valid: /^\d{1,10}$/ },
  days: { key: sql`p.days`, cast: (value) => sql`${value}::int`, valid: /^\d{1,10}$/ },
};

/** The page after a cursor of the same sort; `null` without a cursor. */
function sortCursorFrom(
  value: string | undefined,
  order: string,
  valid: RegExp,
): { readonly key: string; readonly id: string } | null {
  if (value === undefined) return null;
  const parts = decodeCursor(value, 3);
  const [cursorOrder, key = "", id = ""] = parts ?? [];
  if (cursorOrder !== order || !valid.test(key)) throw new InvalidCursorError();
  return { key, id };
}

export async function listPlayers(
  db: Database,
  input: {
    readonly q?: string | undefined;
    readonly kind: AdminPlayerKind;
    readonly sort: AdminPlayerSort;
    readonly dir: SortDirection;
    readonly cursor?: string | undefined;
  },
): Promise<AdminPlayersResponse> {
  const sort = PLAYER_SORTS[input.sort];
  const order = `${input.sort}:${input.dir}`;
  const after = sortCursorFrom(input.cursor, order, sort.valid);
  const filters: SQL[] = [KIND_FILTERS[input.kind]];
  const q = input.q?.trim();
  if (q !== undefined && q.length > 0) {
    const pattern = likePattern(q);
    filters.push(sql`(${users.email} ilike ${pattern} or ${players.pseudo} ilike ${pattern}
      or ${players.code} = ${q.toUpperCase()} or ${users.id} = ${q})`);
  }
  const descending = input.dir === "desc";
  const direction = descending ? sql`desc` : sql`asc`;
  const page =
    after === null
      ? sql`true`
      : descending
        ? sql`(sort_key, id) < (${sort.cast(after.key)}, ${after.id})`
        : sql`(sort_key, id) > (${sort.cast(after.key)}, ${after.id})`;
  const result = await db.execute<PlayerListRow>(sql`
    with p as (
      select ${playerColumns}, ${players.pseudo} as pseudo, ${players.pseudoKey} as pseudo_key,
        (select count(*)::int from ${userCards}
          where ${userCards.userId} = ${users.id} and ${userCards.quantity} > 0) as cards,
        (select count(*)::int from ${boosterOpens} where ${boosterOpens.userId} = ${users.id}) as boosters,
        (select count(*)::int from ${reviewLogs} where ${reviewLogs.userId} = ${users.id}) as answers,
        (select count(*)::int from ${playerDays} where ${playerDays.userId} = ${users.id}) as days,
        (select max(${playerDays.day})::text from ${playerDays} where ${playerDays.userId} = ${users.id}) as last_day
      ${playerJoins}
      where ${sql.join(filters, sql` and `)}
    ),
    sorted as (
      select p.*, ${sort.key} as sort_key, (count(*) over ())::int as total from p
    )
    select *, sort_key::text as sort_value
    from sorted
    where ${page}
    order by sort_key ${direction}, id ${direction}
    limit ${PAGE_SIZE + 1}
  `);
  const rows = result.rows;
  const last = rows[PAGE_SIZE - 1];
  return {
    players: rows.slice(0, PAGE_SIZE).map((row) => ({
      ...toSummary(row),
      pseudo: row.pseudo,
      cards: row.cards,
      boosters: row.boosters,
      answers: row.answers,
      days: row.days,
      lastDay: row.last_day,
    })),
    // Past the last page, the count is read on an empty result: ask it without the cursor.
    total: rows[0]?.total ?? (after === null ? 0 : await countPlayers(db, filters)),
    nextCursor:
      rows.length > PAGE_SIZE && last !== undefined
        ? encodeCursor([order, last.sort_value, last.id])
        : null,
  };
}

async function countPlayers(db: Database, filters: SQL[]): Promise<number> {
  const result = await db.execute<{ total: number }>(sql`
    select count(*)::int as total ${playerJoins} where ${sql.join(filters, sql` and `)}
  `);
  return result.rows[0]?.total ?? 0;
}

type ActionRow = {
  id: string;
  action: string;
  admin_email: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

function toAction(row: ActionRow): AdminAction {
  return {
    id: row.id,
    action: row.action,
    adminEmail: row.admin_email,
    targetUserId: row.target_user_id,
    details: row.details,
    createdAt: iso(row.created_at),
  };
}

function actionsQuery(where: SQL, limit: number) {
  return sql`
    select ${adminActions.id} as id, ${adminActions.action} as action,
      ${users.email} as admin_email, ${adminActions.targetUserId} as target_user_id,
      ${adminActions.details} as details, ${adminActions.createdAt} as created_at
    from ${adminActions}
    join ${users} on ${users.id} = ${adminActions.adminId}
    where ${where}
    order by ${adminActions.createdAt} desc, ${adminActions.id} desc
    limit ${limit}`;
}

export async function readPlayer(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<AdminPlayerDetail | null> {
  const playerResult = await db.execute<
    PlayerRow & {
      ban_reason: string | null;
      ban_expires: string | null;
      archived_into: string | null;
    }
  >(sql`
    select ${playerColumns}, ${users.banReason} as ban_reason, ${users.banExpires} as ban_expires,
      (select ${guestLinks.accountId} from ${guestLinks} where ${guestLinks.guestId} = ${users.id})
        as archived_into
    ${playerJoins}
    where ${users.id} = ${userId}
  `);
  const row = playerResult.rows[0];
  if (row === undefined) return null;

  const [wallets, collection, mastery, opens, recentOpens, tradeCounts, actions] =
    await Promise.all([
      db.execute<{
        stored: number;
        progress_ms: number;
        as_of: string;
        bonus_boosters: number;
        reserve_slots: number;
      }>(sql`
        select ${boosterWallets.stored} as stored, ${boosterWallets.progressMs} as progress_ms,
          ${boosterWallets.asOf} as as_of, ${boosterWallets.bonusBoosters} as bonus_boosters,
          ${boosterWallets.reserveSlots} as reserve_slots
        from ${boosterWallets} where ${boosterWallets.userId} = ${userId}`),
      db.execute<{ rarity: Rarity; distinct_cards: number; copies: number }>(sql`
        select ${cards.rarity} as rarity, count(*)::int as distinct_cards,
          sum(${userCards.quantity})::int as copies
        from ${userCards} join ${cards} on ${cards.id} = ${userCards.cardId}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0
        group by ${cards.rarity}`),
      db.execute<{ words: number; ink: number; gilded: number }>(sql`
        select count(*)::int as words,
          count(*) filter (where ${userMastery.level} = 'ink')::int as ink,
          count(*) filter (where ${userMastery.level} = 'gilded')::int as gilded
        from ${userMastery} where ${userMastery.userId} = ${userId}`),
      db.execute<{ total: number }>(sql`
        select count(*)::int as total from ${boosterOpens} where ${boosterOpens.userId} = ${userId}`),
      db.execute<{ opened_at: string; collection_id: string | null; from_bonus: boolean }>(sql`
        select ${boosterOpens.openedAt} as opened_at, ${boosterOpens.collectionId} as collection_id,
          ${boosterOpens.fromBonus} as from_bonus
        from ${boosterOpens} where ${boosterOpens.userId} = ${userId}
        order by ${boosterOpens.openedAt} desc limit 10`),
      db.execute<{ total: number; pending: number }>(sql`
        select count(*)::int as total,
          count(*) filter (where ${trades.status} = 'pending'
            and ${trades.expiresAt} > ${new Date(now)})::int as pending
        from ${trades}
        where ${trades.proposerId} = ${userId} or ${trades.recipientId} = ${userId}`),
      db.execute<ActionRow>(actionsQuery(sql`${adminActions.targetUserId} = ${userId}`, 20)),
    ]);

  const walletRow = wallets.rows[0];
  const wallet = computeRefill(
    walletRow === undefined
      ? createFullWallet(REFILL_SCHEDULE, now)
      : {
          stored: walletRow.stored,
          progressMs: walletRow.progress_ms,
          asOf: new Date(walletRow.as_of).getTime(),
        },
    REFILL_SCHEDULE,
    now,
  );
  const byRarity: Partial<Record<Rarity, number>> = {};
  let distinctCards = 0;
  let copies = 0;
  for (const group of collection.rows) {
    byRarity[group.rarity] = group.distinct_cards;
    distinctCards += group.distinct_cards;
    copies += group.copies;
  }
  const masteryRow = mastery.rows[0];

  return {
    player: {
      ...toSummary(row),
      banReason: row.ban_reason,
      banExpires: row.ban_expires === null ? null : iso(row.ban_expires),
      archivedInto: row.archived_into,
    },
    wallet: {
      stored: wallet.stored,
      capacity: REFILL_SCHEDULE[0].capacity,
      nextRefillAt: wallet.nextRefillAt === null ? null : iso(new Date(wallet.nextRefillAt)),
      bonus: walletRow?.bonus_boosters ?? 0,
      bonusCap: reserveCapacity(bonusRulesAt(BONUS_SCHEDULE, now), walletRow?.reserve_slots ?? 0),
    },
    progress: { xp: row.xp, ...levelOf(row.xp) },
    collection: { distinctCards, copies, byRarity },
    mastery: {
      words: masteryRow?.words ?? 0,
      ink: masteryRow?.ink ?? 0,
      gilded: masteryRow?.gilded ?? 0,
    },
    opens: {
      total: opens.rows[0]?.total ?? 0,
      recent: recentOpens.rows.map((open) => ({
        openedAt: iso(open.opened_at),
        collectionId: open.collection_id,
        fromBonus: open.from_bonus,
      })),
    },
    trades: { total: tradeCounts.rows[0]?.total ?? 0, pending: tradeCounts.rows[0]?.pending ?? 0 },
    actions: actions.rows.map(toAction),
  };
}

export async function listActions(
  db: Database,
  cursor: string | undefined,
): Promise<AdminActionsResponse> {
  const after = cursorFrom(cursor);
  const where =
    after === null
      ? sql`true`
      : sql`(${adminActions.createdAt}, ${adminActions.id}) < (${new Date(after.at)}, ${after.id}::uuid)`;
  const result = await db.execute<ActionRow>(actionsQuery(where, PAGE_SIZE + 1));
  return {
    actions: result.rows.slice(0, PAGE_SIZE).map(toAction),
    nextCursor: nextCursor(result.rows, PAGE_SIZE, (row) => ({
      at: iso(row.created_at),
      id: row.id,
    })),
  };
}

export async function listWaitlist(
  db: Database,
  cursor: string | undefined,
): Promise<AdminWaitlistResponse> {
  const after = cursorFrom(cursor);
  const where =
    after === null
      ? sql`true`
      : sql`(${waitlistSignups.createdAt}, ${waitlistSignups.email}) < (${new Date(after.at)}, ${after.id})`;
  const [entries, counts, opening] = await Promise.all([
    db.execute<{
      email: string;
      created_at: string;
      invited_at: string | null;
      has_account: boolean;
    }>(sql`
      select ${waitlistSignups.email} as email, ${waitlistSignups.createdAt} as created_at,
        ${waitlistSignups.invitedAt} as invited_at,
        exists (select 1 from ${users} where ${users.email} = ${waitlistSignups.email}) as has_account
      from ${waitlistSignups} where ${where}
      order by ${waitlistSignups.createdAt} desc, ${waitlistSignups.email} desc
      limit ${PAGE_SIZE + 1}`),
    db.execute<{ total: number; invitable: number }>(sql`
      select count(*)::int as total, (count(*) filter (where ${invitableAddress}))::int as invitable
      from ${waitlistSignups}`),
    readWaitlistOpening(db),
  ]);
  return {
    total: counts.rows[0]?.total ?? 0,
    invitable: counts.rows[0]?.invitable ?? 0,
    opening,
    entries: entries.rows.slice(0, PAGE_SIZE).map((entry) => ({
      email: entry.email,
      createdAt: iso(entry.created_at),
      invitedAt: entry.invited_at === null ? null : iso(entry.invited_at),
      hasAccount: entry.has_account,
    })),
    nextCursor: nextCursor(entries.rows, PAGE_SIZE, (entry) => ({
      at: iso(entry.created_at),
      id: entry.email,
    })),
  };
}

/** Every address, oldest first, for the opening e-mail. A few thousand rows at most before beta. */
export async function exportWaitlist(db: Database): Promise<string> {
  const result = await db.execute<{ email: string; created_at: string }>(sql`
    select ${waitlistSignups.email} as email, ${waitlistSignups.createdAt} as created_at
    from ${waitlistSignups} order by ${waitlistSignups.createdAt}, ${waitlistSignups.email}`);
  const lines = result.rows.map((row) => `${csvField(row.email)},${iso(row.created_at)}`);
  return `email,inscrit_le\n${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
}

/** Quotes a field that a spreadsheet could read as a formula or that holds a separator. */
function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

type TradeRow = {
  id: string;
  status: TradeStatus;
  created_at: string;
  expires_at: string;
  resolved_at: string | null;
  proposer_id: string;
  proposer_email: string;
  proposer_guest: boolean;
  proposer_code: string | null;
  recipient_id: string;
  recipient_email: string;
  recipient_guest: boolean;
  recipient_code: string | null;
  give: string[] | null;
  want: string[] | null;
};

export async function listTrades(
  db: Database,
  input: { readonly status?: TradeStatus | undefined; readonly cursor?: string | undefined },
): Promise<AdminTradesResponse> {
  const after = cursorFrom(input.cursor);
  const filters: SQL[] = [sql`true`];
  if (input.status !== undefined) filters.push(sql`t.status = ${input.status}`);
  if (after !== null) {
    filters.push(sql`(t.created_at, t.id) < (${new Date(after.at)}, ${after.id}::uuid)`);
  }
  const result = await db.execute<TradeRow>(sql`
    select t.id, t.status, t.created_at, t.expires_at, t.resolved_at,
      pu.id as proposer_id, pu.email as proposer_email, pu.is_anonymous as proposer_guest,
      pp.code as proposer_code,
      ru.id as recipient_id, ru.email as recipient_email, ru.is_anonymous as recipient_guest,
      rp.code as recipient_code,
      array(select ${tradeItems.cardId} from ${tradeItems}
        where ${tradeItems.tradeId} = t.id and ${tradeItems.side} = 'give'
        order by ${tradeItems.cardId}) as give,
      array(select ${tradeItems.cardId} from ${tradeItems}
        where ${tradeItems.tradeId} = t.id and ${tradeItems.side} = 'want'
        order by ${tradeItems.cardId}) as want
    from ${trades} t
    join ${users} pu on pu.id = t.proposer_id
    join ${users} ru on ru.id = t.recipient_id
    left join ${players} pp on pp.user_id = t.proposer_id
    left join ${players} rp on rp.user_id = t.recipient_id
    where ${sql.join(filters, sql` and `)}
    order by t.created_at desc, t.id desc
    limit ${PAGE_SIZE + 1}
  `);
  const rows = result.rows;
  return {
    trades: rows.slice(0, PAGE_SIZE).map(toTrade),
    nextCursor: nextCursor(rows, PAGE_SIZE, (row) => ({ at: iso(row.created_at), id: row.id })),
  };
}

function toTrade(row: TradeRow): AdminTrade {
  return {
    id: row.id,
    status: row.status,
    proposer: {
      id: row.proposer_id,
      email: row.proposer_guest ? null : row.proposer_email,
      playerCode: row.proposer_code,
    },
    recipient: {
      id: row.recipient_id,
      email: row.recipient_guest ? null : row.recipient_email,
      playerCode: row.recipient_code,
    },
    give: row.give ?? [],
    want: row.want ?? [],
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    resolvedAt: row.resolved_at === null ? null : iso(row.resolved_at),
  };
}

/**
 * A card's owners and learners. Scans `user_cards` and `user_mastery` by card, which have no index
 * on it: fine for the back office's rare reads, not for a player route.
 */
export async function readCardStats(db: Database, cardId: string): Promise<AdminCardStats | null> {
  const { rows } = await db.execute<{
    retired: boolean;
    owners: number;
    copies: number;
    learners: number;
    ink: number;
    gilded: number;
  }>(sql`
    select ${cards.retiredAt} is not null as retired,
      (select count(distinct ${userCards.userId})::int from ${userCards}
        where ${userCards.cardId} = ${cards.id} and ${userCards.quantity} > 0) as owners,
      (select coalesce(sum(${userCards.quantity}), 0)::int from ${userCards}
        where ${userCards.cardId} = ${cards.id}) as copies,
      (select count(*)::int from ${userMastery} where ${userMastery.cardId} = ${cards.id}) as learners,
      (select count(*)::int from ${userMastery}
        where ${userMastery.cardId} = ${cards.id} and ${userMastery.level} = 'ink') as ink,
      (select count(*)::int from ${userMastery}
        where ${userMastery.cardId} = ${cards.id} and ${userMastery.level} = 'gilded') as gilded
    from ${cards} where ${cards.id} = ${cardId}`);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    retired: row.retired,
    owners: row.owners,
    copies: row.copies,
    mastery: { learners: row.learners, ink: row.ink, gilded: row.gilded },
  };
}

export async function readCatalog(db: Database): Promise<AdminCatalog> {
  const [collectionRows, rarityRows, collectorRows] = await Promise.all([
    db.execute<{
      id: string;
      name: string;
      published: boolean;
      cards: number;
      retired: number;
    }>(sql`
      select ${collections.id} as id, ${collections.name} as name,
        ${collections.publishedAt} is not null as published,
        count(${cards.id}) filter (where ${cards.retiredAt} is null)::int as cards,
        count(${cards.id}) filter (where ${cards.retiredAt} is not null)::int as retired
      from ${collections} left join ${cards} on ${cards.collectionId} = ${collections.id}
      group by ${collections.id}, ${collections.name}, ${collections.publishedAt}
      order by ${collections.createdAt}, ${collections.id}`),
    db.execute<{ collection_id: string; rarity: Rarity; n: number }>(sql`
      select ${cards.collectionId} as collection_id, ${cards.rarity} as rarity, count(*)::int as n
      from ${cards} where ${cards.retiredAt} is null
      group by ${cards.collectionId}, ${cards.rarity}`),
    db.execute<{ collection_id: string; n: number }>(sql`
      select ${cards.collectionId} as collection_id, count(distinct ${userCards.userId})::int as n
      from ${userCards} join ${cards} on ${cards.id} = ${userCards.cardId}
      where ${userCards.quantity} > 0
      group by ${cards.collectionId}`),
  ]);
  const byCollection = new Map<string, Partial<Record<Rarity, number>>>();
  for (const row of rarityRows.rows) {
    const counts = byCollection.get(row.collection_id) ?? {};
    counts[row.rarity] = row.n;
    byCollection.set(row.collection_id, counts);
  }
  const collectors = new Map(collectorRows.rows.map((row) => [row.collection_id, row.n]));
  return {
    collections: collectionRows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      published: row.published,
      cards: row.cards,
      retired: row.retired,
      byRarity: byCollection.get(row.id) ?? {},
      collectors: collectors.get(row.id) ?? 0,
    })),
  };
}
