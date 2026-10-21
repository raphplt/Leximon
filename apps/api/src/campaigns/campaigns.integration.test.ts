import {
  adminCampaignAudienceSchema,
  adminCampaignPreviewSchema,
  adminCampaignSchema,
  adminCampaignsResponseSchema,
  adminWaitlistResponseSchema,
  emailPreferencesSchema,
  IDEMPOTENCY_KEY_HEADER,
} from "@leximon/contract";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { runMaintenance } from "../maintenance";
import { TEST_LINK_SECRET, TEST_ORIGIN, TEST_WEBHOOK_SECRET, testEnv } from "../test-env";
import { type Guest, signInAsGuest, signInAsMember } from "../test-support";
import {
  type CampaignJob,
  type CampaignQueue,
  type DeliveryConfig,
  deliverCampaignJob,
  MAX_ATTEMPTS,
  pumpCampaigns,
  STALE_CLAIM_MS,
} from "./delivery";
import type { BatchOutcome, CampaignMailer, CampaignMessage } from "./mailer";
import { createUnsubscribeSigner } from "./signatures";

const url = testDatabaseUrl();
const env = testEnv(url);
const { db, close } = createDb(url, { maxConnections: 8 });

const {
  adminActions,
  emailCampaignSends: sends,
  emailCampaigns: campaigns,
  emailConsents,
  emailSuppressions,
  users,
  waitlistSignups,
} = schema;

/** Records every message handed to the provider; the next outcomes can be scripted. */
function fakeMailer() {
  const sent: CampaignMessage[] = [];
  const script: BatchOutcome[] = [];
  const mailer: CampaignMailer = {
    async sendBatch(messages) {
      const next = script.shift();
      if (next === undefined || next.kind === "accepted") {
        sent.push(...messages);
        return { kind: "accepted", messageIds: messages.map((m) => `msg-${m.sendId}`) };
      }
      if (next.kind === "partial") sent.push(...messages.slice(0, next.failedIndex));
      return next;
    },
  };
  return { mailer, sent, script };
}

function fakeQueue() {
  const jobs: CampaignJob[] = [];
  const queue: CampaignQueue = {
    async sendBatch(messages) {
      for (const message of messages) jobs.push(message.body);
    },
  };
  return { queue, jobs };
}

const provider = fakeMailer();
const app = createApp({ campaignMailer: () => provider.mailer });
const config: DeliveryConfig = {
  linkSecret: TEST_LINK_SECRET,
  webUrl: "https://leximon.fr",
  apiUrl: "https://api.leximon.fr",
};

let admin: Guest;
let adminEmail: string;

beforeAll(async () => {
  admin = await signInAsMember(app, env, db);
  adminEmail = `admin-${crypto.randomUUID().slice(0, 8)}@example.com`;
  await db
    .update(users)
    .set({ role: "admin", email: adminEmail })
    .where(eq(users.id, admin.userId));
});

afterAll(async () => {
  // A launched waiting list campaign closes the list for every other test file.
  await db.delete(campaigns).where(eq(campaigns.audience, "waitlist"));
  await close();
});

function request(who: Guest | null, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", TEST_ORIGIN);
  headers.set("content-type", "application/json");
  if (who !== null) headers.set("cookie", who.cookie);
  return app.request(path, { ...init, headers }, env);
}

const post = (who: Guest | null, path: string, body?: unknown, headers: HeadersInit = {}) =>
  request(who, path, {
    method: "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const draft = (overrides: Record<string, unknown> = {}) => ({
  name: "Ouverture",
  subject: "Leximon ouvre",
  bodyMarkdown: "Le jeu est **ouvert**.",
  buttonLabel: "Ouvrir un pli",
  buttonUrl: "https://leximon.fr/jouer",
  audience: "test",
  testRecipients: ["a@example.com", "b@example.com"],
  ratePerMinute: 1000,
  ...overrides,
});

async function createCampaign(overrides: Record<string, unknown> = {}) {
  const response = await post(admin, "/admin/campaigns", draft(overrides));
  expect(response.status).toBe(201);
  return adminCampaignSchema.parse(await response.json());
}

async function audienceOf(id: string): Promise<number> {
  const response = await request(admin, `/admin/campaigns/${id}/audience`);
  expect(response.status).toBe(200);
  return adminCampaignAudienceSchema.parse(await response.json()).recipients;
}

function launch(
  id: string,
  expectedRecipients: number,
  scheduledAt: string | null = null,
  key = crypto.randomUUID(),
) {
  return post(
    admin,
    `/admin/campaigns/${id}/launch`,
    { expectedRecipients, scheduledAt },
    {
      [IDEMPOTENCY_KEY_HEADER]: key,
    },
  );
}

/** A campaign already sending, with `count` recipients, written straight to the database. */
async function sendingCampaign(count: number, ratePerMinute = 1000) {
  const [campaign] = await db
    .insert(campaigns)
    .values({
      name: "Charge",
      subject: "Charge",
      bodyMarkdown: "Bonjour.",
      audience: "test",
      status: "sending",
      ratePerMinute,
      recipientCount: count,
      createdBy: admin.userId,
      launchedBy: admin.userId,
      launchedAt: new Date(),
    })
    .returning({ id: campaigns.id });
  if (campaign === undefined) throw new Error("no campaign");
  const tag = crypto.randomUUID().slice(0, 8);
  await db.insert(sends).values(
    Array.from({ length: count }, (_, i) => ({
      campaignId: campaign.id,
      email: `charge-${tag}-${i}@example.com`,
    })),
  );
  return campaign.id;
}

async function statusesOf(campaignId: string) {
  const rows = await db
    .select({ status: sends.status })
    .from(sends)
    .where(eq(sends.campaignId, campaignId));
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}

/** Pumps, then delivers every queued message, until nothing is left waiting. */
async function sendAll(campaignId: string) {
  for (let round = 0; round < 20; round += 1) {
    const { queue, jobs } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());
    const mine = jobs.filter((job) => job.campaignId === campaignId);
    if (mine.length === 0) return;
    for (const job of mine) await deliverCampaignJob(db, provider.mailer, config, job, Date.now());
  }
  throw new Error("campaign did not drain");
}

describe("campaign drafts", () => {
  it("creates, edits and previews a draft, admins only", async () => {
    const player = await signInAsMember(app, env, db);
    expect((await post(player, "/admin/campaigns", draft())).status).toBe(403);

    const created = await createCampaign();
    expect(created.status).toBe("draft");
    expect(created.testRecipients).toEqual(["a@example.com", "b@example.com"]);

    const edited = await post(
      admin,
      `/admin/campaigns/${created.id}`,
      draft({ subject: "Ça ouvre" }),
    );
    expect(edited.status).toBe(200);
    expect(adminCampaignSchema.parse(await edited.json()).subject).toBe("Ça ouvre");

    const list = adminCampaignsResponseSchema.parse(
      await (await request(admin, "/admin/campaigns")).json(),
    );
    expect(list.campaigns.some((campaign) => campaign.id === created.id)).toBe(true);

    const preview = await post(admin, "/admin/campaigns/preview", {
      subject: "Ça ouvre",
      bodyMarkdown: "Le jeu est **ouvert**.",
      buttonLabel: null,
      buttonUrl: null,
    });
    const email = adminCampaignPreviewSchema.parse(await preview.json());
    expect(email.html).toContain("<strong>ouvert</strong>");
    expect(email.text).toContain("Ne plus recevoir ces e-mails");
  });

  it("refuses a half button and a test audience without addresses", async () => {
    expect((await post(admin, "/admin/campaigns", draft({ buttonUrl: null }))).status).toBe(400);
    expect((await post(admin, "/admin/campaigns", draft({ testRecipients: [] }))).status).toBe(400);
    expect(
      (await post(admin, "/admin/campaigns", draft({ buttonUrl: "http://leximon.fr" }))).status,
    ).toBe(400);
  });

  it("sends a test to the admin's own address only", async () => {
    const before = provider.sent.length;
    const response = await post(admin, "/admin/campaigns/test", {
      subject: "Essai",
      bodyMarkdown: "Bonjour.",
      buttonLabel: null,
      buttonUrl: null,
    });
    expect(response.status).toBe(200);
    const sent = provider.sent.slice(before);
    expect(sent.map((message) => [message.to, message.subject])).toEqual([
      [adminEmail, "[Test] Essai"],
    ]);
    expect(sent[0]?.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("campaign launch", () => {
  it("launches only with the exact recipient count, once, and logs it", async () => {
    const created = await createCampaign({
      testRecipients: ["c@example.com", "d@example.com", "e@example.com"],
    });
    await db
      .insert(emailSuppressions)
      .values({ email: "e@example.com", reason: "manual", source: "test" })
      .onConflictDoNothing();
    expect(await audienceOf(created.id)).toBe(2);

    const wrong = await launch(created.id, 3);
    expect(wrong.status).toBe(409);
    expect(await wrong.json()).toEqual({ error: "recipient_count_changed", recipients: 2 });

    const key = crypto.randomUUID();
    const launched = await launch(created.id, 2, null, key);
    expect(launched.status).toBe(200);
    const campaign = adminCampaignSchema.parse(await launched.json());
    expect(campaign.status).toBe("sending");
    expect(campaign.recipientCount).toBe(2);
    expect(campaign.counts.waiting).toBe(2);

    // Same key: the first answer, not a second list of recipients.
    expect((await launch(created.id, 2, null, key)).status).toBe(200);
    expect((await launch(created.id, 2)).status).toBe(409);
    const rows = await db
      .select({ email: sends.email })
      .from(sends)
      .where(eq(sends.campaignId, created.id));
    expect(rows.map((row) => row.email).sort()).toEqual(["c@example.com", "d@example.com"]);

    const logged = await db
      .select({ details: adminActions.details })
      .from(adminActions)
      .where(
        and(eq(adminActions.adminId, admin.userId), eq(adminActions.action, "launch_campaign")),
      );
    expect(logged.filter((row) => row.details["campaignId"] === created.id)).toHaveLength(1);

    // Drafts only: a launched campaign no longer changes.
    expect((await post(admin, `/admin/campaigns/${created.id}`, draft())).status).toBe(409);
    await db.update(campaigns).set({ status: "cancelled" }).where(eq(campaigns.id, created.id));
  });

  it("schedules a launch, and the pump starts it when due", async () => {
    const created = await createCampaign({ testRecipients: ["plus-tard@example.com"] });
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const launched = adminCampaignSchema.parse(await (await launch(created.id, 1, at)).json());
    expect(launched.status).toBe("scheduled");

    const { queue, jobs } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());
    expect(jobs.filter((job) => job.campaignId === created.id)).toHaveLength(0);
    await db
      .update(campaigns)
      .set({ scheduledAt: new Date(Date.now() - 1000) })
      .where(eq(campaigns.id, created.id));
    await pumpCampaigns(db, queue, Date.now());
    expect(jobs.filter((job) => job.campaignId === created.id)).toHaveLength(1);
    await db.update(campaigns).set({ status: "cancelled" }).where(eq(campaigns.id, created.id));
  });

  it("writes to consenting members only (P61)", async () => {
    const created = await createCampaign({ audience: "players", testRecipients: [] });
    const before = await audienceOf(created.id);

    const guest = await signInAsGuest(app, env);
    expect(
      (await post(guest, "/me/email-preferences", { newsOptIn: true, source: "signup" })).status,
    ).toBe(403);

    const member = await signInAsMember(app, env, db);
    await db
      .update(users)
      .set({ email: `membre-${crypto.randomUUID().slice(0, 8)}@example.com` })
      .where(eq(users.id, member.userId));
    const optIn = await post(member, "/me/email-preferences", {
      newsOptIn: true,
      source: "signup",
    });
    expect(emailPreferencesSchema.parse(await optIn.json())).toEqual({ newsOptIn: true });
    expect(await audienceOf(created.id)).toBe(before + 1);

    const read = await request(member, "/me/email-preferences");
    expect(emailPreferencesSchema.parse(await read.json())).toEqual({ newsOptIn: true });

    await post(member, "/me/email-preferences", { newsOptIn: false, source: "settings" });
    expect(await audienceOf(created.id)).toBe(before);
    const [consent] = await db
      .select()
      .from(emailConsents)
      .where(eq(emailConsents.userId, member.userId));
    expect(consent?.grantedSource).toBe("signup");
    expect(consent?.revokedSource).toBe("settings");
  });
});

describe("campaign delivery", () => {
  it("sends every recipient exactly once despite concurrent pumps and replayed messages", async () => {
    const campaignId = await sendingCampaign(250, 120);
    const before = provider.sent.length;

    for (let round = 0; round < 5; round += 1) {
      const first = fakeQueue();
      const second = fakeQueue();
      await Promise.all([
        pumpCampaigns(db, first.queue, Date.now()),
        pumpCampaigns(db, second.queue, Date.now()),
      ]);
      const jobs = [...first.jobs, ...second.jobs].filter((job) => job.campaignId === campaignId);
      const queuedIds = jobs.flatMap((job) => job.sendIds);
      expect(new Set(queuedIds).size).toBe(queuedIds.length);
      expect(queuedIds.length).toBeLessThanOrEqual(120);
      // Every message delivered twice, at the same time: the queue's at-least-once worst case.
      await Promise.all(
        [...jobs, ...jobs].map((job) =>
          deliverCampaignJob(db, provider.mailer, config, job, Date.now()),
        ),
      );
    }

    const sent = provider.sent.slice(before);
    const keys = sent.map((message) => message.idempotencyKey);
    expect(keys).toHaveLength(250);
    expect(new Set(keys).size).toBe(250);
    expect(await statusesOf(campaignId)).toEqual({ sent: 250 });
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    expect(row?.status).toBe("completed");
  });

  it("puts each e-mail's own signed unsubscribe link in its body and headers", async () => {
    const campaignId = await sendingCampaign(2);
    const before = provider.sent.length;
    await sendAll(campaignId);
    const sent = provider.sent.slice(before);
    expect(sent).toHaveLength(2);
    for (const message of sent) {
      const token = await createUnsubscribeSigner(TEST_LINK_SECRET)(message.sendId);
      expect(message.headers["List-Unsubscribe"]).toBe(
        `<https://api.leximon.fr/email/unsubscribe/${token}>`,
      );
      expect(message.text).toContain(`https://leximon.fr/desinscription/${token}`);
      expect(message.html).not.toContain(message.to);
    }
  });

  it("skips addresses suppressed after the launch", async () => {
    const campaignId = await sendingCampaign(3);
    const [first] = await db
      .select({ email: sends.email })
      .from(sends)
      .where(eq(sends.campaignId, campaignId))
      .limit(1);
    await db
      .insert(emailSuppressions)
      .values({ email: first?.email ?? "", reason: "unsubscribed", source: "test" });
    await sendAll(campaignId);
    expect(await statusesOf(campaignId)).toEqual({ sent: 2, suppressed: 1 });
  });

  it("waits after a rate limit and gives up after the last attempt", async () => {
    const campaignId = await sendingCampaign(1);
    provider.script.push({ kind: "retry_later", code: "RATE_LIMITED", retryAfterS: 120 });
    const { queue, jobs } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());
    for (const job of jobs.filter((j) => j.campaignId === campaignId)) {
      await deliverCampaignJob(db, provider.mailer, config, job, Date.now());
    }
    const [row] = await db.select().from(sends).where(eq(sends.campaignId, campaignId));
    expect(row?.status).toBe("pending");
    expect(row?.attempts).toBe(1);
    expect(row?.lastError).toBe("RATE_LIMITED");

    // On hold: nothing leaves before the provider's delay.
    const held = fakeQueue();
    await pumpCampaigns(db, held.queue, Date.now());
    expect(held.jobs.filter((j) => j.campaignId === campaignId)).toHaveLength(0);

    await db
      .update(sends)
      .set({ attempts: MAX_ATTEMPTS - 1 })
      .where(eq(sends.campaignId, campaignId));
    await db.update(campaigns).set({ holdUntil: null }).where(eq(campaigns.id, campaignId));
    provider.script.push({ kind: "retry_later", code: "RATE_LIMITED", retryAfterS: null });
    await sendAll(campaignId);
    expect(await statusesOf(campaignId)).toEqual({ failed: 1 });
  });

  it("records a batch that stopped halfway", async () => {
    const campaignId = await sendingCampaign(3);
    provider.script.push({
      kind: "partial",
      accepted: [{ index: 0, messageId: "m0" }],
      failedIndex: 1,
      code: "INVALID",
    });
    const { queue, jobs } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());
    for (const job of jobs.filter((j) => j.campaignId === campaignId)) {
      await deliverCampaignJob(db, provider.mailer, config, job, Date.now());
    }
    expect(await statusesOf(campaignId)).toEqual({ sent: 1, failed: 1, pending: 1 });
    await sendAll(campaignId);
    expect(await statusesOf(campaignId)).toEqual({ sent: 2, failed: 1 });
  });

  it("pauses the campaign when the provider refuses the key", async () => {
    const campaignId = await sendingCampaign(2);
    provider.script.push({ kind: "blocked", code: "http_401" });
    const { queue, jobs } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());
    for (const job of jobs.filter((j) => j.campaignId === campaignId)) {
      await deliverCampaignJob(db, provider.mailer, config, job, Date.now());
    }
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    expect(row?.status).toBe("paused");
    expect(await statusesOf(campaignId)).toEqual({ pending: 2 });
  });

  it("puts back rows whose claim went stale", async () => {
    const campaignId = await sendingCampaign(1);
    await db
      .update(sends)
      .set({ status: "sending", claimedAt: new Date(Date.now() - STALE_CLAIM_MS - 1000) })
      .where(eq(sends.campaignId, campaignId));
    await sendAll(campaignId);
    expect(await statusesOf(campaignId)).toEqual({ sent: 1 });
  });

  it("pauses, resumes and cancels from the back office", async () => {
    const campaignId = await sendingCampaign(3);
    const { queue } = fakeQueue();
    await pumpCampaigns(db, queue, Date.now());

    const paused = await post(admin, `/admin/campaigns/${campaignId}/pause`);
    expect(adminCampaignSchema.parse(await paused.json()).status).toBe("paused");
    expect(await statusesOf(campaignId)).toEqual({ pending: 3 });
    expect((await post(admin, `/admin/campaigns/${campaignId}/pause`)).status).toBe(409);

    const resumed = await post(admin, `/admin/campaigns/${campaignId}/resume`);
    expect(adminCampaignSchema.parse(await resumed.json()).status).toBe("sending");

    const cancelled = adminCampaignSchema.parse(
      await (await post(admin, `/admin/campaigns/${campaignId}/cancel`)).json(),
    );
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.counts.cancelled).toBe(3);
    const actions = await db
      .select({ action: adminActions.action })
      .from(adminActions)
      .where(
        inArray(adminActions.action, ["pause_campaign", "resume_campaign", "cancel_campaign"]),
      );
    expect(actions.length).toBeGreaterThanOrEqual(3);
  });

  it("erases the addresses 30 days after the campaign ends", async () => {
    const campaignId = await sendingCampaign(1);
    await sendAll(campaignId);
    await runMaintenance(db, Date.now() + 31 * 86_400_000);
    const [row] = await db
      .select({ email: sends.email })
      .from(sends)
      .where(eq(sends.campaignId, campaignId));
    expect(row?.email).toBeNull();
  });
});

describe("unsubscribe", () => {
  async function sentRow() {
    const campaignId = await sendingCampaign(1);
    await sendAll(campaignId);
    const [row] = await db.select().from(sends).where(eq(sends.campaignId, campaignId));
    if (row === undefined) throw new Error("no row");
    return row;
  }

  it("unsubscribes in one click, idempotently, and withdraws consent", async () => {
    const member = await signInAsMember(app, env, db);
    await post(member, "/me/email-preferences", { newsOptIn: true, source: "settings" });
    const row = await sentRow();
    await db.update(sends).set({ userId: member.userId }).where(eq(sends.id, row.id));
    const token = await createUnsubscribeSigner(TEST_LINK_SECRET)(row.id);

    // A GET (a link scanner, a preview) shows the page and changes nothing.
    const page = await request(null, `/email/unsubscribe/${token}`);
    expect(page.status).toBe(303);
    expect(page.headers.get("location")).toBe(`http://localhost:3000/desinscription/${token}`);
    expect(
      await db
        .select()
        .from(emailSuppressions)
        .where(eq(emailSuppressions.email, row.email ?? "")),
    ).toHaveLength(0);

    for (let i = 0; i < 2; i += 1) {
      const response = await post(null, `/email/unsubscribe/${token}`, undefined, {
        "content-type": "application/x-www-form-urlencoded",
      });
      expect(response.status).toBe(200);
    }
    const [suppression] = await db
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, row.email ?? ""));
    expect(suppression?.reason).toBe("unsubscribed");
    const [consent] = await db
      .select()
      .from(emailConsents)
      .where(eq(emailConsents.userId, member.userId));
    expect(consent?.revokedSource).toBe("unsubscribe_link");
    const [after] = await db.select().from(sends).where(eq(sends.id, row.id));
    expect(after?.unsubscribedAt).not.toBeNull();
  });

  it("lifts a past unsubscribe when the player opts in again, not a bounce", async () => {
    const member = await signInAsMember(app, env, db);
    const email = `retour-${crypto.randomUUID().slice(0, 8)}@example.com`;
    await db.update(users).set({ email }).where(eq(users.id, member.userId));
    await db.insert(emailSuppressions).values({ email, reason: "unsubscribed", source: "test" });
    await post(member, "/me/email-preferences", { newsOptIn: true, source: "settings" });
    expect(
      await db.select().from(emailSuppressions).where(eq(emailSuppressions.email, email)),
    ).toHaveLength(0);

    await db.insert(emailSuppressions).values({ email, reason: "hard_bounce", source: "test" });
    await post(member, "/me/email-preferences", { newsOptIn: true, source: "settings" });
    expect(
      await db.select().from(emailSuppressions).where(eq(emailSuppressions.email, email)),
    ).toHaveLength(1);
  });

  it("refuses a forged token", async () => {
    const row = await sentRow();
    const forged = `${row.id}.${"A".repeat(43)}`;
    expect((await post(null, `/email/unsubscribe/${forged}`)).status).toBe(400);
    expect((await post(null, "/email/unsubscribe/pas-un-jeton")).status).toBe(400);
  });
});

describe("Lettermint webhook", () => {
  async function deliver(body: unknown, secret = TEST_WEBHOOK_SECRET) {
    const raw = JSON.stringify(body);
    const t = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
    const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
    return app.request(
      "/email/webhooks/lettermint",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-lettermint-signature": `t=${t},v1=${hex}`,
          "x-lettermint-delivery": String(t),
        },
        body: raw,
      },
      env,
    );
  }

  it("records a hard bounce on its row and suppresses the address, once", async () => {
    const campaignId = await sendingCampaign(1);
    await sendAll(campaignId);
    const [row] = await db.select().from(sends).where(eq(sends.campaignId, campaignId));
    const event = {
      id: "evt-1",
      event: "message.hard_bounced",
      data: { message_id: row?.providerMessageId, metadata: { send_id: row?.id } },
    };

    for (let i = 0; i < 2; i += 1) {
      const response = await deliver(event);
      expect(response.status).toBe(200);
    }
    expect(await statusesOf(campaignId)).toEqual({ bounced: 1 });
    const [suppression] = await db
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, row?.email ?? ""));
    expect(suppression?.reason).toBe("hard_bounce");
    expect(suppression?.source).toBe("lettermint_webhook");
  });

  it("finds a complaint by the provider's message id", async () => {
    const campaignId = await sendingCampaign(1);
    await sendAll(campaignId);
    const [row] = await db.select().from(sends).where(eq(sends.campaignId, campaignId));
    const response = await deliver({
      id: "evt-2",
      event: "message.spam_complaint",
      data: { message_id: row?.providerMessageId },
    });
    expect(await response.json()).toEqual({ result: "applied" });
    expect(await statusesOf(campaignId)).toEqual({ complained: 1 });
  });

  it("refuses an unsigned or wrongly signed delivery, and ignores other events", async () => {
    const event = { id: "evt-3", event: "message.hard_bounced", data: {} };
    expect((await deliver(event, "wrong-secret")).status).toBe(401);
    const unsigned = await app.request(
      "/email/webhooks/lettermint",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      },
      env,
    );
    expect(unsigned.status).toBe(401);
    expect(await (await deliver({ id: "evt-4", event: "message.opened" })).json()).toEqual({
      result: "ignored",
    });
  });
});

describe("the waiting list's opening e-mail (P55)", () => {
  it("closes the list at launch, is sent once, then erases the addresses", async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    await db
      .insert(waitlistSignups)
      .values([
        { email: `attente-${tag}-1@example.com` },
        { email: `attente-${tag}-2@example.com` },
      ])
      .onConflictDoNothing();
    const created = await createCampaign({ audience: "waitlist", testRecipients: [] });
    const recipients = await audienceOf(created.id);

    // Sign-ups racing the launch: each one either made it into the list or was refused.
    const racing = Array.from({ length: 10 }, (_, i) => `course-${tag}-${i}@example.com`);
    const [launched, ...joins] = await Promise.all([
      launch(created.id, recipients),
      ...racing.map((email) => post(null, "/waitlist", { email })),
    ]);
    if (launched?.status === 409) {
      // Sign-ups landed first: the admin confirms the new number.
      const again = await launch(created.id, await audienceOf(created.id));
      expect(again.status).toBe(200);
    } else {
      expect(launched?.status).toBe(200);
    }
    const copied = new Set(
      (
        await db.select({ email: sends.email }).from(sends).where(eq(sends.campaignId, created.id))
      ).map((r) => r.email),
    );
    joins.forEach((response, i) => {
      const email = racing[i] ?? "";
      if (response.status === 204) expect(copied.has(email)).toBe(true);
      else expect(response.status).toBe(410);
    });

    expect((await post(null, "/waitlist", { email: `tard-${tag}@example.com` })).status).toBe(410);
    expect(
      (await post(admin, "/admin/campaigns", draft({ audience: "waitlist", testRecipients: [] })))
        .status,
    ).toBe(409);

    const waitlist = adminWaitlistResponseSchema.parse(
      await (await request(admin, "/admin/waitlist")).json(),
    );
    expect(waitlist.opening).toMatchObject({
      campaignId: created.id,
      closed: true,
      erasedAt: null,
    });

    // Not before it has left.
    expect(
      (await post(admin, "/admin/waitlist/erase", { expectedCount: waitlist.total })).status,
    ).toBe(409);
    await sendAll(created.id);

    const wrong = await post(admin, "/admin/waitlist/erase", { expectedCount: waitlist.total + 1 });
    expect(await wrong.json()).toEqual({ error: "count_changed", count: waitlist.total });
    const erased = await post(admin, "/admin/waitlist/erase", { expectedCount: waitlist.total });
    expect(await erased.json()).toEqual({ erased: waitlist.total });

    expect(await db.select().from(waitlistSignups)).toHaveLength(0);
    const leftover = await db
      .select({ email: sends.email })
      .from(sends)
      .where(eq(sends.campaignId, created.id));
    expect(leftover.every((row) => row.email === null)).toBe(true);
    const after = adminWaitlistResponseSchema.parse(
      await (await request(admin, "/admin/waitlist")).json(),
    );
    expect(after.opening?.erasedAt).not.toBeNull();
  });
});
