import { analyticsMessageSchema, experimentsResponseSchema } from "@leximon/contract";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { recordingQueue, TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, signInAsGuest } from "../test-support";
import { storeAnalytics } from "./store";
import { analyticsSubject } from "./subject";

const url = testDatabaseUrl();
const queue = recordingQueue();
const env = testEnv(url, queue);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 1 });
afterAll(close);

const at = new Date().toISOString();

function postEvents(guest: Guest | null, body: unknown) {
  const headers: Record<string, string> = {
    origin: TEST_ORIGIN,
    "content-type": "application/json",
  };
  if (guest !== null) headers["cookie"] = guest.cookie;
  return app.request("/events", { method: "POST", headers, body: JSON.stringify(body) }, env);
}

describe("GET /me/experiments", () => {
  it("gives the player a variant of the pack shape, the same on every call", async () => {
    const guest = await signInAsGuest(app, env);
    const read = async () => {
      const response = await app.request(
        "/me/experiments",
        { headers: { origin: TEST_ORIGIN, cookie: guest.cookie } },
        env,
      );
      expect(response.status).toBe(200);
      return experimentsResponseSchema.parse(await response.json()).variants;
    };
    const first = await read();
    expect(["pli", "sachet"]).toContain(first["pack-shape"]);
    expect(await read()).toEqual(first);
  });
});

describe("POST /events", () => {
  it("queues the events under a pseudonym, with the variants computed by the server", async () => {
    const guest = await signInAsGuest(app, env);
    const sentBefore = queue.sent.length;
    const response = await postEvents(guest, {
      events: [
        { name: "page_viewed", page: "boosters", at },
        { name: "opening_started", shape: "sachet", via: "tear", at },
      ],
    });
    expect(response.status).toBe(202);
    const message = analyticsMessageSchema.parse(queue.sent[sentBefore]);
    expect(message.subject).toBe(await analyticsSubject("test-analytics-secret", guest.userId));
    expect(message.subject).not.toContain(guest.userId);
    expect(["pli", "sachet"]).toContain(message.variants["pack-shape"]);
    expect(message.events).toHaveLength(2);
  });

  it("refuses events outside the contract and anonymous callers", async () => {
    const guest = await signInAsGuest(app, env);
    const sentBefore = queue.sent.length;
    expect(
      (await postEvents(guest, { events: [{ name: "free_text", text: "hi", at }] })).status,
    ).toBe(400);
    expect((await postEvents(guest, { events: [] })).status).toBe(400);
    expect(
      (await postEvents(null, { events: [{ name: "page_viewed", page: "album", at }] })).status,
    ).toBe(401);
    expect(queue.sent.length).toBe(sentBefore);
  });
});

describe("storeAnalytics", () => {
  it("writes every event of valid messages in one go and drops invalid ones", async () => {
    const subject = "0123456789abcdef0123456789abcdef";
    const report = await storeAnalytics(db, [
      {
        subject,
        variants: { "pack-shape": "pli" },
        receivedAt: at,
        events: [
          { name: "opening_started", shape: "pli", via: "touch", at },
          {
            name: "opening_finished",
            shape: "pli",
            revealed: "all_at_once",
            durationMs: 4200,
            at,
          },
        ],
      },
      { subject: "not-a-subject", variants: {}, receivedAt: at, events: [] },
    ]);
    expect(report).toEqual({ stored: 2, rejected: 1 });
    const rows = await db
      .select()
      .from(schema.analyticsEvents)
      .where(eq(schema.analyticsEvents.subject, subject));
    expect(rows.map((row) => row.name).sort()).toEqual(["opening_finished", "opening_started"]);
    const finished = rows.find((row) => row.name === "opening_finished");
    expect(finished?.props).toEqual({ shape: "pli", revealed: "all_at_once", durationMs: 4200 });
    expect(finished?.variants).toEqual({ "pack-shape": "pli" });
  });
});
