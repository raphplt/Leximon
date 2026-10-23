import type {
  ClanEntryMode,
  ClanJoinResult,
  ClanMember,
  ClanRefusal,
  ClanRole,
  ClanSummary,
  ClanView,
  CreateClanRequest,
  MyClanResponse,
  UpdateClanRequest,
} from "@leximon/contract";
import {
  CLAN_LEVEL,
  CLAN_SCHEDULE,
  type ClanAction,
  type ClanMemberState,
  type ClanRules,
  canAct,
  checkClanMotto,
  checkClanName,
  clanLevelOf,
  clanRulesAt,
  clanUnlocks,
  type EpochMs,
  emblemChoices,
  featureLevels,
  gameWeekOf,
  isChiefAway,
  isEmblemAllowed,
  isMuteDurationAllowed,
  levelOf,
  nextChief,
  nextClanUnlock,
  pseudoKey,
  type TextRefusal,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
} from "@leximon/core";
import { type ClanEventPayload, type Database, schema } from "@leximon/db";
import { and, asc, desc, eq, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import { readBadges } from "../profile/profile";
import { generatePlayerCode } from "../trades/player-code";
import { ensurePlayer } from "../trades/players";
import { readClaimable, readGoal } from "./goal";

const {
  clanJoinRequests,
  clanLibrary,
  clanMembers,
  clanMessages,
  clanWeekMembers,
  clanWeeks,
  clans,
  players,
  userProgress,
  users,
} = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

export type Refused = { readonly kind: "refused"; readonly reason: ClanRefusal };
const refuse = (reason: ClanRefusal): Refused => ({ kind: "refused", reason });

/** A member seen this recently shows as online. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
/** `lastSeenAt` is written at most this often: a write per request would be wasted. */
const LAST_SEEN_INTERVAL_MS = 60 * 1000;
/** Members shown on the clan's page; the rest come by `GET /clans/:id/members`. */
const VIEW_MEMBERS = 30;
/** A free invitation code is found on the first draw in practice. */
const MAX_CODE_DRAWS = 5;

function rulesAt(now: EpochMs): ClanRules {
  return clanRulesAt(CLAN_SCHEDULE, now);
}

// --- Presence ------------------------------------------------------------------------------------

/** Records that the player came by (and how long the chief has been away). */
export async function touchLastSeen(db: Database, userId: string, now: EpochMs): Promise<void> {
  await db
    .update(players)
    .set({ lastSeenAt: new Date(now) })
    .where(
      and(
        eq(players.userId, userId),
        or(
          isNull(players.lastSeenAt),
          lt(players.lastSeenAt, new Date(now - LAST_SEEN_INTERVAL_MS)),
        ),
      ),
    );
}

// --- Locks and checks ----------------------------------------------------------------------------

interface LockedPlayer {
  readonly isAnonymous: boolean;
  readonly pseudo: string | null;
  readonly xp: number | null;
  readonly clanId: string | null;
}

/**
 * Locks the row of the player who enters or leaves a clan. Lock order everywhere: that player's
 * row, then the clan's row. A clan's membership only changes under its row lock, which also
 * keeps `memberCount` exact.
 */
async function lockPlayer(tx: Transaction, userId: string): Promise<LockedPlayer> {
  const [row] = await tx
    .select({
      isAnonymous: users.isAnonymous,
      pseudo: players.pseudo,
      xp: userProgress.xp,
      clanId: clanMembers.clanId,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .leftJoin(userProgress, eq(userProgress.userId, players.userId))
    .leftJoin(clanMembers, eq(clanMembers.userId, players.userId))
    .where(eq(players.userId, userId))
    .for("update", { of: players });
  if (row === undefined) throw new Error("Player row missing right after its creation");
  return row;
}

async function lockClan(tx: Transaction, clanId: string) {
  const [row] = await tx.select().from(clans).where(eq(clans.id, clanId)).for("update");
  return row ?? null;
}

/** Why the player may not enter a clan (or create one) now, `null` if they may. */
function entryRefusal(
  player: LockedPlayer,
  feature: "join_clan" | "create_clan",
  now: EpochMs,
): ClanRefusal | null {
  if (player.isAnonymous) return "account_required";
  if (player.pseudo === null) return "pseudo_required";
  const level = featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, now)[feature];
  if (levelOf(player.xp ?? 0).level < level) return "level_too_low";
  if (player.clanId !== null) return "already_in_clan";
  return null;
}

async function journal(
  tx: Transaction,
  clanId: string,
  event: ClanEventPayload,
  now: EpochMs,
): Promise<void> {
  await tx.insert(clanMessages).values({ clanId, kind: "event", event, createdAt: new Date(now) });
}

/** Adds a player to a locked clan: membership, count, their other requests, the journal. */
async function enter(tx: Transaction, clanId: string, userId: string, now: EpochMs) {
  await tx.insert(clanMembers).values({ userId, clanId, role: "member", joinedAt: new Date(now) });
  await tx
    .update(clans)
    .set({ memberCount: sql`${clans.memberCount} + 1` })
    .where(eq(clans.id, clanId));
  await tx.delete(clanJoinRequests).where(eq(clanJoinRequests.userId, userId));
  await journal(tx, clanId, { type: "joined", userId }, now);
}

interface MemberRow {
  readonly userId: string;
  readonly role: ClanRole;
  readonly joinedAt: Date;
}

/** The actor and the target of a chief's or deputy's action, read under the clan's lock. */
async function actorAndTarget(
  tx: Transaction,
  input: {
    readonly clanId: string;
    readonly actorId: string;
    readonly targetCode: string;
    readonly action: ClanAction;
  },
): Promise<{ readonly actor: MemberRow; readonly target: MemberRow } | Refused> {
  const { clanId, actorId, targetCode, action } = input;
  const clan = await lockClan(tx, clanId);
  if (clan === null) return refuse("clan_not_found");
  const [target] = await tx
    .select({ userId: clanMembers.userId, role: clanMembers.role, joinedAt: clanMembers.joinedAt })
    .from(clanMembers)
    .innerJoin(players, eq(players.userId, clanMembers.userId))
    .where(and(eq(clanMembers.clanId, clanId), eq(players.code, targetCode)));
  const [actor] = await tx
    .select({ userId: clanMembers.userId, role: clanMembers.role, joinedAt: clanMembers.joinedAt })
    .from(clanMembers)
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, actorId)));
  if (actor === undefined) return refuse("not_member");
  if (target === undefined) return refuse("player_not_found");
  if (target.userId === actor.userId) return refuse("self");
  if (!canAct(actor.role, action, target.role)) return refuse("not_allowed");
  return { actor, target };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current = error; current instanceof Error; current = current.cause) {
    const fields = current as Error & { code?: unknown; constraint?: unknown };
    if (fields.code === "23505" && fields.constraint === constraint) return true;
  }
  return false;
}

/** The deputies and the oldest member: enough for `nextChief`, without reading a whole clan. */
async function chiefCandidates(tx: Transaction, clanId: string): Promise<ClanMemberState[]> {
  const fields = {
    userId: clanMembers.userId,
    role: clanMembers.role,
    joinedAt: clanMembers.joinedAt,
  };
  const deputies = await tx
    .select(fields)
    .from(clanMembers)
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.role, "deputy")));
  const oldest = await tx
    .select(fields)
    .from(clanMembers)
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.role, "member")))
    .orderBy(asc(clanMembers.joinedAt), asc(clanMembers.userId))
    .limit(1);
  return [...deputies, ...oldest].map((row) => ({ ...row, joinedAt: row.joinedAt.getTime() }));
}

/** Makes `successorId` the chief; the former chief becomes `formerRole`. */
async function passChief(
  tx: Transaction,
  input: {
    readonly clanId: string;
    readonly chiefId: string;
    readonly successorId: string;
    readonly formerRole: "deputy" | "member" | null;
    readonly now: EpochMs;
  },
): Promise<void> {
  const { clanId, chiefId, successorId, formerRole, now } = input;
  // One chief per clan (unique index): the former steps down first.
  if (formerRole !== null) {
    await tx.update(clanMembers).set({ role: formerRole }).where(eq(clanMembers.userId, chiefId));
  }
  await tx.update(clanMembers).set({ role: "chief" }).where(eq(clanMembers.userId, successorId));
  await journal(tx, clanId, { type: "role", userId: successorId, role: "chief" }, now);
}

// --- Creating and entering -----------------------------------------------------------------------

export type CreateClanResult = { readonly kind: "created"; readonly clanId: string } | Refused;

/** `POST /clans`: the player founds a clan and becomes its chief. */
export async function createClan(
  db: Database,
  input: {
    readonly userId: string;
    readonly request: CreateClanRequest;
    readonly canWrite: boolean;
    readonly now: EpochMs;
  },
): Promise<CreateClanResult> {
  const { userId, request, canWrite, now } = input;
  if (!canWrite) return refuse("sanctioned");
  const rules = rulesAt(now);
  const name = checkClanName(rules, request.name);
  if (!name.ok) return refuse(`name_${name.reason}`);
  const motto = checkClanMotto(rules, request.motto);
  if (!motto.ok) return refuse(mottoRefusal(motto.reason));
  if (!isEmblemAllowed(rules, [], request.emblem)) return refuse("emblem_not_allowed");

  await ensurePlayer(db, userId);
  for (let draw = 0; draw < MAX_CODE_DRAWS; draw++) {
    try {
      return await db.transaction(async (tx): Promise<CreateClanResult> => {
        const player = await lockPlayer(tx, userId);
        const refusal = entryRefusal(player, "create_clan", now);
        if (refusal !== null) return refuse(refusal);
        const clanId = crypto.randomUUID();
        await tx.insert(clans).values({
          id: clanId,
          name: name.name,
          nameKey: name.key,
          motto: motto.text,
          entryMode: request.entryMode,
          inviteCode: generatePlayerCode(),
          emblemEngraving: request.emblem.engraving,
          emblemColor: request.emblem.colors[0],
          emblemAccent: request.emblem.colors[1],
          memberCount: 1,
          createdAt: new Date(now),
        });
        await tx
          .insert(clanMembers)
          .values({ userId, clanId, role: "chief", joinedAt: new Date(now) });
        await tx.delete(clanJoinRequests).where(eq(clanJoinRequests.userId, userId));
        await journal(tx, clanId, { type: "joined", userId }, now);
        return { kind: "created", clanId };
      });
    } catch (error) {
      if (isUniqueViolation(error, "clans_name_key_idx")) return refuse("name_taken");
      if (isUniqueViolation(error, "clan_members_pkey")) return refuse("already_in_clan");
      if (!isUniqueViolation(error, "clans_invite_code_idx")) throw error;
      // The invitation code is someone else's: draw again.
    }
  }
  throw new Error(`No free invitation code after ${MAX_CODE_DRAWS} draws`);
}

export type JoinResult = ({ readonly kind: "ok" } & ClanJoinResult) | Refused;

/**
 * `POST /clans/:id/join`: enters an open clan, or asks to enter one "sur demande". With
 * `byCode`, the invitation code opens any clan.
 */
export async function joinClan(
  db: Database,
  input: {
    readonly userId: string;
    readonly clanId: string;
    readonly byCode: boolean;
    readonly now: EpochMs;
  },
): Promise<JoinResult> {
  const { userId, clanId, byCode, now } = input;
  await ensurePlayer(db, userId);
  try {
    return await db.transaction(async (tx): Promise<JoinResult> => {
      const player = await lockPlayer(tx, userId);
      const refusal = entryRefusal(player, "join_clan", now);
      if (refusal !== null) return refuse(refusal);
      const clan = await lockClan(tx, clanId);
      if (clan === null) return refuse("clan_not_found");
      const mode: ClanEntryMode = byCode ? "open" : clan.entryMode;
      if (mode === "invite") return refuse("invite_only");
      if (mode === "request") {
        await tx
          .insert(clanJoinRequests)
          .values({ clanId, userId, createdAt: new Date(now) })
          .onConflictDoNothing();
        return { kind: "ok", outcome: "requested", clanId };
      }
      await enter(tx, clanId, userId, now);
      return { kind: "ok", outcome: "joined", clanId };
    });
  } catch (error) {
    if (isUniqueViolation(error, "clan_members_pkey")) return refuse("already_in_clan");
    throw error;
  }
}

/** `POST /clans/join`: the clan behind an invitation code, `null` if none. */
export async function findClanByCode(db: Reader, code: string): Promise<string | null> {
  const [row] = await db
    .select({ id: clans.id })
    .from(clans)
    .where(eq(clans.inviteCode, code.trim().toUpperCase()));
  return row?.id ?? null;
}

/** `DELETE /clans/:id/join`: withdraws a request. */
export async function withdrawRequest(
  db: Database,
  input: { readonly userId: string; readonly clanId: string },
): Promise<void> {
  await db
    .delete(clanJoinRequests)
    .where(
      and(eq(clanJoinRequests.userId, input.userId), eq(clanJoinRequests.clanId, input.clanId)),
    );
}

export type RequestDecision = { readonly kind: "ok" } | Refused;

/**
 * `POST /clans/:id/requests/:code/accept`. The requester's row is locked first, as when
 * they join by themselves; their state is checked again, since it may have changed since.
 */
export async function acceptRequest(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly targetCode: string;
    readonly now: EpochMs;
  },
): Promise<RequestDecision> {
  const { actorId, clanId, targetCode, now } = input;
  const [target] = await db
    .select({ userId: players.userId })
    .from(players)
    .where(eq(players.code, targetCode));
  if (target === undefined) return refuse("player_not_found");
  try {
    return await db.transaction(async (tx): Promise<RequestDecision> => {
      const player = await lockPlayer(tx, target.userId);
      const clan = await lockClan(tx, clanId);
      if (clan === null) return refuse("clan_not_found");
      const actor = await memberOf(tx, clanId, actorId);
      if (actor === null) return refuse("not_member");
      if (!canAct(actor.role, "accept_request")) return refuse("not_allowed");
      const [request] = await tx
        .select({ userId: clanJoinRequests.userId })
        .from(clanJoinRequests)
        .where(
          and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.userId, target.userId)),
        );
      if (request === undefined) return refuse("player_not_found");
      const refusal = entryRefusal(player, "join_clan", now);
      if (refusal !== null) return refuse(refusal);
      await enter(tx, clanId, target.userId, now);
      return { kind: "ok" };
    });
  } catch (error) {
    if (isUniqueViolation(error, "clan_members_pkey")) return refuse("already_in_clan");
    throw error;
  }
}

/** `POST /clans/:id/requests/:code/decline`. */
export async function declineRequest(
  db: Database,
  input: { readonly actorId: string; readonly clanId: string; readonly targetCode: string },
): Promise<RequestDecision> {
  const { actorId, clanId, targetCode } = input;
  const actor = await memberOf(db, clanId, actorId);
  if (actor === null) return refuse("not_member");
  if (!canAct(actor.role, "accept_request")) return refuse("not_allowed");
  const [target] = await db
    .select({ userId: players.userId })
    .from(players)
    .where(eq(players.code, targetCode));
  if (target === undefined) return refuse("player_not_found");
  await db
    .delete(clanJoinRequests)
    .where(and(eq(clanJoinRequests.clanId, clanId), eq(clanJoinRequests.userId, target.userId)));
  return { kind: "ok" };
}

async function memberOf(db: Reader, clanId: string, userId: string): Promise<MemberRow | null> {
  const [row] = await db
    .select({ userId: clanMembers.userId, role: clanMembers.role, joinedAt: clanMembers.joinedAt })
    .from(clanMembers)
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, userId)));
  return row ?? null;
}

// --- Leaving -------------------------------------------------------------------------------------

export type LeaveResult =
  | { readonly kind: "left"; readonly clanId: string; readonly dissolved: boolean }
  | Refused;

/**
 * `POST /me/clan/leave`. A chief who leaves hands over to the oldest deputy, else the
 * oldest member; the last one out dissolves the clan. Then 24 h before entering another.
 */
export async function leaveClan(
  db: Database,
  input: { readonly userId: string; readonly now: EpochMs },
): Promise<LeaveResult> {
  const { userId, now } = input;
  await ensurePlayer(db, userId);
  return db.transaction(async (tx): Promise<LeaveResult> => {
    const player = await lockPlayer(tx, userId);
    if (player.clanId === null) return refuse("not_member");
    const clanId = player.clanId;
    const clan = await lockClan(tx, clanId);
    // Excluded or dissolved between the two reads: nothing to leave.
    const me = clan === null ? null : await memberOf(tx, clanId, userId);
    if (clan === null || me === null) return refuse("not_member");

    await tx.delete(clanMembers).where(eq(clanMembers.userId, userId));
    if (clan.memberCount <= 1) {
      await tx.delete(clans).where(eq(clans.id, clanId));
      return { kind: "left", clanId, dissolved: true };
    }
    if (me.role === "chief") {
      const successorId = nextChief(await chiefCandidates(tx, clanId), userId);
      if (successorId !== null) {
        await passChief(tx, { clanId, chiefId: userId, successorId, formerRole: null, now });
      }
    }
    await tx
      .update(clans)
      .set({ memberCount: sql`${clans.memberCount} - 1` })
      .where(eq(clans.id, clanId));
    await journal(tx, clanId, { type: "left", userId }, now);
    return { kind: "left", clanId, dissolved: false };
  });
}

// --- Chief and deputies --------------------------------------------------------------------------

export type ManageResult = { readonly kind: "ok" } | Refused;

/** `POST /clans/:id/members/:code/kick`. No waiting time after being excluded. */
export async function kickMember(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly targetCode: string;
    readonly now: EpochMs;
  },
): Promise<ManageResult> {
  const { clanId, now } = input;
  return db.transaction(async (tx): Promise<ManageResult> => {
    const found = await actorAndTarget(tx, { ...input, action: "kick" });
    if ("kind" in found) return found;
    await tx.delete(clanMembers).where(eq(clanMembers.userId, found.target.userId));
    await tx
      .update(clans)
      .set({ memberCount: sql`${clans.memberCount} - 1` })
      .where(eq(clans.id, clanId));
    await journal(tx, clanId, { type: "excluded", userId: found.target.userId }, now);
    return { kind: "ok" };
  });
}

/** `PUT /clans/:id/members/:code/role`: the chief names or removes a deputy. */
export async function setMemberRole(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly targetCode: string;
    readonly role: "deputy" | "member";
    readonly now: EpochMs;
  },
): Promise<ManageResult> {
  const { clanId, role, now } = input;
  return db.transaction(async (tx): Promise<ManageResult> => {
    const found = await actorAndTarget(tx, { ...input, action: "appoint_deputy" });
    if ("kind" in found) return found;
    if (found.target.role === "chief") return refuse("not_allowed");
    if (found.target.role === role) return { kind: "ok" };
    await tx.update(clanMembers).set({ role }).where(eq(clanMembers.userId, found.target.userId));
    await journal(tx, clanId, { type: "role", userId: found.target.userId, role }, now);
    return { kind: "ok" };
  });
}

/** `POST /clans/:id/members/:code/hand-over`: the chief passes the role and becomes a deputy. */
export async function handOver(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly targetCode: string;
    readonly now: EpochMs;
  },
): Promise<ManageResult> {
  const { clanId, actorId, now } = input;
  return db.transaction(async (tx): Promise<ManageResult> => {
    const found = await actorAndTarget(tx, { ...input, action: "hand_over" });
    if ("kind" in found) return found;
    await passChief(tx, {
      clanId,
      chiefId: actorId,
      successorId: found.target.userId,
      formerRole: "deputy",
      now,
    });
    return { kind: "ok" };
  });
}

/** `PUT /clans/:id/members/:code/mute`: silences a member for one of the allowed durations. */
export async function muteMember(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly targetCode: string;
    /** `null` lifts the silence. */
    readonly durationMs: number | null;
    readonly now: EpochMs;
  },
): Promise<ManageResult> {
  const { durationMs, now } = input;
  if (durationMs !== null && !isMuteDurationAllowed(rulesAt(now), durationMs)) {
    return refuse("mute_duration");
  }
  return db.transaction(async (tx): Promise<ManageResult> => {
    const found = await actorAndTarget(tx, { ...input, action: "mute" });
    if ("kind" in found) return found;
    await tx
      .update(clanMembers)
      .set({ mutedUntil: durationMs === null ? null : new Date(now + durationMs) })
      .where(eq(clanMembers.userId, found.target.userId));
    return { kind: "ok" };
  });
}

/** `PATCH /clans/:id`: the chief changes the name, motto, emblem or entry mode. */
export async function updateClan(
  db: Database,
  input: {
    readonly actorId: string;
    readonly clanId: string;
    readonly changes: UpdateClanRequest;
    readonly canWrite: boolean;
    readonly now: EpochMs;
  },
): Promise<ManageResult> {
  const { actorId, clanId, changes, canWrite, now } = input;
  const rules = rulesAt(now);
  const name = changes.name === undefined ? null : checkClanName(rules, changes.name);
  if (name !== null && !name.ok) return refuse(`name_${name.reason}`);
  const motto = changes.motto === undefined ? null : checkClanMotto(rules, changes.motto);
  if (motto !== null && !motto.ok) {
    return refuse(mottoRefusal(motto.reason));
  }
  try {
    return await db.transaction(async (tx): Promise<ManageResult> => {
      const clan = await lockClan(tx, clanId);
      if (clan === null) return refuse("clan_not_found");
      const actor = await memberOf(tx, clanId, actorId);
      if (actor === null) return refuse("not_member");
      if (!canAct(actor.role, "edit_clan")) return refuse("not_allowed");

      const update: Partial<typeof clans.$inferInsert> = {};
      const renamed = name?.ok && name.name !== clan.name;
      if (renamed || (motto?.ok && motto.text !== clan.motto)) {
        // A muted player writes nothing the others read.
        if (!canWrite) return refuse("sanctioned");
      }
      if (renamed) {
        update.name = name.name;
        update.nameKey = name.key;
      }
      if (motto?.ok) update.motto = motto.text;
      if (changes.entryMode !== undefined) update.entryMode = changes.entryMode;
      if (changes.emblem !== undefined) {
        const opened = clanUnlocks(CLAN_LEVEL, clanLevelOf(CLAN_LEVEL, clan.xp).level);
        if (!isEmblemAllowed(rules, opened.emblemItems, changes.emblem)) {
          return refuse("emblem_not_allowed");
        }
        update.emblemEngraving = changes.emblem.engraving;
        update.emblemColor = changes.emblem.colors[0];
        update.emblemAccent = changes.emblem.colors[1];
      }
      if (Object.keys(update).length > 0) {
        await tx.update(clans).set(update).where(eq(clans.id, clanId));
      }
      if (renamed) await journal(tx, clanId, { type: "renamed", name: name.name }, now);
      return { kind: "ok" };
    });
  } catch (error) {
    if (isUniqueViolation(error, "clans_name_key_idx")) return refuse("name_taken");
    throw error;
  }
}

export type RenewInviteResult = { readonly kind: "renewed"; readonly code: string } | Refused;

/** `POST /clans/:id/invite-code`: the chief replaces the code, the old one opens nothing more. */
export async function renewInviteCode(
  db: Database,
  input: { readonly actorId: string; readonly clanId: string },
): Promise<RenewInviteResult> {
  const actor = await memberOf(db, input.clanId, input.actorId);
  if (actor === null) return refuse("not_member");
  if (!canAct(actor.role, "renew_invite")) return refuse("not_allowed");
  for (let draw = 0; draw < MAX_CODE_DRAWS; draw++) {
    const code = generatePlayerCode();
    try {
      await db.update(clans).set({ inviteCode: code }).where(eq(clans.id, input.clanId));
      return { kind: "renewed", code };
    } catch (error) {
      if (!isUniqueViolation(error, "clans_invite_code_idx")) throw error;
    }
  }
  throw new Error(`No free invitation code after ${MAX_CODE_DRAWS} draws`);
}

/**
 * A chief away for 14 days hands the role over, checked when the clan's page is read rather
 * than by a scheduled task (the page's own query tells whether it is due). The absent chief
 * stays, as a member.
 */
export async function handOverIfChiefAway(
  db: Database,
  clanId: string,
  now: EpochMs,
): Promise<void> {
  const rules = rulesAt(now);
  const chief = await readChief(db, clanId);
  if (chief === null || !isChiefAway(rules, chief.seenAt, now)) return;
  await db.transaction(async (tx) => {
    if ((await lockClan(tx, clanId)) === null) return;
    const current = await readChief(tx, clanId);
    if (current === null || !isChiefAway(rules, current.seenAt, now)) return;
    const successorId = nextChief(await chiefCandidates(tx, clanId), current.userId);
    if (successorId === null) return;
    await passChief(tx, {
      clanId,
      chiefId: current.userId,
      successorId,
      formerRole: "member",
      now,
    });
  });
}

async function readChief(db: Reader, clanId: string) {
  const [row] = await db
    .select({
      userId: clanMembers.userId,
      joinedAt: clanMembers.joinedAt,
      lastSeenAt: players.lastSeenAt,
    })
    .from(clanMembers)
    .innerJoin(players, eq(players.userId, clanMembers.userId))
    .where(and(eq(clanMembers.clanId, clanId), eq(clanMembers.role, "chief")));
  if (row === undefined) return null;
  return { userId: row.userId, seenAt: (row.lastSeenAt ?? row.joinedAt).getTime() };
}

// --- Reading -------------------------------------------------------------------------------------

type ClanRow = typeof clans.$inferSelect;

export function toSummary(row: ClanRow): ClanSummary {
  const level = clanLevelOf(CLAN_LEVEL, row.xp).level;
  return {
    id: row.id,
    name: row.name,
    motto: row.motto,
    entryMode: row.entryMode,
    emblem: { engraving: row.emblemEngraving, colors: [row.emblemColor, row.emblemAccent] },
    memberCount: row.memberCount,
    level,
    banner: clanUnlocks(CLAN_LEVEL, level).banners.at(-1) ?? null,
  };
}

/** `GET /me/clan`. */
export async function readMyClan(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<MyClanResponse> {
  const [row] = await db
    .select({
      clanId: clanMembers.clanId,
      engraving: clans.emblemEngraving,
      color: clans.emblemColor,
      accent: clans.emblemAccent,
    })
    .from(players)
    .leftJoin(clanMembers, eq(clanMembers.userId, players.userId))
    .leftJoin(clans, eq(clans.id, clanMembers.clanId))
    .where(eq(players.userId, userId));
  const requests = await db
    .select({ clanId: clanJoinRequests.clanId })
    .from(clanJoinRequests)
    .where(eq(clanJoinRequests.userId, userId));
  const clanId = row?.clanId ?? null;
  const [week] =
    clanId === null
      ? []
      : await db
          .select({
            bronze: clanWeeks.bronze,
            silver: clanWeeks.silver,
            gold: clanWeeks.gold,
            illuminated: clanWeeks.illuminated,
            answers: clanWeeks.answers,
          })
          .from(clanWeeks)
          .where(and(eq(clanWeeks.clanId, clanId), eq(clanWeeks.week, gameWeekOf(now).key)));
  return {
    clanId: row?.clanId ?? null,
    emblem:
      row?.engraving == null || row.color == null || row.accent == null
        ? null
        : { engraving: row.engraving, colors: [row.color, row.accent] },
    requests: requests.map((request) => request.clanId),
    claimable: await readClaimable(db, userId, now),
    goal:
      week === undefined
        ? null
        : {
            targets: {
              bronze: week.bronze,
              silver: week.silver,
              gold: week.gold,
              illuminated: week.illuminated,
            },
            answers: week.answers,
          },
  };
}

export interface ClanListCursor {
  readonly memberCount: number;
  readonly id: string;
}

/** `GET /clans`: by name prefix and entry mode, the biggest clans first. */
export async function listClans(
  db: Reader,
  input: {
    readonly q: string | undefined;
    readonly entry: ClanEntryMode | undefined;
    readonly after: ClanListCursor | null;
    readonly limit: number;
  },
): Promise<{ readonly clans: ClanSummary[]; readonly last: ClanListCursor | null }> {
  const { q, entry, after, limit } = input;
  const prefix = q === undefined ? "" : pseudoKey(q.normalize("NFC").trim());
  const rows = await db
    .select()
    .from(clans)
    .where(
      and(
        prefix === "" ? undefined : like(clans.nameKey, `${prefix.replaceAll(/[\\%_]/g, "")}%`),
        entry === undefined ? undefined : eq(clans.entryMode, entry),
        after === null
          ? undefined
          : sql`(${clans.memberCount}, ${clans.id}) < (${after.memberCount}, ${after.id}::uuid)`,
      ),
    )
    .orderBy(desc(clans.memberCount), desc(clans.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    clans: page.map(toSummary),
    last:
      rows.length > limit && last !== undefined
        ? { memberCount: last.memberCount, id: last.id }
        : null,
  };
}

export interface MemberCursor {
  readonly answers: number;
  readonly joinedAt: number;
  readonly userId: string;
}

const weekAnswers = sql<number>`coalesce(${clanWeekMembers.answers}, 0)`;

/**
 * Members in order of their share of the week, then by arrival. With `pseudoPrefix`, only those
 * whose pseudo key starts with it.
 */
export async function readMembers(
  db: Reader,
  input: {
    readonly clanId: string;
    readonly after: MemberCursor | null;
    readonly limit: number;
    readonly now: EpochMs;
    readonly pseudoPrefix?: string;
  },
): Promise<{ readonly members: ClanMember[]; readonly last: MemberCursor | null }> {
  const { clanId, after, limit, now, pseudoPrefix } = input;
  const week = gameWeekOf(now).key;
  const rows = await db
    .select({
      userId: clanMembers.userId,
      role: clanMembers.role,
      joinedAt: clanMembers.joinedAt,
      mutedUntil: clanMembers.mutedUntil,
      lastSeenAt: players.lastSeenAt,
      weekAnswers,
    })
    .from(clanMembers)
    .innerJoin(players, eq(players.userId, clanMembers.userId))
    .leftJoin(
      clanWeekMembers,
      and(
        eq(clanWeekMembers.clanId, clanMembers.clanId),
        eq(clanWeekMembers.week, week),
        eq(clanWeekMembers.userId, clanMembers.userId),
      ),
    )
    .where(
      and(
        eq(clanMembers.clanId, clanId),
        pseudoPrefix === undefined
          ? undefined
          : sql`starts_with(${players.pseudoKey}, ${pseudoPrefix})`,
        after === null
          ? undefined
          : sql`(-${weekAnswers}, ${clanMembers.joinedAt}, ${clanMembers.userId})
              > (${-after.answers}, ${new Date(after.joinedAt)}, ${after.userId})`,
      ),
    )
    .orderBy(desc(weekAnswers), asc(clanMembers.joinedAt), asc(clanMembers.userId))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const badges = await readBadges(
    db,
    page.map((row) => row.userId),
    now,
  );
  const members = page.flatMap((row): ClanMember[] => {
    const player = badges.get(row.userId);
    if (player === undefined) return [];
    const seen = row.lastSeenAt?.getTime() ?? null;
    return [
      {
        player,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
        online: seen !== null && now - seen < ONLINE_WINDOW_MS,
        lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
        weekAnswers: Number(row.weekAnswers),
        mutedUntil:
          row.mutedUntil !== null && row.mutedUntil.getTime() > now
            ? row.mutedUntil.toISOString()
            : null,
      },
    ];
  });
  const last = page.at(-1);
  return {
    members,
    last:
      rows.length > limit && last !== undefined
        ? {
            answers: Number(last.weekAnswers),
            joinedAt: last.joinedAt.getTime(),
            userId: last.userId,
          }
        : null,
  };
}

/**
 * The clan, the viewer's place in it and when its chief was last seen, in one query: the page is
 * polled while it is open.
 */
async function readViewHeader(db: Reader, clanId: string, viewerId: string) {
  const [row] = await db
    .select({
      clan: clans,
      role: clanMembers.role,
      mutedUntil: clanMembers.mutedUntil,
      chiefSeenAt: sql<Date | null>`(select coalesce(p.last_seen_at, m.joined_at)
        from ${clanMembers} m join ${players} p on p.user_id = m.user_id
        where m.clan_id = ${clans.id} and m.role = 'chief')`.mapWith(players.lastSeenAt),
      requested: sql<boolean>`exists (select 1 from ${clanJoinRequests} r
        where r.clan_id = ${clans.id} and r.user_id = ${viewerId})`,
      pendingRequests: sql<number>`(select count(*)::int from ${clanJoinRequests} r
        where r.clan_id = ${clans.id})`,
    })
    .from(clans)
    .leftJoin(clanMembers, and(eq(clanMembers.clanId, clans.id), eq(clanMembers.userId, viewerId)))
    .where(eq(clans.id, clanId));
  return row ?? null;
}

/** `GET /clans/:id`. Visitors see the header and the members only. */
export async function readClanView(
  db: Database,
  input: { readonly viewerId: string; readonly clanId: string; readonly now: EpochMs },
): Promise<ClanView | null> {
  const { viewerId, clanId, now } = input;
  let header = await readViewHeader(db, clanId, viewerId);
  if (header === null) return null;
  const { chiefSeenAt } = header;
  if (chiefSeenAt !== null && isChiefAway(rulesAt(now), chiefSeenAt.getTime(), now)) {
    await handOverIfChiefAway(db, clanId, now);
    header = await readViewHeader(db, clanId, viewerId);
    if (header === null) return null;
  }
  const { clan, role, mutedUntil } = header;
  const [{ members }, goal, library] = await Promise.all([
    readMembers(db, { clanId, after: null, limit: VIEW_MEMBERS, now }),
    role === null ? null : readGoal(db, { clanId, userId: viewerId, now }),
    role === null
      ? []
      : db
          .select({ collectionId: clanLibrary.collectionId, owned: clanLibrary.owned })
          .from(clanLibrary)
          .where(eq(clanLibrary.clanId, clanId))
          .orderBy(asc(clanLibrary.collectionId)),
  ]);
  const level = clanLevelOf(CLAN_LEVEL, clan.xp);
  const choices = emblemChoices(rulesAt(now), clanUnlocks(CLAN_LEVEL, level.level).emblemItems);
  return {
    clan: toSummary(clan),
    me:
      role === null
        ? null
        : {
            role,
            mutedUntil:
              mutedUntil !== null && mutedUntil.getTime() > now ? mutedUntil.toISOString() : null,
            inviteCode: clan.inviteCode,
          },
    requested: header.requested,
    goal,
    progress: { ...level, next: nextClanUnlock(CLAN_LEVEL, level.level) },
    library,
    members,
    pendingRequests: role === null || role === "member" ? 0 : header.pendingRequests,
    emblemChoices: { engravings: [...choices.engravings], colors: [...choices.colors] },
  };
}

/** `GET /clans/:id/requests`: for the chief and the deputies. */
export async function listRequests(
  db: Database,
  input: { readonly actorId: string; readonly clanId: string; readonly now: EpochMs },
) {
  const { actorId, clanId, now } = input;
  const actor = await memberOf(db, clanId, actorId);
  if (actor === null) return refuse("not_member");
  if (!canAct(actor.role, "accept_request")) return refuse("not_allowed");
  const rows = await db
    .select({ userId: clanJoinRequests.userId, createdAt: clanJoinRequests.createdAt })
    .from(clanJoinRequests)
    .where(eq(clanJoinRequests.clanId, clanId))
    .orderBy(asc(clanJoinRequests.createdAt))
    .limit(200);
  const badges = await readBadges(
    db,
    rows.map((row) => row.userId),
    now,
  );
  return {
    kind: "ok" as const,
    requests: rows.flatMap((row) => {
      const player = badges.get(row.userId);
      return player === undefined ? [] : [{ player, createdAt: row.createdAt.toISOString() }];
    }),
  };
}

/** The clan of each player, in one query (for the queue and the profile). */
export async function clansOf(
  db: Reader,
  userIds: readonly string[],
): Promise<Map<string, { readonly clanId: string; readonly joinedAt: Date }>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: clanMembers.userId,
      clanId: clanMembers.clanId,
      joinedAt: clanMembers.joinedAt,
    })
    .from(clanMembers)
    .where(inArray(clanMembers.userId, [...new Set(userIds)]));
  return new Map(rows.map((row) => [row.userId, row]));
}

function mottoRefusal(reason: TextRefusal): ClanRefusal {
  if (reason === "refused") return "motto_refused";
  if (reason === "contact") return "motto_contact";
  return "motto_too_long";
}

/** For the routes: refusals that mean "not here" answer 404, the rest 403 or 409. */
export function refusalStatus(reason: ClanRefusal): 403 | 404 | 409 | 422 {
  switch (reason) {
    case "clan_not_found":
    case "player_not_found":
      return 404;
    case "account_required":
    case "level_too_low":
    case "not_member":
    case "not_allowed":
    case "sanctioned":
    case "muted":
      return 403;
    case "name_too_short":
    case "name_too_long":
    case "name_invalid_characters":
    case "name_refused":
    case "motto_too_long":
    case "motto_refused":
    case "motto_contact":
    case "emblem_not_allowed":
    case "message_empty":
    case "message_too_long":
    case "message_refused":
    case "message_contact":
    case "mute_duration":
      return 422;
    default:
      return 409;
  }
}
