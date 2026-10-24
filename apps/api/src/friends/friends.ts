import type {
  Friend,
  FriendRefusal,
  FriendRequest,
  Friendship,
  FriendsResponse,
  PlayerBadge,
} from "@leximon/contract";
import {
  betaPlacesLeft,
  checkFriendRequest,
  checkFriendship,
  type EpochMs,
  FRIEND_SCHEDULE,
  type FriendRules,
  friendRulesAt,
  isRequestPending,
  pseudoKey,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { type AnyColumn, and, desc, eq, gt, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { ONLINE_WINDOW_MS } from "../clans/clans";
import { readBadges, readProfileClans } from "../profile/profile";
import { purgeRows } from "../purge";
import { ensurePlayer } from "../trades/players";
import { lastWeekCrowns } from "./podium";
import { possibleTradeCounts } from "./suggestions";

const { friendRequests, friendships, players, userPreferences, users } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

function rulesAt(now: EpochMs): FriendRules {
  return friendRulesAt(FRIEND_SCHEDULE, now);
}

/** A player another one may be friends with: a member with a pseudo. */
interface Member {
  readonly userId: string;
  readonly code: string;
  readonly pseudo: string;
}

export type Refused = { readonly kind: "refused"; readonly reason: FriendRefusal };
const refuse = (reason: FriendRefusal): Refused => ({ kind: "refused", reason });

/** The requester, who must be a member with a pseudo to have friends. */
async function readSelf(db: Database, userId: string): Promise<Member | Refused> {
  const [row] = await db
    .select({ isAnonymous: users.isAnonymous })
    .from(users)
    .where(eq(users.id, userId));
  if (row === undefined || row.isAnonymous) return refuse("account_required");
  const player = await ensurePlayer(db, userId);
  const [own] = await db
    .select({ pseudo: players.pseudo })
    .from(players)
    .where(eq(players.userId, userId));
  if (own?.pseudo == null) return refuse("pseudo_required");
  return { userId, code: player.code, pseudo: own.pseudo };
}

/**
 * The other player, by code or by a pseudo typed whole. A guest, a member without a pseudo, and a
 * player blocked either way do not exist here.
 */
async function readOther(
  db: Database,
  selfId: string,
  target: { readonly code: string } | { readonly pseudo: string },
): Promise<Member | Refused> {
  const key = "pseudo" in target ? pseudoKey(target.pseudo.normalize("NFC").trim()) : null;
  if (key !== null && key.length === 0) return refuse("player_not_found");
  const [row] = await db
    .select({ userId: players.userId, code: players.code, pseudo: players.pseudo })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(
      and(
        key === null
          ? eq(players.code, (target as { readonly code: string }).code)
          : eq(players.pseudoKey, key),
        eq(users.isAnonymous, false),
        sql`not exists (select 1 from user_blocks b
          where (b.blocker_id = ${selfId} and b.blocked_id = ${players.userId})
             or (b.blocker_id = ${players.userId} and b.blocked_id = ${selfId}))`,
      ),
    );
  if (row === undefined || row.pseudo === null) return refuse("player_not_found");
  if (row.userId === selfId) return refuse("self");
  return { userId: row.userId, code: row.code, pseudo: row.pseudo };
}

/**
 * Locks both players' rows, always in the order of their ids: two requests crossing, or two
 * acceptances racing for the last place under the cap, wait for each other instead of
 * deadlocking.
 */
async function lockPair(tx: Transaction, a: string, b: string): Promise<void> {
  await tx
    .select({ userId: players.userId })
    .from(players)
    .where(inArray(players.userId, [a, b]))
    .orderBy(players.userId)
    .for("update");
}

async function countFriends(tx: Reader, userId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(eq(friendships.userId, userId));
  return row?.count ?? 0;
}

async function areFriends(tx: Reader, a: string, b: string): Promise<boolean> {
  const rows = await tx
    .select({ userId: friendships.userId })
    .from(friendships)
    .where(and(eq(friendships.userId, a), eq(friendships.friendId, b)))
    .limit(1);
  return rows.length > 0;
}

/** Both rows of a friendship, and no request left between the two players. */
export async function makeFriends(
  tx: Transaction,
  a: string,
  b: string,
  now: EpochMs,
): Promise<void> {
  const at = new Date(now);
  await tx
    .insert(friendships)
    .values([
      { userId: a, friendId: b, createdAt: at },
      { userId: b, friendId: a, createdAt: at },
    ])
    .onConflictDoNothing();
  await deleteRequestsBetween(tx, a, b);
}

async function deleteRequestsBetween(tx: Transaction, a: string, b: string): Promise<void> {
  await tx
    .delete(friendRequests)
    .where(
      or(
        and(eq(friendRequests.senderId, a), eq(friendRequests.recipientId, b)),
        and(eq(friendRequests.senderId, b), eq(friendRequests.recipientId, a)),
      ),
    );
}

/** Undoes a friendship and every request between two players: blocking, or removing a friend. */
export async function breakFriendship(tx: Transaction, a: string, b: string): Promise<void> {
  await tx
    .delete(friendships)
    .where(
      or(
        and(eq(friendships.userId, a), eq(friendships.friendId, b)),
        and(eq(friendships.userId, b), eq(friendships.friendId, a)),
      ),
    );
  await deleteRequestsBetween(tx, a, b);
}

/** Where `viewerId` stands with `otherId`: friends, a request either way, or nothing. */
export async function readFriendship(
  db: Reader,
  viewerId: string,
  otherId: string,
  now: EpochMs,
): Promise<Friendship> {
  if (await areFriends(db, viewerId, otherId)) return "friends";
  const rows = await db
    .select({
      senderId: friendRequests.senderId,
      createdAt: friendRequests.createdAt,
      declinedAt: friendRequests.declinedAt,
    })
    .from(friendRequests)
    .where(
      or(
        and(eq(friendRequests.senderId, viewerId), eq(friendRequests.recipientId, otherId)),
        and(eq(friendRequests.senderId, otherId), eq(friendRequests.recipientId, viewerId)),
      ),
    );
  const rules = rulesAt(now);
  for (const row of rows) {
    const request = {
      createdAt: row.createdAt.getTime(),
      declinedAt: row.declinedAt?.getTime() ?? null,
    };
    if (row.senderId === viewerId) {
      // A refusal is never told: the sender still sees their request waiting until it expires.
      if (now < request.createdAt + rules.requestTtlMs) return "requested";
    } else if (isRequestPending(rules, request, now)) {
      return "incoming";
    }
  }
  return "none";
}

// --- Requests ------------------------------------------------------------------------------------

export type SendRequestResult =
  | { readonly kind: "sent" | "accepted"; readonly player: PlayerBadge; readonly otherId: string }
  | Refused;

/**
 * `POST /me/friend-requests`. When the other player had asked first, the request accepts theirs.
 * Sending the same request twice is refused as `already_requested`, which the client reads as
 * done.
 */
export async function sendFriendRequest(
  db: Database,
  input: {
    readonly userId: string;
    readonly target: { readonly code: string } | { readonly pseudo: string };
    readonly now: EpochMs;
  },
): Promise<SendRequestResult> {
  const { userId, now } = input;
  const self = await readSelf(db, userId);
  if ("kind" in self) return self;
  const other = await readOther(db, userId, input.target);
  if ("kind" in other) return other;
  const rules = rulesAt(now);
  const at = new Date(now);

  const outcome = await db.transaction(async (tx): Promise<"sent" | "accepted" | Refused> => {
    await lockPair(tx, userId, other.userId);
    const requests = await tx
      .select({
        senderId: friendRequests.senderId,
        createdAt: friendRequests.createdAt,
        declinedAt: friendRequests.declinedAt,
      })
      .from(friendRequests)
      .where(
        or(
          and(eq(friendRequests.senderId, userId), eq(friendRequests.recipientId, other.userId)),
          and(eq(friendRequests.senderId, other.userId), eq(friendRequests.recipientId, userId)),
        ),
      );
    const toRequest = (row: (typeof requests)[number]) => ({
      createdAt: row.createdAt.getTime(),
      declinedAt: row.declinedAt?.getTime() ?? null,
    });
    const mine = requests.find((row) => row.senderId === userId);
    const theirs = requests.find((row) => row.senderId === other.userId);
    const [selfFriends, otherFriends] = [
      await countFriends(tx, userId),
      await countFriends(tx, other.userId),
    ];

    if (theirs !== undefined && isRequestPending(rules, toRequest(theirs), now)) {
      const full = checkFriendship(rules, selfFriends, otherFriends);
      if (full !== null) return refuse(full);
      await makeFriends(tx, userId, other.userId, now);
      return "accepted";
    }

    const [sent] = await tx
      .select({
        lastDay: sql<number>`count(*) filter (where ${friendRequests.createdAt} > ${new Date(now - 86_400_000)})::int`,
        pending: sql<number>`count(*) filter (where ${friendRequests.declinedAt} is null and ${friendRequests.createdAt} > ${new Date(now - rules.requestTtlMs)})::int`,
      })
      .from(friendRequests)
      .where(eq(friendRequests.senderId, userId));
    const [preferences] = await tx
      .select({ open: userPreferences.friendRequestsOpen })
      .from(userPreferences)
      .where(eq(userPreferences.userId, other.userId));
    const refusal = checkFriendRequest(
      rules,
      {
        self: false,
        alreadyFriends: await areFriends(tx, userId, other.userId),
        alreadyRequested: mine !== undefined && isRequestPending(rules, toRequest(mine), now),
        recipientAcceptsRequests: preferences?.open ?? true,
        declinedAt: mine?.declinedAt?.getTime() ?? null,
        sentLastDay: sent?.lastDay ?? 0,
        pendingSent: sent?.pending ?? 0,
        senderFriends: selfFriends,
        recipientFriends: otherFriends,
      },
      now,
    );
    if (refusal !== null) return refuse(refusal);
    await tx
      .insert(friendRequests)
      .values({ senderId: userId, recipientId: other.userId, createdAt: at })
      .onConflictDoUpdate({
        target: [friendRequests.senderId, friendRequests.recipientId],
        set: { createdAt: at, declinedAt: null },
      });
    return "sent";
  });
  if (typeof outcome !== "string") return outcome;
  const badges = await readBadges(db, [other.userId], now);
  const player = badges.get(other.userId);
  if (player === undefined) throw new Error("Badge missing for a player just found");
  return { kind: outcome, player, otherId: other.userId };
}

export type AnswerResult =
  | { readonly kind: "ok"; readonly player: PlayerBadge; readonly otherId: string }
  | Refused;

/**
 * `POST /me/friend-requests/:code/accept`. Accepting twice answers the same: the friendship is
 * there.
 */
export async function acceptFriendRequest(
  db: Database,
  input: { readonly userId: string; readonly code: string; readonly now: EpochMs },
): Promise<AnswerResult> {
  const { userId, now } = input;
  const self = await readSelf(db, userId);
  if ("kind" in self) return self;
  const other = await readOther(db, userId, { code: input.code });
  if ("kind" in other) return other;
  const rules = rulesAt(now);

  const outcome = await db.transaction(async (tx): Promise<"ok" | Refused> => {
    await lockPair(tx, userId, other.userId);
    if (await areFriends(tx, userId, other.userId)) return "ok";
    const [request] = await tx
      .select({ createdAt: friendRequests.createdAt, declinedAt: friendRequests.declinedAt })
      .from(friendRequests)
      .where(
        and(eq(friendRequests.senderId, other.userId), eq(friendRequests.recipientId, userId)),
      );
    if (
      request === undefined ||
      !isRequestPending(
        rules,
        {
          createdAt: request.createdAt.getTime(),
          declinedAt: request.declinedAt?.getTime() ?? null,
        },
        now,
      )
    ) {
      return refuse("request_not_found");
    }
    const full = checkFriendship(
      rules,
      await countFriends(tx, userId),
      await countFriends(tx, other.userId),
    );
    if (full !== null) return refuse(full);
    await makeFriends(tx, userId, other.userId, now);
    return "ok";
  });
  if (outcome !== "ok") return outcome;
  return { kind: "ok", player: await badgeOf(db, other.userId, now), otherId: other.userId };
}

/**
 * `POST /me/friend-requests/:code/decline`. The sender is not told; the refusal is kept for the
 * delay before they may ask again.
 */
export async function declineFriendRequest(
  db: Database,
  input: { readonly userId: string; readonly code: string; readonly now: EpochMs },
): Promise<{ readonly kind: "ok" } | Refused> {
  const other = await findByCode(db, input.code);
  if (other === null) return refuse("request_not_found");
  const rows = await db
    .update(friendRequests)
    .set({ declinedAt: new Date(input.now) })
    .where(
      and(
        eq(friendRequests.senderId, other),
        eq(friendRequests.recipientId, input.userId),
        isNull(friendRequests.declinedAt),
      ),
    )
    .returning({ senderId: friendRequests.senderId });
  return rows.length === 0 ? refuse("request_not_found") : { kind: "ok" };
}

/** `DELETE /me/friend-requests/:code`: withdraws a request still waiting. Twice changes nothing. */
export async function cancelFriendRequest(
  db: Database,
  input: { readonly userId: string; readonly code: string },
): Promise<{ readonly kind: "ok" } | Refused> {
  const other = await findByCode(db, input.code);
  if (other === null) return refuse("player_not_found");
  // A declined request stays: withdrawing it must not open a new one at once.
  await db
    .delete(friendRequests)
    .where(
      and(
        eq(friendRequests.senderId, input.userId),
        eq(friendRequests.recipientId, other),
        isNull(friendRequests.declinedAt),
      ),
    );
  return { kind: "ok" };
}

/** `DELETE /me/friends/:code`: ends the friendship on both sides, without telling the other. */
export async function removeFriend(
  db: Database,
  input: { readonly userId: string; readonly code: string },
): Promise<{ readonly kind: "ok" } | Refused> {
  const other = await findByCode(db, input.code);
  if (other === null) return refuse("player_not_found");
  await db.transaction(async (tx) => breakFriendship(tx, input.userId, other));
  return { kind: "ok" };
}

async function findByCode(db: Reader, code: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: players.userId })
    .from(players)
    .where(eq(players.code, code));
  return row?.userId ?? null;
}

async function badgeOf(db: Reader, userId: string, now: EpochMs): Promise<PlayerBadge> {
  const badge = (await readBadges(db, [userId], now)).get(userId);
  if (badge === undefined) throw new Error(`No badge for player ${userId}`);
  return badge;
}

// --- The list ------------------------------------------------------------------------------------

/** A player suspended or closed leaves their friends' lists for the time of the sanction. */
export function notLocked(userId: AnyColumn | SQL, now: EpochMs): SQL {
  return sql`not exists (select 1 from sanctions s
    where s.user_id = ${userId} and s.revoked_at is null
      and (s.kind = 'close' or (s.kind = 'suspend' and s.until > ${new Date(now)})))`;
}

/** Friends ids of a player, without those suspended or closed for the time of the sanction. */
export async function friendIdsOf(db: Reader, userId: string, now: EpochMs): Promise<string[]> {
  const rows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(and(eq(friendships.userId, userId), notLocked(friendships.friendId, now)));
  return rows.map((row) => row.friendId);
}

/** `GET /me/friends`: friends, requests both ways, and the friend link with its beta places. */
export async function listFriends(
  db: Database,
  input: { readonly userId: string; readonly betaRequired: boolean; readonly now: EpochMs },
): Promise<FriendsResponse | Refused> {
  const { userId, now } = input;
  const rules = rulesAt(now);
  const self = await readSelf(db, userId);
  // Without a pseudo the screen still shows the link and asks for one; a guest has no friends.
  if ("kind" in self && self.reason === "account_required") return self;
  const player = await ensurePlayer(db, userId);

  const friendRows = await db
    .select({
      friendId: friendships.friendId,
      since: friendships.createdAt,
      lastSeenAt: players.lastSeenAt,
    })
    .from(friendships)
    .innerJoin(players, eq(players.userId, friendships.friendId))
    .where(and(eq(friendships.userId, userId), notLocked(friendships.friendId, now)))
    .orderBy(sql`${players.lastSeenAt} desc nulls last`, friendships.friendId);
  const friendIds = friendRows.map((row) => row.friendId);

  const since = new Date(now - rules.requestTtlMs);
  const [incoming, outgoing, placesRow] = await Promise.all([
    db
      .select({ userId: friendRequests.senderId, createdAt: friendRequests.createdAt })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.recipientId, userId),
          isNull(friendRequests.declinedAt),
          gt(friendRequests.createdAt, since),
        ),
      )
      .orderBy(desc(friendRequests.createdAt)),
    db
      .select({ userId: friendRequests.recipientId, createdAt: friendRequests.createdAt })
      .from(friendRequests)
      .where(and(eq(friendRequests.senderId, userId), gt(friendRequests.createdAt, since)))
      .orderBy(desc(friendRequests.createdAt)),
    db.select({ used: players.friendPlacesUsed }).from(players).where(eq(players.userId, userId)),
  ]);

  const [badges, clans, trades, crowns] = await Promise.all([
    readBadges(
      db,
      [...friendIds, ...incoming.map((row) => row.userId), ...outgoing.map((row) => row.userId)],
      now,
    ),
    readProfileClans(db, friendIds),
    possibleTradeCounts(db, userId, friendIds, now),
    lastWeekCrowns(db, userId, friendIds, now),
  ]);

  const friends: Friend[] = friendRows.flatMap((row) => {
    const badge = badges.get(row.friendId);
    if (badge === undefined) return [];
    const seen = row.lastSeenAt?.getTime() ?? null;
    return [
      {
        player: badge,
        online: seen !== null && now - seen < ONLINE_WINDOW_MS,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        clan: clans.get(row.friendId) ?? null,
        since: row.since.toISOString(),
        trades: trades.get(row.friendId) ?? 0,
        crowned: crowns.has(row.friendId),
      },
    ];
  });
  const toRequest = (row: { userId: string; createdAt: Date }): FriendRequest[] => {
    const badge = badges.get(row.userId);
    return badge === undefined ? [] : [{ player: badge, createdAt: row.createdAt.toISOString() }];
  };

  return {
    friends,
    incoming: incoming.flatMap(toRequest),
    outgoing: outgoing.flatMap(toRequest),
    maxFriends: rules.maxFriends,
    link: {
      code: player.code,
      betaPlacesLeft: input.betaRequired ? betaPlacesLeft(rules, placesRow[0]?.used ?? 0) : null,
    },
  };
}

/** Erases refusals past the delay before asking again, and requests expired; returns how many. */
export function purgeFriendRequests(db: Database, now: EpochMs): Promise<number> {
  const rules = rulesAt(now);
  return purgeRows(
    db,
    friendRequests,
    sql`${friendRequests.declinedAt} < ${new Date(now - rules.declinedCooldownMs)}
      or (${friendRequests.declinedAt} is null
        and ${friendRequests.createdAt} < ${new Date(now - rules.requestTtlMs)})`,
  );
}
