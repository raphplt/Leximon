import type {
  DirectoryPlayer,
  PlayerBadge,
  PlayerSort,
  Preferences,
  ProfileClan,
  ProfileRefusal,
  ProfileResponse,
  ProfileStats,
  PublicProfile,
  UpdateProfileRequest,
} from "@leximon/contract";
import {
  CLAN_LEVEL,
  type ClaimedReward,
  checkPseudo,
  clanLevelOf,
  currentTitle,
  defaultAvatar,
  type EpochMs,
  featureLevels,
  LEVEL_REWARD_SCHEDULE,
  type LevelRewardRules,
  levelOf,
  levelRewardRulesAt,
  NEAR_LEVEL_SPREAD,
  nextPseudoChange,
  PSEUDO_SCHEDULE,
  pseudoKey,
  pseudoRulesAt,
  TRADE_SCHEDULE,
  tradeRulesAt,
  UNLOCK_SCHEDULE,
  wardrobe,
  xpToReach,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import {
  type AnyColumn,
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  like,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";
import { breakFriendship, notLocked, readFriendship } from "../friends/friends";
import { readProfileJousts } from "../jousts/leagues";
import { ensurePlayer } from "../trades/players";

const {
  adminActions,
  boosterWallets,
  clanMembers,
  clans,
  guestLinks,
  moderationReports,
  pinnedCards,
  players,
  trades,
  userBlocks,
  userCards,
  userLevelRewards,
  userWelcomeDays,
  userPreferences,
  userProgress,
  users,
  waitlistSignups,
} = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

/** The columns of `players` that make a badge, with the level's XP. */
const badgeFields = {
  userId: players.userId,
  code: players.code,
  pseudo: players.pseudo,
  avatar: players.avatar,
  frame: players.frame,
  xp: userProgress.xp,
};

type BadgeRow = {
  code: string;
  pseudo: string | null;
  avatar: string | null;
  frame: string | null;
  xp: number | null;
};

/** How a player shows to others. What they never chose is the default of the rules in force. */
export function toBadge(row: BadgeRow, now: EpochMs): PlayerBadge {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  return {
    code: row.code,
    pseudo: row.pseudo,
    avatar: row.avatar ?? defaultAvatar(rules, row.code),
    frame: row.frame ?? rules.startingFrame,
    level: levelOf(row.xp ?? 0).level,
  };
}

/** Badges of several players in one query, by user id. */
export async function readBadges(
  db: Reader,
  userIds: readonly string[],
  now: EpochMs,
): Promise<Map<string, PlayerBadge>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select(badgeFields)
    .from(players)
    .leftJoin(userProgress, eq(userProgress.userId, players.userId))
    .where(inArray(players.userId, ids));
  return new Map(rows.map((row) => [row.userId, toBadge(row, now)]));
}

// --- Own profile ---------------------------------------------------------------------------------

/** The player's own profile (`GET /me/profile`), created with their player code on first use. */
export async function readOwnProfile(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<ProfileResponse> {
  const player = await ensurePlayer(db, userId);
  const [row] = await db
    .select({
      ...badgeFields,
      pseudoChangedAt: players.pseudoChangedAt,
      title: players.title,
      profilePublic: players.profilePublic,
      isAnonymous: users.isAnonymous,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .leftJoin(userProgress, eq(userProgress.userId, players.userId))
    .where(eq(players.userId, userId));
  if (row === undefined) throw new Error("Player row missing right after its creation");

  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const claimed = await readClaims(db, userId);
  const worn = wardrobe(rules, claimed);
  const pinned = await db
    .select({ cardId: pinnedCards.cardId })
    .from(pinnedCards)
    .where(eq(pinnedCards.userId, userId))
    .orderBy(asc(pinnedCards.position));
  const badge = toBadge(row, now);
  const changeAt = nextPseudoChange(
    pseudoRulesAt(PSEUDO_SCHEDULE, now),
    row.pseudoChangedAt?.getTime() ?? null,
  );
  const { minLevel } = tradeRulesAt(TRADE_SCHEDULE, now);
  return {
    playerCode: player.code,
    tradeMinLevel: minLevel,
    member: !row.isAnonymous,
    pseudo: row.pseudo,
    pseudoChangeableFrom:
      changeAt === null || changeAt <= now ? null : new Date(changeAt).toISOString(),
    avatar: worn.avatars.has(badge.avatar) ? badge.avatar : defaultAvatar(rules, player.code),
    frame: worn.frames.has(badge.frame) ? badge.frame : rules.startingFrame,
    title: wornTitle(rules, row.title, claimed, worn.titles),
    titleChosen: row.title !== null && worn.titles.has(row.title),
    profilePublic: row.profilePublic,
    publicFromLevel: publicLevel(now),
    level: badge.level,
    memberSince: new Date(player.createdAt).toISOString(),
    clan: await readProfileClan(db, userId),
    pinned: pinned.map((pin) => pin.cardId),
    pinnedSlots: worn.pinnedSlots,
    wardrobe: {
      avatars: [...worn.avatars],
      frames: [...worn.frames],
      titles: [...worn.titles],
    },
    stats: await readStats(db, userId),
    jousts: await readProfileJousts(db, userId, now),
  };
}

function publicLevel(now: EpochMs): number {
  return featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, now).public_profile;
}

/** The coffrets claimed, then the days of the welcome week, which carry no level. */
async function readClaims(db: Reader, userId: string): Promise<ClaimedReward[]> {
  const levels = await db
    .select({ level: userLevelRewards.level, rewards: userLevelRewards.rewards })
    .from(userLevelRewards)
    .where(eq(userLevelRewards.userId, userId));
  const days = await db
    .select({ rewards: userWelcomeDays.rewards })
    .from(userWelcomeDays)
    .where(eq(userWelcomeDays.userId, userId));
  return [...levels, ...days];
}

/** The chosen title while the player still holds it, else the latest one won. */
function wornTitle(
  rules: LevelRewardRules,
  chosen: string | null,
  claimed: readonly ClaimedReward[],
  titles: ReadonlySet<string>,
): string | null {
  if (chosen !== null && titles.has(chosen)) return chosen;
  const levels = claimed.flatMap((claim) => (claim.level === undefined ? [] : [claim.level]));
  return currentTitle(rules, levels) ?? welcomeTitle(claimed);
}

/** The title of the welcome week, worn until a level gives one. */
function welcomeTitle(claimed: readonly ClaimedReward[]): string | null {
  for (const claim of claimed) {
    if (claim.level !== undefined) continue;
    for (const reward of claim.rewards) if (reward.kind === "title") return reward.title;
  }
  return null;
}

/**
 * The profile in figures, in one statement of counts. Not a critical path: the public page
 * is cached a minute by the CDN.
 */
async function readStats(db: Reader, userId: string): Promise<ProfileStats> {
  const [row] = await db
    .select({
      words: sql<number>`(select count(distinct ${userCards.cardId})::int from ${userCards}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0)`,
      legendaries: sql<number>`(select count(distinct uc.card_id)::int from user_cards uc
        join cards k on k.id = uc.card_id
        where uc.user_id = ${userId} and uc.quantity > 0 and k.rarity = 'legendary')`,
      gilded: sql<number>`(select count(*)::int from user_mastery
        where user_id = ${userId} and level = 'gilded')`,
      tradesCompleted: sql<number>`(select count(*)::int from ${trades}
        where (${trades.proposerId} = ${userId} or ${trades.recipientId} = ${userId})
        and ${trades.status} = 'completed')`,
      completeCollections: sql<number>`(select count(*)::int from collections c
        where c.published_at is not null and not exists (
          select 1 from cards k where k.collection_id = c.id and k.retired_at is null
          and not exists (select 1 from user_cards uc
            where uc.user_id = ${userId} and uc.card_id = k.id and uc.quantity > 0)))`,
      daysPlayed: sql<number>`coalesce((select ${boosterWallets.daysPlayed} from ${boosterWallets}
        where ${boosterWallets.userId} = ${userId}), 0)`,
    })
    .from(sql`(select 1) as one`);
  if (row === undefined) throw new Error("Stats query returned no row");
  return row;
}

// --- Editing the profile -------------------------------------------------------------------------

export type ProfileWriteResult = { readonly kind: "ok" } | { readonly kind: ProfileRefusal };

/**
 * `PATCH /me/profile`. A read-modify-write of the player's row (the pseudo's monthly change), so
 * the row is locked. Cosmetics are checked against the coffrets claimed: the server decides what
 * a player may wear. The pseudo's uniqueness rests on the unique index.
 */
export async function updateProfile(
  db: Database,
  input: { readonly userId: string; readonly changes: UpdateProfileRequest; readonly now: EpochMs },
): Promise<ProfileWriteResult> {
  const { userId, changes, now } = input;
  await ensurePlayer(db, userId);
  try {
    return await db.transaction(async (tx): Promise<ProfileWriteResult> => {
      const current = await lockMember(tx, userId);
      if (current === null) return { kind: "account_required" };

      const update: Partial<typeof players.$inferInsert> = {};
      if (changes.profilePublic !== undefined) update.profilePublic = changes.profilePublic;
      if (changes.pseudo !== undefined) {
        const rules = pseudoRulesAt(PSEUDO_SCHEDULE, now);
        const checked = checkPseudo(rules, changes.pseudo);
        if (!checked.ok) {
          return {
            kind:
              checked.reason === "invalid_characters"
                ? "pseudo_invalid"
                : `pseudo_${checked.reason}`,
          };
        }
        if (checked.pseudo !== current.pseudo) {
          const next = nextPseudoChange(rules, current.pseudoChangedAt?.getTime() ?? null);
          if (next !== null && next > now) return { kind: "pseudo_too_soon" };
          update.pseudo = checked.pseudo;
          update.pseudoKey = checked.key;
          update.pseudoChangedAt = new Date(now);
        }
      }
      if (changes.avatar !== undefined || changes.frame !== undefined || changes.title) {
        const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
        const worn = wardrobe(rules, await readClaims(tx, userId));
        if (changes.avatar !== undefined && !worn.avatars.has(changes.avatar)) {
          return { kind: "cosmetic_locked" };
        }
        if (changes.frame !== undefined && !worn.frames.has(changes.frame)) {
          return { kind: "cosmetic_locked" };
        }
        if (changes.title != null && !worn.titles.has(changes.title)) {
          return { kind: "cosmetic_locked" };
        }
      }
      if (changes.avatar !== undefined) update.avatar = changes.avatar;
      if (changes.frame !== undefined) update.frame = changes.frame;
      if (changes.title !== undefined) update.title = changes.title;

      if (Object.keys(update).length > 0) {
        await tx.update(players).set(update).where(eq(players.userId, userId));
      }
      return { kind: "ok" };
    });
  } catch (error) {
    if (isUniqueViolation(error, "players_pseudo_key_idx")) return { kind: "pseudo_taken" };
    throw error;
  }
}

/** Locks the player's row; `null` for a guest, who has no profile. */
async function lockMember(tx: Transaction, userId: string) {
  const [row] = await tx
    .select({
      pseudo: players.pseudo,
      pseudoChangedAt: players.pseudoChangedAt,
      isAnonymous: users.isAnonymous,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(eq(players.userId, userId))
    .for("update", { of: players });
  if (row === undefined) throw new Error("Player row missing right after its creation");
  return row.isAnonymous ? null : row;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  // Drizzle wraps the driver's error; the Postgres fields are on the cause.
  for (let current = error; current instanceof Error; current = current.cause) {
    const fields = current as Error & { code?: unknown; constraint?: unknown };
    if (fields.code === "23505" && fields.constraint === constraint) return true;
  }
  return false;
}

/**
 * `PUT /me/pinned-cards`: replaces the pinned cards, in order. Owned cards only, within the slots
 * the coffrets gave. The player's row is locked so that two concurrent writes do not mix.
 */
export async function setPinnedCards(
  db: Database,
  input: { readonly userId: string; readonly cardIds: readonly string[]; readonly now: EpochMs },
): Promise<ProfileWriteResult> {
  const { userId, cardIds, now } = input;
  if (new Set(cardIds).size !== cardIds.length) return { kind: "duplicate_card" };
  await ensurePlayer(db, userId);
  return db.transaction(async (tx): Promise<ProfileWriteResult> => {
    if ((await lockMember(tx, userId)) === null) return { kind: "account_required" };
    const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
    const slots = wardrobe(rules, await readClaims(tx, userId)).pinnedSlots;
    if (cardIds.length > slots) return { kind: "too_many_pins" };
    if (cardIds.length > 0) {
      const owned = await tx
        .selectDistinct({ cardId: userCards.cardId })
        .from(userCards)
        .where(
          and(
            eq(userCards.userId, userId),
            inArray(userCards.cardId, [...cardIds]),
            gt(userCards.quantity, 0),
          ),
        );
      if (owned.length !== cardIds.length) return { kind: "card_not_owned" };
    }
    await tx.delete(pinnedCards).where(eq(pinnedCards.userId, userId));
    if (cardIds.length > 0) {
      await tx
        .insert(pinnedCards)
        .values(cardIds.map((cardId, position) => ({ userId, cardId, position })));
    }
    return { kind: "ok" };
  });
}

// --- Public profile ------------------------------------------------------------------------------

export type PublicProfileResult =
  | { readonly kind: "found"; readonly profile: PublicProfile }
  | { readonly kind: "not_found" };

/**
 * `GET /players/:pseudo`. Only members past the public level have a page; a
 * private profile shows its pseudo and avatar alone. A player blocked either way by the viewer
 * does not exist for them.
 */
export async function readPublicProfile(
  db: Database,
  input: { readonly pseudo: string; readonly viewerId: string | null; readonly now: EpochMs },
): Promise<PublicProfileResult> {
  const { viewerId, now } = input;
  const key = pseudoKey(input.pseudo.normalize("NFC").trim());
  if (key.length === 0) return { kind: "not_found" };
  const [row] = await db
    .select({
      ...badgeFields,
      title: players.title,
      profilePublic: players.profilePublic,
      createdAt: users.createdAt,
      isAnonymous: users.isAnonymous,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .leftJoin(userProgress, eq(userProgress.userId, players.userId))
    .where(eq(players.pseudoKey, key));
  if (row === undefined || row.pseudo === null || row.isAnonymous) return { kind: "not_found" };
  const badge = toBadge(row, now);
  const friendship =
    viewerId === null || viewerId === row.userId
      ? undefined
      : await readFriendship(db, viewerId, row.userId, now);
  // Friends see each other whole: below the public level, and when the profile is private.
  const friends = friendship === "friends";
  if (!friends && badge.level < publicLevel(now)) return { kind: "not_found" };
  if (viewerId !== null && (await isBlockedEitherWay(db, viewerId, row.userId))) {
    return { kind: "not_found" };
  }
  if (!friends && !row.profilePublic) {
    return {
      kind: "found",
      profile: {
        visibility: "private",
        pseudo: row.pseudo,
        avatar: badge.avatar,
        frame: badge.frame,
        ...(friendship === undefined ? {} : { friendship }),
      },
    };
  }

  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const claimed = await readClaims(db, row.userId);
  const worn = wardrobe(rules, claimed);
  const pinned = await db
    .select({ cardId: pinnedCards.cardId })
    .from(pinnedCards)
    .where(eq(pinnedCards.userId, row.userId))
    .orderBy(asc(pinnedCards.position));
  return {
    kind: "found",
    profile: {
      visibility: "public",
      pseudo: row.pseudo,
      code: row.code,
      avatar: worn.avatars.has(badge.avatar) ? badge.avatar : defaultAvatar(rules, row.code),
      frame: worn.frames.has(badge.frame) ? badge.frame : rules.startingFrame,
      title: wornTitle(rules, row.title, claimed, worn.titles),
      level: badge.level,
      memberSince: row.createdAt.toISOString(),
      clan: await readProfileClan(db, row.userId),
      pinned: pinned.map((pin) => pin.cardId),
      stats: await readStats(db, row.userId),
      jousts: await readProfileJousts(db, row.userId, now),
      ...(friendship === undefined ? {} : { friendship }),
    },
  };
}

/** The clans of several players in one query, by user id; players without a clan are missing. */
export async function readProfileClans(
  db: Reader,
  userIds: readonly string[],
): Promise<Map<string, ProfileClan>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: clanMembers.userId,
      id: clans.id,
      name: clans.name,
      engraving: clans.emblemEngraving,
      color: clans.emblemColor,
      accent: clans.emblemAccent,
      xp: clans.xp,
    })
    .from(clanMembers)
    .innerJoin(clans, eq(clans.id, clanMembers.clanId))
    .where(inArray(clanMembers.userId, [...new Set(userIds)]));
  return new Map(
    rows.map((row) => [
      row.userId,
      {
        id: row.id,
        name: row.name,
        emblem: { engraving: row.engraving, colors: [row.color, row.accent] },
        level: clanLevelOf(CLAN_LEVEL, row.xp).level,
      },
    ]),
  );
}

/** The clan a public profile shows, or `null` without one. */
async function readProfileClan(db: Reader, userId: string): Promise<ProfileClan | null> {
  return (await readProfileClans(db, [userId])).get(userId) ?? null;
}

// --- The list of players -------------------------------------------------------------------------

export interface PlayerListCursor {
  /** Last seen, or arrival for the `new` sort. */
  readonly at: number;
  readonly code: string;
}

/** Cards a row of the list shows. */
const PINNED_IN_LIST = 3;

/** The levels of `near`, as XP: from the public level on, as nobody below it is listed. */
async function nearLevelCondition(
  db: Reader,
  viewerId: string,
  lowest: number,
): Promise<SQL | undefined> {
  const [viewer] = await db
    .select({ xp: userProgress.xp })
    .from(userProgress)
    .where(eq(userProgress.userId, viewerId));
  const { level } = levelOf(viewer?.xp ?? 0);
  return and(
    gte(userProgress.xp, xpToReach(Math.max(lowest, level - NEAR_LEVEL_SPREAD))),
    lt(userProgress.xp, xpToReach(level + NEAR_LEVEL_SPREAD + 1)),
  );
}

async function readPinnedInList(
  db: Reader,
  userIds: readonly string[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  const pinnedOf = new Map<string, string[]>();
  if (userIds.length === 0) return pinnedOf;
  const rows = await db
    .select({ userId: pinnedCards.userId, cardId: pinnedCards.cardId })
    .from(pinnedCards)
    .where(and(inArray(pinnedCards.userId, [...userIds]), lt(pinnedCards.position, PINNED_IN_LIST)))
    .orderBy(asc(pinnedCards.position));
  for (const row of rows) {
    const cards = pinnedOf.get(row.userId);
    if (cards === undefined) pinnedOf.set(row.userId, [row.cardId]);
    else cards.push(row.cardId);
  }
  return pinnedOf;
}

/**
 * `GET /players`: the public profiles, by pseudo prefix. No sort follows the level: it would be a
 * ranking. The list moves while it is read, so a client may meet a player twice. Seen once at
 * least: every screen of the game records it.
 */
export async function listPublicPlayers(
  db: Reader,
  input: {
    readonly viewerId: string;
    readonly q: string | undefined;
    readonly sort: PlayerSort;
    readonly clanless: boolean;
    readonly after: PlayerListCursor | null;
    readonly limit: number;
    readonly now: EpochMs;
  },
): Promise<{ readonly players: DirectoryPlayer[]; readonly last: PlayerListCursor | null }> {
  const { viewerId, q, sort, clanless, after, limit, now } = input;
  const prefix = q === undefined ? "" : pseudoKey(q.normalize("NFC").trim());
  const lowest = publicLevel(now);
  const near = sort === "near" ? await nearLevelCondition(db, viewerId, lowest) : undefined;
  const order = sort === "new" ? players.createdAt : players.lastSeenAt;
  const rows = await db
    .select({ ...badgeFields, at: order })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .innerJoin(userProgress, eq(userProgress.userId, players.userId))
    .where(
      and(
        sql`${players.profilePublic}`,
        isNotNull(players.pseudoKey),
        isNotNull(players.lastSeenAt),
        sql`${users.isAnonymous} is not true`,
        gte(userProgress.xp, xpToReach(lowest)),
        near,
        clanless
          ? sql`not exists (select 1 from ${clanMembers} m where m.user_id = ${players.userId})`
          : undefined,
        ne(players.userId, viewerId),
        prefix === "" ? undefined : like(players.pseudoKey, `${prefix.replaceAll(/[\\%_]/g, "")}%`),
        after === null
          ? undefined
          : sql`(${order}, ${players.code}) < (${new Date(after.at)}, ${after.code})`,
        notBlockedEitherWay(viewerId, players.userId),
        notLocked(players.userId, now),
      ),
    )
    .orderBy(desc(order), desc(players.code))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const userIds = page.map((row) => row.userId);
  const [clansOf, pinnedOf] = await Promise.all([
    readProfileClans(db, userIds),
    readPinnedInList(db, userIds),
  ]);
  const last = page.at(-1);
  return {
    players: page.map((row) => ({
      player: toBadge(row, now),
      clan: clansOf.get(row.userId) ?? null,
      pinned: [...(pinnedOf.get(row.userId) ?? [])],
    })),
    last:
      rows.length > limit && last?.at != null ? { at: last.at.getTime(), code: last.code } : null,
  };
}

// --- Blocks and reports ---------------------------------------------------------------------

/** For a list seen by `viewerId`: leaves out the players blocked either way. */
export function notBlockedEitherWay(viewerId: string, userId: AnyColumn | SQL): SQL {
  return sql`not exists (select 1 from ${userBlocks} b
    where (b.blocker_id = ${viewerId} and b.blocked_id = ${userId})
      or (b.blocker_id = ${userId} and b.blocked_id = ${viewerId}))`;
}

export async function isBlockedEitherWay(db: Reader, a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type BlockResult =
  | { readonly kind: "ok" }
  | { readonly kind: "account_required" | "player_not_found" | "self" };

/** Finds a player by code and checks that the requester, a member, may act on them. */
async function memberAndTarget(
  db: Database,
  userId: string,
  target: { readonly code: string } | { readonly pseudo: string },
): Promise<
  | { readonly kind: "found"; readonly targetId: string; readonly pseudo: string | null }
  | Exclude<BlockResult, { kind: "ok" }>
> {
  const [me] = await db
    .select({ isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.id, userId));
  if (me === undefined || me.isAnonymous) return { kind: "account_required" };
  const [row] = await db
    .select({ userId: players.userId, pseudo: players.pseudo })
    .from(players)
    .where(
      "code" in target
        ? eq(players.code, target.code)
        : eq(players.pseudoKey, pseudoKey(target.pseudo.normalize("NFC").trim())),
    );
  if (row === undefined) return { kind: "player_not_found" };
  if (row.userId === userId) return { kind: "self" };
  return { kind: "found", targetId: row.userId, pseudo: row.pseudo };
}

/**
 * `PUT /me/blocks/:code`. Pending offers between the two players are cancelled in the same
 * transaction: neither can reach the other any more. Blocking twice changes nothing.
 */
export async function blockPlayer(
  db: Database,
  input: { readonly userId: string; readonly code: string; readonly now: EpochMs },
): Promise<BlockResult> {
  const { userId, now } = input;
  const target = await memberAndTarget(db, userId, { code: input.code });
  if (target.kind !== "found") return target;
  const at = new Date(now);
  await db.transaction(async (tx) => {
    await tx
      .insert(userBlocks)
      .values({ blockerId: userId, blockedId: target.targetId, createdAt: at })
      .onConflictDoNothing();
    await breakFriendship(tx, userId, target.targetId);
    await tx
      .update(trades)
      .set({ status: "cancelled", resolvedAt: at })
      .where(
        and(
          eq(trades.status, "pending"),
          gt(trades.expiresAt, at),
          or(
            and(eq(trades.proposerId, userId), eq(trades.recipientId, target.targetId)),
            and(eq(trades.proposerId, target.targetId), eq(trades.recipientId, userId)),
          ),
        ),
      );
  });
  return { kind: "ok" };
}

/** `DELETE /me/blocks/:code`. Unblocking someone not blocked changes nothing. */
export async function unblockPlayer(
  db: Database,
  input: { readonly userId: string; readonly code: string },
): Promise<BlockResult> {
  const [row] = await db
    .select({ userId: players.userId })
    .from(players)
    .where(eq(players.code, input.code));
  if (row === undefined) return { kind: "player_not_found" };
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, input.userId), eq(userBlocks.blockedId, row.userId)));
  return { kind: "ok" };
}

/** `GET /me/blocks`: the players blocked, latest first. */
export async function listBlocks(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<PlayerBadge[]> {
  const rows = await db
    .select(badgeFields)
    .from(userBlocks)
    .innerJoin(players, eq(players.userId, userBlocks.blockedId))
    .leftJoin(userProgress, eq(userProgress.userId, players.userId))
    .where(eq(userBlocks.blockerId, userId))
    .orderBy(desc(userBlocks.createdAt));
  return rows.map((row) => toBadge(row, now));
}

/**
 * `POST /players/:pseudo/report`: a report of the pseudo as it reads now, kept for the back
 * office. Reporting the same pseudo twice adds nothing.
 */
export async function reportPlayer(
  db: Database,
  input: { readonly userId: string; readonly pseudo: string; readonly now: EpochMs },
): Promise<BlockResult> {
  const target = await memberAndTarget(db, input.userId, { pseudo: input.pseudo });
  if (target.kind !== "found") return target;
  if (target.pseudo === null) return { kind: "player_not_found" };
  await db
    .insert(moderationReports)
    .values({
      id: crypto.randomUUID(),
      reporterId: input.userId,
      reportedId: target.targetId,
      pseudo: target.pseudo,
      targetKind: "pseudo",
      targetKey: target.pseudo,
      createdAt: new Date(input.now),
    })
    .onConflictDoNothing();
  return { kind: "ok" };
}

// --- Preferences --------------------------------------------------------------------------

const DEFAULT_PREFERENCES: Preferences = {
  notifyReviews: true,
  notifyTrades: true,
  notifyClanMentions: true,
  notifyJousts: true,
  friendRequestsOpen: true,
  shareFinds: true,
  emailNews: true,
  emailReminders: true,
  reviewLength: 10,
  newWordsPerDay: 10,
  reviewListen: true,
  reviewPairs: true,
  reviewDifficulty: "normal",
};

export async function readPreferences(db: Reader, userId: string): Promise<Preferences> {
  const [row] = await db
    .select({
      notifyReviews: userPreferences.notifyReviews,
      notifyTrades: userPreferences.notifyTrades,
      notifyClanMentions: userPreferences.notifyClanMentions,
      notifyJousts: userPreferences.notifyJousts,
      friendRequestsOpen: userPreferences.friendRequestsOpen,
      shareFinds: userPreferences.shareFinds,
      emailNews: userPreferences.emailNews,
      emailReminders: userPreferences.emailReminders,
      reviewLength: userPreferences.reviewLength,
      newWordsPerDay: userPreferences.newWordsPerDay,
      reviewListen: userPreferences.reviewListen,
      reviewPairs: userPreferences.reviewPairs,
      reviewDifficulty: userPreferences.reviewDifficulty,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row ?? DEFAULT_PREFERENCES;
}

/** Writes only the preferences sent: one upsert, nothing to lock. */
export async function updatePreferences(
  db: Database,
  userId: string,
  sent: { readonly [K in keyof Preferences]?: Preferences[K] | undefined },
): Promise<Preferences> {
  const changes = Object.fromEntries(
    Object.entries(sent).filter(([, value]) => value !== undefined),
  ) as Partial<Preferences>;
  const [row] = await db
    .insert(userPreferences)
    .values({ userId, ...DEFAULT_PREFERENCES, ...changes })
    .onConflictDoUpdate({ target: userPreferences.userId, set: changes })
    .returning({
      notifyReviews: userPreferences.notifyReviews,
      notifyTrades: userPreferences.notifyTrades,
      notifyClanMentions: userPreferences.notifyClanMentions,
      notifyJousts: userPreferences.notifyJousts,
      friendRequestsOpen: userPreferences.friendRequestsOpen,
      shareFinds: userPreferences.shareFinds,
      emailNews: userPreferences.emailNews,
      emailReminders: userPreferences.emailReminders,
      reviewLength: userPreferences.reviewLength,
      newWordsPerDay: userPreferences.newWordsPerDay,
      reviewListen: userPreferences.reviewListen,
      reviewPairs: userPreferences.reviewPairs,
      reviewDifficulty: userPreferences.reviewDifficulty,
    });
  if (row === undefined) throw new Error("Preferences upsert returned no row");
  return row;
}

// --- Deleting the account -----------------------------------------------------------------

export type DeleteAccountResult = { readonly kind: "deleted" } | { readonly kind: "admin_account" };

/**
 * Erases the player at once, in one transaction: the account, its sign-in methods and sessions,
 * the game (cards, mastery, profile, history of opens) by the cascades, and the guests it was
 * signed in from. Trades stay with the other player, whose history shows a departed player (the
 * foreign keys set the side to `null`); pending offers are cancelled first. An admin, or a former
 * admin whose actions are in the audit log, is refused: the log is never erased.
 */
export async function deleteAccount(
  db: Database,
  input: { readonly userId: string; readonly now: EpochMs },
): Promise<DeleteAccountResult> {
  const { userId, now } = input;
  return db.transaction(async (tx): Promise<DeleteAccountResult> => {
    const [me] = await tx
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (me === undefined) return { kind: "deleted" };
    const [audited] = await tx
      .select({ id: adminActions.id })
      .from(adminActions)
      .where(eq(adminActions.adminId, userId))
      .limit(1);
    if (me.role === ADMIN_ROLE || audited !== undefined) return { kind: "admin_account" };

    const guests = await tx
      .select({ guestId: guestLinks.guestId })
      .from(guestLinks)
      .where(eq(guestLinks.accountId, userId));
    const erased = [userId, ...guests.map((guest) => guest.guestId)];
    const at = new Date(now);
    await tx
      .update(trades)
      .set({ status: "cancelled", resolvedAt: at })
      .where(
        and(
          eq(trades.status, "pending"),
          or(inArray(trades.proposerId, erased), inArray(trades.recipientId, erased)),
        ),
      );
    await tx.delete(users).where(inArray(users.id, erased));
    // "Tout part": the waitlist address too, the one place the account's address lives on.
    await tx.delete(waitlistSignups).where(eq(waitlistSignups.email, me.email.toLowerCase()));
    return { kind: "deleted" };
  });
}
