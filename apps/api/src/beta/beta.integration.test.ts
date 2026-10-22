import {
  ACCOUNT_ERROR_CODES,
  adminFeedbackResponseSchema,
  adminInviteSchema,
  adminMeasuresSchema,
  adminTestersResponseSchema,
  authErrorResponseSchema,
  INVITE_HEADER,
  inviteStatusSchema,
  linkPreviewResponseSchema,
  SOURCE_HEADER,
} from "@leximon/contract";
import { gameDayOf } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import {
  applySetCookies,
  createOutbox,
  type Guest,
  requestCode,
  seedTestCatalog,
  signInAsGuest,
} from "../test-support";

const url = testDatabaseUrl();
const openEnv = testEnv(url);
const env: Env = { ...openEnv, BETA_INVITES: "required" };
const outbox = createOutbox();
const app = createApp({ emailSender: outbox.emailSender });
const { db, close } = createDb(url, { maxConnections: 4 });

const { invites, playerAgeBrackets, playerDays, playerSignups, users } = schema;

let admin: Guest;

beforeAll(async () => {
  await seedTestCatalog(db);
  admin = await signInAsGuest(app, openEnv);
  await db.update(users).set({ role: "admin" }).where(eq(users.id, admin.userId));
});
afterAll(close);

function newEmail(): string {
  return `testeur-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { origin: TEST_ORIGIN, "content-type": "application/json", ...extra };
}

function guestSignIn(extra: Record<string, string> = {}, onEnv: Env = env) {
  return app.request(
    "/api/auth/sign-in/anonymous",
    { method: "POST", headers: headers(extra), body: "{}" },
    onEnv,
  );
}

async function errorCode(response: Response): Promise<string | null> {
  const body = authErrorResponseSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.code : null;
}

async function newInvite(maxUses: number, label = "Amis") {
  const response = await app.request(
    "/admin/invites",
    {
      method: "POST",
      headers: headers({ cookie: admin.cookie }),
      body: JSON.stringify({ label, maxUses }),
    },
    env,
  );
  expect(response.status).toBe(201);
  return adminInviteSchema.parse(await response.json());
}

function cookieOf(response: Response): string {
  return applySetCookies("", response);
}

function codeSignIn(input: {
  email: string;
  cookie: string | null;
  extra?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  return app.request(
    "/api/auth/sign-in/email-otp",
    {
      method: "POST",
      headers: headers({
        ...(input.cookie === null ? {} : { cookie: input.cookie }),
        ...input.extra,
      }),
      body: JSON.stringify({
        email: input.email,
        otp: outbox.codeFor(input.email),
        ageConfirmed: true,
        ...input.body,
      }),
    },
    env,
  );
}

async function userIdOf(response: Response): Promise<string> {
  return ((await response.json()) as { user: { id: string } }).user.id;
}

describe("closed beta", () => {
  it("refuses a guest without an invitation, and lets one in with it", async () => {
    const refused = await guestSignIn();
    expect(refused.status).toBe(403);
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.inviteRequired);

    const invite = await newInvite(5);
    const admitted = await guestSignIn({ [INVITE_HEADER]: invite.code, [SOURCE_HEADER]: "tiktok" });
    expect(admitted.status).toBe(200);
    const userId = await userIdOf(admitted);

    const [signup] = await db.select().from(playerSignups).where(eq(playerSignups.userId, userId));
    expect(signup).toMatchObject({ inviteId: invite.id, source: "tiktok" });
    const [row] = await db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.uses).toBe(1);
  });

  it("never lets in more players than an invitation has places, even all at once", async () => {
    const invite = await newInvite(3);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => guestSignIn({ [INVITE_HEADER]: invite.code })),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 200, 200, 403, 403, 403, 403, 403]);
    const [row] = await db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.uses).toBe(3);
  });

  it("closes a withdrawn invitation and says so on its page", async () => {
    const invite = await newInvite(5);
    const status = async (code: string) => {
      const response = await app.request(`/invites/${code}`, { headers: headers() }, env);
      return inviteStatusSchema.parse(await response.json()).status;
    };
    expect(await status(invite.code)).toBe("open");
    expect(await status("nope-nope")).toBe("unknown");

    const revoked = await app.request(
      `/admin/invites/${invite.id}/revoke`,
      { method: "POST", headers: headers({ cookie: admin.cookie }) },
      env,
    );
    expect(revoked.status).toBe(200);

    expect(await status(invite.code)).toBe("expired");
    const refused = await guestSignIn({ [INVITE_HEADER]: invite.code });
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.inviteClosed);
  });

  it("lets anyone in when invitations are off, and still notes the source", async () => {
    const response = await guestSignIn({ [SOURCE_HEADER]: "reddit" }, openEnv);
    expect(response.status).toBe(200);
    const userId = await userIdOf(response);
    const [signup] = await db.select().from(playerSignups).where(eq(playerSignups.userId, userId));
    expect(signup).toMatchObject({ inviteId: null, source: "reddit" });
  });

  it("refuses an account created without a guest nor an invitation", async () => {
    const email = newEmail();
    expect((await requestCode(app, env, email)).status).toBe(200);

    const preview = await app.request(
      "/account/link-preview",
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email, code: outbox.codeFor(email) }),
      },
      env,
    );
    expect(linkPreviewResponseSchema.parse(await preview.json()).inviteRequired).toBe(true);

    const refused = await codeSignIn({ email, cookie: null });
    expect(refused.status).toBe(403);
    expect(await errorCode(refused)).toBe(ACCOUNT_ERROR_CODES.inviteRequired);
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(0);
  });

  it("creates an account with an invitation, keeps its age bracket and lets it back in", async () => {
    const invite = await newInvite(2);
    const email = newEmail();
    await requestCode(app, env, email);
    const created = await codeSignIn({
      email,
      cookie: null,
      extra: { [INVITE_HEADER]: invite.code },
      body: { ageBracket: "18-24" },
    });
    expect(created.status).toBe(200);
    const userId = await userIdOf(created);
    const [bracket] = await db
      .select()
      .from(playerAgeBrackets)
      .where(eq(playerAgeBrackets.userId, userId));
    expect(bracket?.bracket).toBe("18-24");

    // Another device, no guest, no invitation: the account exists, nothing is created.
    await requestCode(app, env, email);
    const again = await codeSignIn({ email, cookie: null });
    expect(again.status).toBe(200);
  });

  it("moves the guest's origin and days to the account it becomes", async () => {
    const invite = await newInvite(2, "Prof");
    const guestResponse = await guestSignIn({ [INVITE_HEADER]: invite.code });
    const guestId = await userIdOf(guestResponse);
    const guestCookie = cookieOf(guestResponse);
    const progress = await app.request(
      "/me/progress",
      { headers: headers({ cookie: guestCookie }) },
      env,
    );
    expect(progress.status).toBe(200);

    const email = newEmail();
    await requestCode(app, env, email, guestCookie);
    const linked = await codeSignIn({ email, cookie: guestCookie, body: { ageBracket: "15-17" } });
    expect(linked.status).toBe(200);
    const accountId = await userIdOf(linked);

    const [signup] = await db
      .select()
      .from(playerSignups)
      .where(eq(playerSignups.userId, accountId));
    expect(signup?.inviteId).toBe(invite.id);
    const days = await db.select().from(playerDays).where(eq(playerDays.userId, accountId));
    expect(days.map((row) => row.day)).toEqual([gameDayOf(Date.now()).key]);
    expect(await db.select().from(playerDays).where(eq(playerDays.userId, guestId))).toEqual([]);
    const [row] = await db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row?.uses).toBe(1);

    const measures = adminMeasuresSchema.parse(
      await (
        await app.request("/admin/measures", { headers: headers({ cookie: admin.cookie }) }, env)
      ).json(),
    );
    expect(measures.byOrigin.find((group) => group.key === "Prof")?.players).toBe(1);
    expect(measures.byAge.find((group) => group.key === "15-17")?.players).toBeGreaterThan(0);
    const testers = adminTestersResponseSchema.parse(
      await (
        await app.request("/admin/testers", { headers: headers({ cookie: admin.cookie }) }, env)
      ).json(),
    );
    expect(testers.testers.find((tester) => tester.id === accountId)).toMatchObject({
      email,
      origin: "Prof",
      ageBracket: "15-17",
      daysPlayed: 1,
    });
  });

  it("keeps a tester's note for the back office, until read", async () => {
    const invite = await newInvite(1);
    const cookie = cookieOf(await guestSignIn({ [INVITE_HEADER]: invite.code }));
    const sent = await app.request(
      "/me/feedback",
      {
        method: "POST",
        headers: headers({ cookie }),
        body: JSON.stringify({ body: "Le sachet met trop de temps à s'ouvrir.", screen: "/jouer" }),
      },
      env,
    );
    expect(sent.status).toBe(204);
    await app.request(
      "/me/interest",
      {
        method: "POST",
        headers: headers({ cookie }),
        body: JSON.stringify({ kind: "patron_door" }),
      },
      env,
    );

    const list = adminFeedbackResponseSchema.parse(
      await (
        await app.request("/admin/feedback", { headers: headers({ cookie: admin.cookie }) }, env)
      ).json(),
    );
    const note = list.feedback.find((item) => item.screen === "/jouer");
    expect(note).toMatchObject({ email: null, readAt: null });
    const read = await app.request(
      `/admin/feedback/${note?.id}/read`,
      { method: "POST", headers: headers({ cookie: admin.cookie }) },
      env,
    );
    expect(read.status).toBe(200);
  });
});
