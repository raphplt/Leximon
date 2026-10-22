import { joinWaitlistRequestSchema } from "@leximon/contract";
import { type Database, schema } from "@leximon/db";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { isWaitlistClosed, lockWaitlist } from "./closure";

/** The waiting list before the public beta. Public: no session needed. Must run after `withDatabase`. */
export function waitlistRoutes() {
  const routes = new Hono<AppEnv>();

  routes.post("/", async (c) => {
    const body = joinWaitlistRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const result = await joinWaitlist(c.var.db, body.data.email);
    // The game is open: the list no longer takes addresses.
    if (result === "closed") return c.json({ error: "waitlist_closed" }, 410);
    // The same answer for a new address and a known one: nobody learns who signed up.
    return c.body(null, 204);
  });

  return routes;
}

/**
 * Idempotent: the address is the key, and signing up again keeps the first date. Refused once the
 * opening e-mail is launched, under the lock the launch takes (`closure.ts`).
 */
export async function joinWaitlist(db: Database, email: string): Promise<"joined" | "closed"> {
  return db.transaction(async (tx) => {
    await lockWaitlist(tx, "shared");
    if (await isWaitlistClosed(tx)) return "closed";
    await tx.insert(schema.waitlistSignups).values({ email }).onConflictDoNothing();
    return "joined";
  });
}
