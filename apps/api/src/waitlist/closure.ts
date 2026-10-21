import { type Database, schema } from "@leximon/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";

/**
 * The waiting list closes when its opening e-mail is launched (P55). Signing up and launching share
 * an advisory lock, so that no address can arrive between the frozen recipient list and the
 * closure, and be kept without ever getting the e-mail.
 */

type Executor = Pick<Database, "execute" | "select">;

/** Taken shared by each sign-up, exclusive by the launch and the erasure. Released at commit. */
export async function lockWaitlist(tx: Executor, mode: "shared" | "exclusive"): Promise<void> {
  await tx.execute(
    mode === "shared"
      ? sql`select pg_advisory_xact_lock_shared(hashtextextended('waitlist', 0))`
      : sql`select pg_advisory_xact_lock(hashtextextended('waitlist', 0))`,
  );
}

/** Closed once a campaign to the list has been launched, whatever became of it since. */
export async function isWaitlistClosed(tx: Executor): Promise<boolean> {
  const { emailCampaigns } = schema;
  const [launched] = await tx
    .select({ id: emailCampaigns.id })
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.audience, "waitlist"), isNotNull(emailCampaigns.launchedAt)))
    .limit(1);
  return launched !== undefined;
}
