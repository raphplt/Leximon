import { type EpochMs, type Restrictions, restrictionsAt } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

const { sanctions } = schema;

/** What the player's standing sanctions forbid now (P68). Most players have none: one index probe. */
export async function readRestrictions(
  db: Pick<Database, "select">,
  userId: string,
  now: EpochMs,
): Promise<Restrictions> {
  const rows = await db
    .select({ kind: sanctions.kind, until: sanctions.until })
    .from(sanctions)
    .where(
      and(
        eq(sanctions.userId, userId),
        isNull(sanctions.revokedAt),
        or(eq(sanctions.kind, "close"), gt(sanctions.until, new Date(now))),
      ),
    );
  return restrictionsAt(
    rows.map((row) => ({ kind: row.kind, until: row.until?.getTime() ?? null, revokedAt: null })),
    now,
  );
}

/**
 * Refuses the game's writes to a suspended or closed account (P68). The player still signs in,
 * reads their sanction and contests it (R-08), and may delete their account. Reads stay open:
 * they change nothing. Must run after `requireUser`.
 */
export const refuseLockedWrites = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === "GET") return next();
  const restrictions = await readRestrictions(c.var.db, c.var.userId, Date.now());
  if (restrictions.locked) return c.json({ error: "account_locked" }, 403);
  return next();
});
