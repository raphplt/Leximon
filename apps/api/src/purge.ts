import type { Database } from "@leximon/db";
import { type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** Rows per statement: each one a short transaction, however much piled up. */
export const PURGE_BATCH_ROWS = 5_000;

/** Runs a statement bounded to `limit` rows until it touches fewer; returns how many it touched. */
export async function inBatches(
  statement: (limit: number) => Promise<{ readonly rowCount: number | null }>,
  limit = PURGE_BATCH_ROWS,
): Promise<number> {
  let total = 0;
  for (;;) {
    const touched = (await statement(limit)).rowCount ?? 0;
    total += touched;
    if (touched < limit) return total;
  }
}

/** Deletes the rows of `table` that match `where`, a batch at a time, and counts them. */
export function purgeRows(
  db: Database,
  table: PgTable,
  where: SQL,
  limit = PURGE_BATCH_ROWS,
): Promise<number> {
  return inBatches(
    (batch) =>
      db.execute(sql`delete from ${table} where ctid = any(array(
        select ctid from ${table} where ${where} limit ${batch}))`),
    limit,
  );
}
