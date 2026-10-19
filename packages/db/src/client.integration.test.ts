import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "./client";

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Start Postgres with `docker compose up -d`.");
}

const { db, close } = createDb(url, { maxConnections: 1 });
afterAll(close);

describe("database client", () => {
  it("runs a query against Postgres", async () => {
    const rows = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    expect(rows[0]?.ok).toBe(1);
  });
});
