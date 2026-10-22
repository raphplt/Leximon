import type { Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export interface DbOptions {
  /** Pool size. Keep it small: on Workers, Hyperdrive does the real pooling. */
  readonly maxConnections?: number;
  /** Receives every query; used by tests to keep the number of round trips in check. */
  readonly logger?: Logger;
}

/**
 * Creates a database client (node-postgres).
 *
 * On Cloudflare Workers, create one per request from the Hyperdrive connection string and
 * close it when the request ends: connections must not outlive a request (stateless API).
 */
export function createDb(connectionString: string, options: DbOptions = {}) {
  const pool = new pg.Pool({ connectionString, max: options.maxConnections ?? 5 });
  const db = drizzle(pool, {
    schema,
    casing: "snake_case",
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  return { db, close: () => pool.end() };
}

export type Database = ReturnType<typeof createDb>["db"];
