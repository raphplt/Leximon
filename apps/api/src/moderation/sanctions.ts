import {
  ADMIN_ACTIONS,
  type AdminContestsResponse,
  type AdminReport,
  type CreateSanctionRequest,
  type Sanction,
} from "@leximon/contract";
import {
  CLAN_SCHEDULE,
  canContest,
  checkClanName,
  clanRulesAt,
  type EpochMs,
  TIMED_SANCTIONS,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { ADMIN_ROLE } from "../auth";
import { messageContext } from "../clans/messages";
import { readBadges } from "../profile/profile";
import { generatePlayerCode } from "../trades/player-code";

const { adminActions, clanMessages, clans, moderationReports, players, sanctions, users } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type SanctionRow = typeof sanctions.$inferSelect;

/** Longest timed sanction the team may give at once. */
export const MAX_SANCTION_MS = 365 * 24 * 60 * 60 * 1000;

function toSanction(row: SanctionRow, content: string | null, now: EpochMs): Sanction {
  return {
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    until: row.until?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    content,
    seen: row.seenAt !== null,
    contestable:
      row.revokedAt === null &&
      canContest(row.createdAt.getTime(), row.contestedAt?.getTime() ?? null, now),
    contestedAt: row.contestedAt?.toISOString() ?? null,
    contestOutcome: row.contestOutcome,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

/** What the sanction was about: the reported text, as it was then. */
const reportContent = sql<
  string | null
>`coalesce(${moderationReports.content}, ${moderationReports.pseudo})`;

// --- The player ----------------------------------------------------------------------------------

/** `GET /me/sanctions`, newest first. */
export async function listSanctions(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<Sanction[]> {
  const rows = await db
    .select({ sanction: sanctions, content: reportContent })
    .from(sanctions)
    .leftJoin(moderationReports, eq(moderationReports.id, sanctions.reportId))
    .where(eq(sanctions.userId, userId))
    .orderBy(desc(sanctions.createdAt))
    .limit(100);
  return rows.map((row) => toSanction(row.sanction, row.content, now));
}

/** `POST /me/sanctions/seen`: the player read their new sanctions. */
export async function markSanctionsSeen(db: Database, userId: string, now: EpochMs) {
  await db
    .update(sanctions)
    .set({ seenAt: new Date(now) })
    .where(and(eq(sanctions.userId, userId), isNull(sanctions.seenAt)));
}

export type ContestResult =
  | { readonly kind: "contested" }
  | { readonly kind: "sanction_not_found" | "not_contestable" };

/**
 * `POST /me/sanctions/:id/contest`: once per sanction, within six months. A person of the
 * team reads it. The update's condition makes a second contest, even concurrent, a refusal.
 */
export async function contestSanction(
  db: Database,
  input: {
    readonly userId: string;
    readonly sanctionId: string;
    readonly text: string;
    readonly now: EpochMs;
  },
): Promise<ContestResult> {
  const { userId, sanctionId, text, now } = input;
  const [row] = await db
    .select()
    .from(sanctions)
    .where(and(eq(sanctions.id, sanctionId), eq(sanctions.userId, userId)));
  if (row === undefined) return { kind: "sanction_not_found" };
  if (
    row.revokedAt !== null ||
    !canContest(row.createdAt.getTime(), row.contestedAt?.getTime() ?? null, now)
  ) {
    return { kind: "not_contestable" };
  }
  const updated = await db
    .update(sanctions)
    .set({ contestedAt: new Date(now), contestText: text })
    .where(and(eq(sanctions.id, sanctionId), isNull(sanctions.contestedAt)))
    .returning({ id: sanctions.id });
  return updated.length === 0 ? { kind: "not_contestable" } : { kind: "contested" };
}

// --- The back office: reports --------------------------------------------------------------------

/** Report groups shown at once: the oldest first, so nothing waits forever. */
const REPORTS_PAGE = 50;

/** `GET /admin/reports`: open reports, one row per target with how many players reported it. */
export async function listOpenReports(db: Database, now: EpochMs): Promise<AdminReport[]> {
  const groups = await db
    .select({
      targetKind: moderationReports.targetKind,
      targetKey: moderationReports.targetKey,
      id: sql<string>`(array_agg(${moderationReports.id} order by ${moderationReports.createdAt}))[1]`,
      reportedId: sql<string>`(array_agg(${moderationReports.reportedId}
        order by ${moderationReports.createdAt}))[1]`,
      content: sql<string>`(array_agg(${reportContent} order by ${moderationReports.createdAt}))[1]`,
      clanId: sql<string | null>`(array_agg(${moderationReports.clanId}
        order by ${moderationReports.createdAt}))[1]`,
      messageId: sql<number | null>`(array_agg(${moderationReports.messageId}
        order by ${moderationReports.createdAt}))[1]`,
      reporters: sql<number>`count(*)::int`,
      firstReportedAt: sql<Date>`min(${moderationReports.createdAt})`,
    })
    .from(moderationReports)
    .where(isNull(moderationReports.resolvedAt))
    .groupBy(moderationReports.targetKind, moderationReports.targetKey)
    .orderBy(sql`min(${moderationReports.createdAt})`)
    .limit(REPORTS_PAGE);
  if (groups.length === 0) return [];

  const reportedIds = [...new Set(groups.map((group) => group.reportedId))];
  const badges = await readBadges(db, reportedIds, now);
  const clanIds = [...new Set(groups.flatMap((group) => group.clanId ?? []))];
  const clanNames = new Map(
    clanIds.length === 0
      ? []
      : (
          await db
            .select({ id: clans.id, name: clans.name })
            .from(clans)
            .where(inArray(clans.id, clanIds))
        ).map((row) => [row.id, row.name]),
  );
  const previous = new Map(
    (
      await db
        .select({ userId: sanctions.userId, count: count() })
        .from(sanctions)
        .where(inArray(sanctions.userId, reportedIds))
        .groupBy(sanctions.userId)
    ).map((row) => [row.userId, row.count]),
  );

  const reports: AdminReport[] = [];
  for (const group of groups) {
    reports.push({
      id: group.id,
      targetKind: group.targetKind,
      targetKey: group.targetKey,
      reported: badges.get(group.reportedId) ?? null,
      reportedUserId: group.reportedId,
      content: group.content,
      clanId: group.clanId,
      clanName: group.clanId === null ? null : (clanNames.get(group.clanId) ?? null),
      messageId: group.messageId,
      context:
        group.clanId !== null && group.messageId !== null
          ? await messageContext(db, group.clanId, group.messageId)
          : [],
      reporters: group.reporters,
      firstReportedAt: new Date(group.firstReportedAt).toISOString(),
      previousSanctions: previous.get(group.reportedId) ?? 0,
    });
  }
  return reports;
}

/** Closes every open report of the same target as `reportId`; the rows closed. */
async function resolveGroup(
  tx: Transaction,
  input: {
    readonly reportId: string;
    readonly adminId: string;
    readonly resolution: "dismissed" | "sanctioned";
    readonly now: EpochMs;
  },
): Promise<number> {
  const { reportId, adminId, resolution, now } = input;
  const [report] = await tx
    .select({ targetKind: moderationReports.targetKind, targetKey: moderationReports.targetKey })
    .from(moderationReports)
    .where(eq(moderationReports.id, reportId));
  if (report === undefined) return 0;
  const closed = await tx
    .update(moderationReports)
    .set({ resolvedAt: new Date(now), resolvedBy: adminId, resolution })
    .where(
      and(
        eq(moderationReports.targetKind, report.targetKind),
        eq(moderationReports.targetKey, report.targetKey),
        isNull(moderationReports.resolvedAt),
      ),
    )
    .returning({ id: moderationReports.id });
  return closed.length;
}

export type DismissResult =
  | { readonly kind: "dismissed"; readonly reports: number }
  | { readonly kind: "report_not_found" | "already_resolved" };

/** `POST /admin/reports/:id/dismiss`: nothing to sanction; the whole group closes. */
export async function dismissReport(
  db: Database,
  input: { readonly adminId: string; readonly reportId: string; readonly now: EpochMs },
): Promise<DismissResult> {
  const { adminId, reportId, now } = input;
  return db.transaction(async (tx): Promise<DismissResult> => {
    const [report] = await tx
      .select({ reportedId: moderationReports.reportedId })
      .from(moderationReports)
      .where(eq(moderationReports.id, reportId));
    if (report === undefined) return { kind: "report_not_found" };
    const closed = await resolveGroup(tx, { reportId, adminId, resolution: "dismissed", now });
    if (closed === 0) return { kind: "already_resolved" };
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.dismissReport,
      targetUserId: report.reportedId,
      details: { reportId, reports: closed },
      createdAt: new Date(now),
    });
    return { kind: "dismissed", reports: closed };
  });
}

// --- The back office: sanctions ------------------------------------------------------------------

export type CreateSanctionResult =
  | { readonly kind: "created"; readonly sanction: Sanction }
  | {
      readonly kind:
        | "player_not_found"
        | "admin_target"
        | "report_not_found"
        | "already_resolved"
        | "duration_required"
        | "duration_not_allowed"
        | "target_required";
    };

/**
 * `POST /admin/sanctions`. The sanction, its effect (message hidden, name replaced) and the
 * closing of the report group happen in one transaction, logged in `admin_actions`, whose
 * idempotency key makes a retried request apply once.
 */
export async function createSanction(
  db: Database,
  input: {
    readonly adminId: string;
    readonly request: CreateSanctionRequest;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<CreateSanctionResult> {
  const { adminId, request, idempotencyKey, now } = input;
  const timed = TIMED_SANCTIONS.includes(request.kind);
  if (timed && request.durationMs === undefined) return { kind: "duration_required" };
  if (!timed && request.durationMs !== undefined) return { kind: "duration_not_allowed" };
  if (request.durationMs !== undefined && request.durationMs > MAX_SANCTION_MS) {
    return { kind: "duration_not_allowed" };
  }

  const retried = await findRetried(db, adminId, idempotencyKey, now);
  if (retried !== null) return { kind: "created", sanction: retried };

  return db
    .transaction(async (tx): Promise<CreateSanctionResult> => {
      const [target] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, request.userId));
      if (target === undefined) return { kind: "player_not_found" };
      if (target.role === ADMIN_ROLE) return { kind: "admin_target" };

      let messageId = request.messageId ?? null;
      let clanId = request.clanId ?? null;
      let content: string | null = null;
      if (request.reportId !== undefined) {
        const [report] = await tx
          .select({
            reportedId: moderationReports.reportedId,
            messageId: moderationReports.messageId,
            clanId: moderationReports.clanId,
            resolvedAt: moderationReports.resolvedAt,
            content: reportContent,
          })
          .from(moderationReports)
          .where(eq(moderationReports.id, request.reportId));
        if (report === undefined || report.reportedId !== request.userId) {
          return { kind: "report_not_found" };
        }
        if (report.resolvedAt !== null) return { kind: "already_resolved" };
        messageId ??= report.messageId;
        clanId ??= report.clanId;
        content = report.content;
      }
      if (request.kind === "hide_message" && messageId === null) return { kind: "target_required" };
      if (request.kind === "reset_clan_name" && clanId === null) return { kind: "target_required" };

      const [row] = await tx
        .insert(sanctions)
        .values({
          id: crypto.randomUUID(),
          userId: request.userId,
          kind: request.kind,
          reason: request.reason,
          until: request.durationMs === undefined ? null : new Date(now + request.durationMs),
          reportId: request.reportId ?? null,
          messageId,
          clanId,
          createdBy: adminId,
          createdAt: new Date(now),
        })
        .returning();
      if (row === undefined) throw new Error("Sanction insert returned no row");

      const applied = await applyEffect(tx, {
        kind: request.kind,
        userId: request.userId,
        messageId,
        clanId,
        now,
      });
      if (!applied) throw new TargetMissingError();
      if (request.reportId !== undefined) {
        await resolveGroup(tx, {
          reportId: request.reportId,
          adminId,
          resolution: "sanctioned",
          now,
        });
      }
      await tx.insert(adminActions).values({
        adminId,
        action: ADMIN_ACTIONS.sanction,
        targetUserId: request.userId,
        details: { sanctionId: row.id, kind: request.kind, durationMs: request.durationMs ?? null },
        idempotencyKey,
        createdAt: new Date(now),
      });
      return { kind: "created", sanction: toSanction(row, content, now) };
    })
    .catch((error: unknown) => {
      if (error instanceof TargetMissingError) return { kind: "target_required" } as const;
      throw error;
    });
}

/** The message or clan of a content sanction does not belong to the player: nothing is written. */
class TargetMissingError extends Error {}

async function findRetried(
  db: Database,
  adminId: string,
  idempotencyKey: string,
  now: EpochMs,
): Promise<Sanction | null> {
  const [action] = await db
    .select({ details: adminActions.details })
    .from(adminActions)
    .where(and(eq(adminActions.adminId, adminId), eq(adminActions.idempotencyKey, idempotencyKey)));
  const sanctionId = action?.details["sanctionId"];
  if (typeof sanctionId !== "string") return null;
  const [row] = await db
    .select({ sanction: sanctions, content: reportContent })
    .from(sanctions)
    .leftJoin(moderationReports, eq(moderationReports.id, sanctions.reportId))
    .where(eq(sanctions.id, sanctionId));
  return row === undefined ? null : toSanction(row.sanction, row.content, now);
}

/** A content sanction acts at once; restrictions are read from the sanction rows. */
async function applyEffect(
  tx: Transaction,
  input: {
    readonly kind: CreateSanctionRequest["kind"];
    readonly userId: string;
    readonly messageId: number | null;
    readonly clanId: string | null;
    readonly now: EpochMs;
  },
): Promise<boolean> {
  const { kind, userId, messageId, clanId, now } = input;
  switch (kind) {
    case "hide_message": {
      if (messageId === null) return false;
      const hidden = await tx
        .update(clanMessages)
        .set({ hiddenAt: new Date(now), body: null })
        .where(and(eq(clanMessages.id, messageId), eq(clanMessages.authorId, userId)))
        .returning({ id: clanMessages.id });
      // A message erased since (account deleted, 90 days) has nothing left to hide.
      return hidden.length > 0 || !(await messageExists(tx, messageId));
    }
    case "reset_pseudo":
      // The player chooses a new one at once: the 30 days start again from that choice.
      await tx
        .update(players)
        .set({ pseudo: null, pseudoKey: null, pseudoChangedAt: null })
        .where(eq(players.userId, userId));
      return true;
    case "reset_clan_name": {
      if (clanId === null) return false;
      const name = checkClanName(clanRulesAt(CLAN_SCHEDULE, now), `Clan ${generatePlayerCode()}`);
      if (!name.ok) throw new Error("The replacement clan name is refused by the rules");
      const renamed = await tx
        .update(clans)
        .set({ name: name.name, nameKey: name.key, motto: "" })
        .where(eq(clans.id, clanId))
        .returning({ id: clans.id });
      if (renamed.length > 0) {
        await tx.insert(clanMessages).values({
          clanId,
          kind: "event",
          event: { type: "renamed", name: name.name },
          createdAt: new Date(now),
        });
      }
      return true;
    }
    case "mute":
    case "trade_ban":
    case "suspend":
    case "close":
      return true;
  }
}

async function messageExists(tx: Transaction, messageId: number): Promise<boolean> {
  const rows = await tx
    .select({ id: clanMessages.id })
    .from(clanMessages)
    .where(eq(clanMessages.id, messageId));
  return rows.length > 0;
}

// --- The back office: contests -------------------------------------------------------------------

/** `GET /admin/contests`: contests waiting for a person to read them, the oldest first. */
export async function listOpenContests(
  db: Database,
  now: EpochMs,
): Promise<AdminContestsResponse["contests"]> {
  const rows = await db
    .select({ sanction: sanctions, content: reportContent })
    .from(sanctions)
    .leftJoin(moderationReports, eq(moderationReports.id, sanctions.reportId))
    .where(and(isNotNull(sanctions.contestedAt), isNull(sanctions.contestResolvedAt)))
    .orderBy(asc(sanctions.contestedAt))
    .limit(100);
  const badges = await readBadges(
    db,
    rows.map((row) => row.sanction.userId),
    now,
  );
  return rows.map((row) => ({
    sanction: toSanction(row.sanction, row.content, now),
    player: badges.get(row.sanction.userId) ?? null,
    userId: row.sanction.userId,
    contestText: row.sanction.contestText ?? "",
  }));
}

export type ResolveContestResult =
  | { readonly kind: "resolved" }
  | { readonly kind: "sanction_not_found" | "already_resolved" };

/**
 * `POST /admin/sanctions/:id/contest`: upheld, or revoked, which lifts a restriction at once. A
 * name already replaced is not given back: the player chooses again.
 */
export async function resolveContest(
  db: Database,
  input: {
    readonly adminId: string;
    readonly sanctionId: string;
    readonly outcome: "upheld" | "revoked";
    readonly now: EpochMs;
  },
): Promise<ResolveContestResult> {
  const { adminId, sanctionId, outcome, now } = input;
  return db.transaction(async (tx): Promise<ResolveContestResult> => {
    const [row] = await tx
      .select({ userId: sanctions.userId, contestedAt: sanctions.contestedAt })
      .from(sanctions)
      .where(eq(sanctions.id, sanctionId));
    if (row === undefined || row.contestedAt === null) return { kind: "sanction_not_found" };
    const at = new Date(now);
    const updated = await tx
      .update(sanctions)
      .set({
        contestResolvedAt: at,
        contestOutcome: outcome,
        ...(outcome === "revoked" ? { revokedAt: at } : {}),
      })
      .where(and(eq(sanctions.id, sanctionId), isNull(sanctions.contestResolvedAt)))
      .returning({ id: sanctions.id });
    if (updated.length === 0) return { kind: "already_resolved" };
    await tx.insert(adminActions).values({
      adminId,
      action: ADMIN_ACTIONS.resolveContest,
      targetUserId: row.userId,
      details: { sanctionId, outcome },
      createdAt: at,
    });
    return { kind: "resolved" };
  });
}
