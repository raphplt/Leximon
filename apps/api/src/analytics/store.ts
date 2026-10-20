import { analyticsMessageSchema } from "@leximon/contract";
import { type Database, schema } from "@leximon/db";

export interface StoreReport {
  readonly stored: number;
  /** Messages that do not match the contract: dropped, since retrying would not fix them. */
  readonly rejected: number;
}

/**
 * Writes a batch of queued messages to the event log in one insert. Throws on a database
 * error, so that the queue delivers the batch again.
 */
export async function storeAnalytics(
  db: Database,
  bodies: readonly unknown[],
): Promise<StoreReport> {
  const rows: (typeof schema.analyticsEvents.$inferInsert)[] = [];
  let rejected = 0;
  for (const body of bodies) {
    const message = analyticsMessageSchema.safeParse(body);
    if (!message.success) {
      rejected += 1;
      continue;
    }
    const { subject, variants, receivedAt, events } = message.data;
    for (const { name, at, ...props } of events) {
      rows.push({
        subject,
        name,
        props,
        variants,
        occurredAt: new Date(at),
        receivedAt: new Date(receivedAt),
      });
    }
  }
  if (rows.length > 0) await db.insert(schema.analyticsEvents).values(rows);
  return { stored: rows.length, rejected };
}
