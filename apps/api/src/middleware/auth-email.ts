import { sql } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

/**
 * The address in the body of a sign-in request, lowercase as Better Auth compares it; `null` when
 * the body has none. Read from a clone: Better Auth reads the request body itself afterwards.
 */
export async function readAuthEmail(c: Context<AppEnv>): Promise<string | null> {
  const cached = c.get("authEmail");
  if (cached !== undefined) return cached;
  const body: unknown = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  const email =
    typeof body === "object" && body !== null && "email" in body && typeof body.email === "string"
      ? body.email.toLowerCase()
      : null;
  c.set("authEmail", email);
  return email;
}

/**
 * Checks of the codes sent to one address run one after the other, under a transaction-scoped
 * advisory lock (nothing else is locked). Better Auth counts wrong attempts with a
 * read-then-write when a code is checked without being used up (`link-preview`): concurrent
 * guesses would otherwise each see the same count, and get more tries than allowed.
 */
export async function withCodeLock<T>(
  c: Context<AppEnv>,
  email: string,
  run: () => Promise<T>,
): Promise<T> {
  return c.var.db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`sign-in-code:${email}`}, 0))`,
    );
    return run();
  });
}

/** `withCodeLock` around Better Auth's handling of a sign-in. Must run after `withDatabase`. */
export const serializeCodeChecks = createMiddleware<AppEnv>(async (c, next) => {
  const email = await readAuthEmail(c);
  if (email === null) return next();
  await withCodeLock(c, email, () => next());
});
