import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { applySetCookies, signInAsGuest } from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });

afterAll(close);

function wallet(cookie: string) {
  return app.request("/me/wallet", { headers: { origin: TEST_ORIGIN, cookie } }, env);
}

describe("session cookie cache", () => {
  it("is set again by an authenticated request, then spares the session lookup", async () => {
    const guest = await signInAsGuest(app, env);
    // Only the session token, as a browser holds it once the cache has expired.
    const tokenOnly = guest.cookie
      .split("; ")
      .filter((pair) => !pair.includes("session_data"))
      .join("; ");

    const first = await wallet(tokenOnly);
    expect(first.status).toBe(200);
    const refreshed = applySetCookies(tokenOnly, first);
    expect(refreshed).toContain("session_data");

    // The session row is gone: only the signed cache can still let the next request in.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, guest.userId));
    expect((await wallet(refreshed)).status).toBe(200);
    expect((await wallet(tokenOnly)).status).toBe(401);
  });
});
