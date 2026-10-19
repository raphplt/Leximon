import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface DbOptions {
  /** Pool size. Keep it small: on Workers, Hyperdrive does the real pooling. */
  readonly maxConnections?: number;
}

/**
 * Creates a database client.
 *
 * On Cloudflare Workers, create one per request from the Hyperdrive connection string and
 * close it when the request ends: connections must not outlive a request (stateless API).
 */
export function createDb(connectionString: string, options: DbOptions = {}) {
  const client = postgres(connectionString, {
    max: options.maxConnections ?? 5,
    // Skips a type-discovery round trip on every new connection.
    fetch_types: false,
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  return { db, close: () => client.end() };
}

export type Database = ReturnType<typeof createDb>["db"];
