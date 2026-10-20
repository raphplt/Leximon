import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { count, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });

afterAll(close);

function join(body: unknown) {
  return app.request(
    "/waitlist",
    {
      method: "POST",
      headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

async function rowsFor(email: string) {
  return db.select().from(schema.waitlistSignups).where(eq(schema.waitlistSignups.email, email));
}

describe("POST /waitlist", () => {
  it("keeps the address, lowercase, without creating a player", async () => {
    const users = () => db.select({ total: count() }).from(schema.users);
    const [before] = await users();
    const response = await join({ email: "  Lectrice@Example.com " });

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await rowsFor("lectrice@example.com")).toHaveLength(1);
    expect(await users()).toEqual([before]);
  });

  it("answers the same for a known address and keeps the first date", async () => {
    const email = "deja-inscrit@example.com";
    expect((await join({ email })).status).toBe(204);
    const [first] = await rowsFor(email);

    expect((await join({ email: email.toUpperCase() })).status).toBe(204);
    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt).toEqual(first?.createdAt);
  });

  it("keeps one row when the same address arrives concurrently", async () => {
    const email = "double-clic@example.com";
    const responses = await Promise.all(Array.from({ length: 5 }, () => join({ email })));

    expect(responses.map((response) => response.status)).toEqual([204, 204, 204, 204, 204]);
    expect(await rowsFor(email)).toHaveLength(1);
  });

  it.each([{}, { email: "pas-une-adresse" }, { email: `${"a".repeat(250)}@example.com` }])(
    "refuses %j",
    async (body) => {
      const response = await join(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
    },
  );
});
