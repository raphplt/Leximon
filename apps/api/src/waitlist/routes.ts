import { joinWaitlistRequestSchema } from "@leximon/contract";
import { type Database, schema } from "@leximon/db";
import { Hono } from "hono";
import type { AppEnv } from "../context";

/** The waiting list before the public beta. Public: no session needed. Must run after `withDatabase`. */
export function waitlistRoutes() {
  const routes = new Hono<AppEnv>();

  routes.post("/", async (c) => {
    const body = joinWaitlistRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    await joinWaitlist(c.var.db, body.data.email);
    // The same answer for a new address and a known one: nobody learns who signed up.
    return c.body(null, 204);
  });

  return routes;
}

/** Idempotent: the address is the key, and signing up again keeps the first date. */
export async function joinWaitlist(db: Database, email: string): Promise<void> {
  await db.insert(schema.waitlistSignups).values({ email }).onConflictDoNothing();
}
