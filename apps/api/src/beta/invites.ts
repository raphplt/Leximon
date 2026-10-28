import {
  type AdminInvite,
  type adminCreateInviteRequestSchema,
  type adminSetInvitePlacesRequestSchema,
  type InviteStatus,
  inviteCodeSchema,
} from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";

const { invites } = schema;

/** Without a room for confusion: no 0/o, 1/l/i. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 10;

/** Whether new players need an invitation, from the `BETA_INVITES` variable. */
export function invitesRequired(env: Pick<Env, "BETA_INVITES">): boolean {
  return env.BETA_INVITES === "required";
}

/** A random code: 31^10 possibilities, nobody guesses one. */
export function randomInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 is not a multiple of 31: values past the last full round are drawn again.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  for (const byte of bytes) {
    if (byte >= limit) return randomInviteCode();
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

/** The code sent with a sign-in, if well formed. */
export function parseInviteCode(value: string | null | undefined): string | null {
  const code = inviteCodeSchema.safeParse(value);
  return code.success ? code.data : null;
}

function isOpen(now: EpochMs) {
  const at = new Date(now);
  return and(
    isNull(invites.revokedAt),
    or(isNull(invites.expiresAt), gt(invites.expiresAt, at)),
    lt(invites.uses, invites.maxUses),
  );
}

export type ClaimResult =
  | { readonly kind: "claimed"; readonly inviteId: string }
  /** Full, expired or withdrawn. */
  | { readonly kind: "closed" }
  | { readonly kind: "unknown" };

/**
 * Takes one place on an invitation. A single conditional update: two sign-ups at once never take
 * more places than there are, without holding a lock across the sign-up. A sign-up that fails
 * after this loses its place, which the admin sees as one use too many.
 */
export async function claimInvite(db: Database, code: string, now: EpochMs): Promise<ClaimResult> {
  const [claimed] = await db
    .update(invites)
    .set({ uses: sql`${invites.uses} + 1` })
    .where(and(eq(invites.code, code), isOpen(now)))
    .returning({ id: invites.id });
  if (claimed !== undefined) return { kind: "claimed", inviteId: claimed.id };
  const [known] = await db.select({ id: invites.id }).from(invites).where(eq(invites.code, code));
  return known === undefined ? { kind: "unknown" } : { kind: "closed" };
}

/** What the invitation page shows before the player comes in. */
export async function readInviteStatus(
  db: Database,
  code: string,
  now: EpochMs,
): Promise<InviteStatus["status"]> {
  const [row] = await db
    .select({
      uses: invites.uses,
      maxUses: invites.maxUses,
      expiresAt: invites.expiresAt,
      revokedAt: invites.revokedAt,
    })
    .from(invites)
    .where(eq(invites.code, code));
  if (row === undefined) return "unknown";
  if (row.revokedAt !== null || (row.expiresAt !== null && row.expiresAt.getTime() <= now)) {
    return "expired";
  }
  return row.uses >= row.maxUses ? "full" : "open";
}

type InviteRow = typeof invites.$inferSelect;

function toAdminInvite(row: InviteRow): AdminInvite {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    maxUses: row.maxUses,
    uses: row.uses,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every invitation, newest first: a closed beta has a few dozen at most. */
export async function listInvites(db: Database): Promise<AdminInvite[]> {
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(500);
  return rows.map(toAdminInvite);
}

export type CreateInviteResult =
  | { readonly kind: "created"; readonly invite: AdminInvite }
  | { readonly kind: "code_taken" };

/** Creates an invitation and logs it, in one transaction. */
export async function createInvite(
  db: Database,
  adminId: string,
  request: z.output<typeof adminCreateInviteRequestSchema>,
): Promise<CreateInviteResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invites)
      .values({
        code: request.code ?? randomInviteCode(),
        label: request.label,
        maxUses: request.maxUses,
        expiresAt: request.expiresAt === undefined ? null : new Date(request.expiresAt),
        createdBy: adminId,
      })
      .onConflictDoNothing({ target: invites.code })
      .returning();
    if (row === undefined) return { kind: "code_taken" };
    await tx.insert(schema.adminActions).values({
      adminId,
      action: "invite_create",
      details: { inviteId: row.id, label: row.label, maxUses: row.maxUses },
    });
    return { kind: "created", invite: toAdminInvite(row) };
  });
}

/** Withdraws an invitation: nobody comes in by it any more, those already in stay. Idempotent. */
export async function revokeInvite(
  db: Database,
  adminId: string,
  inviteId: string,
  now: EpochMs,
): Promise<AdminInvite | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invites)
      .set({ revokedAt: sql`coalesce(${invites.revokedAt}, ${new Date(now)})` })
      .where(eq(invites.id, inviteId))
      .returning();
    if (row === undefined) return null;
    await tx.insert(schema.adminActions).values({
      adminId,
      action: "invite_revoke",
      details: { inviteId },
    });
    return toAdminInvite(row);
  });
}

export type SetInvitePlacesResult =
  | { readonly kind: "set"; readonly invite: AdminInvite }
  | { readonly kind: "not_found" }
  /** Fewer places than players already in by this link. */
  | { readonly kind: "below_uses" };

/**
 * Changes the number of places of an invitation, and logs it. The row stays locked until the
 * end, so a sign-up taking a place at the same moment counts against the new number or waits.
 */
export async function setInvitePlaces(
  db: Database,
  adminId: string,
  inviteId: string,
  request: z.output<typeof adminSetInvitePlacesRequestSchema>,
): Promise<SetInvitePlacesResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(invites).where(eq(invites.id, inviteId)).for("update");
    if (current === undefined) return { kind: "not_found" };
    if (request.maxUses < current.uses) return { kind: "below_uses" };
    if (request.maxUses === current.maxUses) return { kind: "set", invite: toAdminInvite(current) };
    const [row] = await tx
      .update(invites)
      .set({ maxUses: request.maxUses })
      .where(eq(invites.id, inviteId))
      .returning();
    if (row === undefined) return { kind: "not_found" };
    await tx.insert(schema.adminActions).values({
      adminId,
      action: "invite_places",
      details: { inviteId, label: row.label, from: current.maxUses, maxUses: row.maxUses },
    });
    return { kind: "set", invite: toAdminInvite(row) };
  });
}
