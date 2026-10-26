import { gameDayOf, gameTimeOn, pseudoKey } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { handleGameEvents } from "../clans/events";
import type { NotificationEmail } from "../email/notifications";
import { recordingQueue, TEST_LINK_SECRET, TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, signInAsGuest, signInAsMember } from "../test-support";
import type { NotificationMailer } from "./mailer";
import { deliverNews, deliverReminders, type NotifyContext, remindersDue } from "./notifications";

const url = testDatabaseUrl();
const events = recordingQueue<unknown>();
const env: Env = { ...testEnv(url), GAME_EVENTS: events as Queue };
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 8 });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const { boosterWallets, notificationEmails, players, userPreferences, users } = schema;

/** A day ahead of the real clock: every letter written by the test is older than it. */
const tomorrow = gameDayOf(Date.now() + DAY).key;
const noon = gameTimeOn(tomorrow, 12);
const evening = gameTimeOn(tomorrow, 18);

interface Sent {
  readonly to: string;
  readonly email: NotificationEmail;
}

const sent: Sent[] = [];
const mailer: NotificationMailer = {
  async send(to, email) {
    sent.push({ to, email });
  },
};

function context(dailyLimit = 10_000): NotifyContext {
  return {
    db,
    mailer,
    linkSecret: TEST_LINK_SECRET,
    webUrl: "https://leximon.fr",
    apiUrl: "https://api.leximon.fr",
    dailyLimit,
  };
}

beforeAll(() => seedTestCatalog(db));
afterAll(close);
beforeEach(() => {
  events.sent.length = 0;
  sent.length = 0;
});

interface Member extends Guest {
  readonly email: string;
  readonly code: string;
  readonly pseudo: string;
}

/** A member with a checked address and a pseudo, last seen at `seenAt`. */
async function member(seenAt = Date.now() - 2 * HOUR): Promise<Member> {
  const who = await signInAsMember(app, env, db);
  // The profile creates the player's row.
  expect((await request(who, "GET", "/me/profile")).status).toBe(200);
  const email = `joueur-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const pseudo = `Joueur ${crypto.randomUUID().slice(0, 6)}`;
  await db.update(users).set({ email, emailVerified: true }).where(eq(users.id, who.userId));
  const [row] = await db
    .update(players)
    .set({
      pseudo,
      pseudoKey: pseudoKey(pseudo),
      pseudoChangedAt: new Date("2026-01-01"),
      lastSeenAt: new Date(seenAt),
    })
    .where(eq(players.userId, who.userId))
    .returning({ code: players.code });
  if (row === undefined) throw new Error("No player row");
  return { ...who, email, pseudo, code: row.code };
}

function request(who: Guest, method: string, path: string, body?: unknown) {
  return app.request(
    path,
    {
      method,
      headers: { origin: TEST_ORIGIN, cookie: who.cookie, "content-type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    },
    env,
  );
}

/** Runs the queue's consumer on what the routes sent. */
async function consume() {
  const bodies = [...events.sent];
  events.sent.length = 0;
  return handleGameEvents(
    db,
    bodies,
    bodies.map(() => Date.now()),
    Date.now(),
  );
}

async function askFriend(from: Member, to: Member) {
  const response = await request(from, "POST", "/me/friend-requests", { code: to.code });
  expect(response.status).toBe(200);
  return consume();
}

async function rows(userId: string) {
  return db
    .select({ kind: notificationEmails.kind, status: notificationEmails.status })
    .from(notificationEmails)
    .where(eq(notificationEmails.userId, userId));
}

describe("news e-mails", () => {
  it("tell the recipient of a friend request who stays away, once a day", async () => {
    const [asker, asked] = [await member(), await member()];
    const report = await askFriend(asker, asked);
    expect(report.news).toContain(asked.userId);

    const first = await deliverNews(context(), [asked.userId], noon);
    expect(first).toMatchObject({ sent: 1, deferred: null });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(asked.email);
    expect(sent[0]?.email.subject).toBe(`${asker.pseudo} te demande en ami`);
    expect(sent[0]?.email.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0]?.email.text).toContain("https://leximon.fr/amis");
    expect(await rows(asked.userId)).toEqual([{ kind: "news", status: "sent" }]);

    // Replayed, or another letter the same day: nothing more.
    const again = await deliverNews(context(), [asked.userId, asked.userId], noon);
    expect(again).toMatchObject({ sent: 0 });
    expect(sent).toHaveLength(1);
  });

  it("send nothing to a player who came back after the letter", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    await db
      .update(players)
      .set({ lastSeenAt: new Date(Date.now() + 60_000) })
      .where(eq(players.userId, asked.userId));
    expect(await deliverNews(context(), [asked.userId], noon)).toMatchObject({
      sent: 0,
      skipped: 1,
    });
  });

  it("send nothing to a player who turned them off, nor to a guest", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    await db.insert(userPreferences).values({ userId: asked.userId, emailNews: false });
    const guest = await signInAsGuest(app, env);
    const report = await deliverNews(context(), [asked.userId, guest.userId], noon);
    expect(report).toMatchObject({ sent: 0, skipped: 2 });
    expect(sent).toHaveLength(0);
  });

  it("wait for the morning during the quiet hours", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    const night = gameTimeOn(tomorrow, 23);
    const report = await deliverNews(context(), [asked.userId], night);
    expect(report.sent).toBe(0);
    expect(report.deferred).toEqual({
      userIds: [asked.userId],
      delaySeconds: (gameTimeOn(gameDayOf(night + DAY).key, 8) - night) / 1000,
    });
    expect(await rows(asked.userId)).toEqual([]);
  });

  it("send a single e-mail to concurrent checks", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    const reports = await Promise.all(
      Array.from({ length: 5 }, () => deliverNews(context(), [asked.userId], noon)),
    );
    expect(reports.reduce((total, report) => total + report.sent, 0)).toBe(1);
    expect(sent.filter((mail) => mail.to === asked.email)).toHaveLength(1);
  });

  it("stop at the day's budget", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationEmails)
      .where(eq(notificationEmails.day, tomorrow));
    const report = await deliverNews(context(count?.count ?? 0), [asked.userId], noon);
    expect(report).toMatchObject({ sent: 0, capped: 1 });
  });

  it("stop from the one-click link, and say what stopped", async () => {
    const [asker, asked] = [await member(), await member()];
    await askFriend(asker, asked);
    await deliverNews(context(), [asked.userId], noon);
    const header = sent[0]?.email.headers["List-Unsubscribe"] ?? "";
    const token = /\/email\/unsubscribe\/([^>]+)>/.exec(header)?.[1] ?? "";
    const response = await app.request(`/email/unsubscribe/${token}`, { method: "POST" }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, stopped: "news" });
    const [prefs] = await db
      .select({ news: userPreferences.emailNews, reminders: userPreferences.emailReminders })
      .from(userPreferences)
      .where(eq(userPreferences.userId, asked.userId));
    expect(prefs).toEqual({ news: false, reminders: true });
  });
});

describe("reminders", () => {
  /** Seen on the Paris day `days` before the evening run. */
  const seenDaysBefore = (days: number) => gameTimeOn(gameDayOf(evening - days * DAY).key, 10);

  async function queued(): Promise<string[]> {
    const messages = await remindersDue(db, evening);
    return messages.flatMap((message) => (message.type === "reminders_due" ? message.userIds : []));
  }

  it("reach players away on a reminder day only", async () => {
    const [away3, away2, away30, today] = [
      await member(seenDaysBefore(3)),
      await member(seenDaysBefore(2)),
      await member(seenDaysBefore(30)),
      await member(gameTimeOn(tomorrow, 9)),
    ];
    const due = await queued();
    expect(due).toContain(away3.userId);
    expect(due).toContain(away30.userId);
    expect(due).not.toContain(away2.userId);
    expect(due).not.toContain(today.userId);
  });

  it("say the sachets wait, once, and that the last one is the last", async () => {
    const [away, last] = [await member(seenDaysBefore(3)), await member(seenDaysBefore(30))];
    const report = await deliverReminders(context(), [away.userId, last.userId], evening);
    expect(report.sent).toBe(2);
    const toAway = sent.find((mail) => mail.to === away.email);
    expect(toAway?.email.subject).toBe("Tes 6 sachets t'attendent");
    expect(toAway?.email.text).not.toContain("Dernier rappel");
    expect(sent.find((mail) => mail.to === last.email)?.email.text).toContain("Dernier rappel");

    expect(await queued()).not.toContain(away.userId);
    expect(await deliverReminders(context(), [away.userId], evening)).toMatchObject({
      sent: 0,
      capped: 1,
    });
  });

  it("skip a player whose sachets are not full, or who turned them off", async () => {
    const [opened, off] = [await member(seenDaysBefore(1)), await member(seenDaysBefore(1))];
    await db
      .insert(boosterWallets)
      .values({ userId: opened.userId, stored: 0, progressMs: 0, asOf: new Date(evening - HOUR) })
      .onConflictDoUpdate({
        target: boosterWallets.userId,
        set: { stored: 0, progressMs: 0, asOf: new Date(evening - HOUR) },
      });
    await db.insert(userPreferences).values({ userId: off.userId, emailReminders: false });
    expect(await queued()).not.toContain(off.userId);
    const report = await deliverReminders(context(), [opened.userId, off.userId], evening);
    expect(report).toMatchObject({ sent: 0, skipped: 2 });
    expect(
      await db
        .select()
        .from(notificationEmails)
        .where(eq(notificationEmails.userId, opened.userId)),
    ).toEqual([]);
  });

  it("are turned off by their own link", async () => {
    const away = await member(seenDaysBefore(7));
    await deliverReminders(context(), [away.userId], evening);
    const header = sent[0]?.email.headers["List-Unsubscribe"] ?? "";
    const token = /\/email\/unsubscribe\/([^>]+)>/.exec(header)?.[1] ?? "";
    const response = await app.request(`/email/unsubscribe/${token}`, { method: "POST" }, env);
    expect(await response.json()).toEqual({ ok: true, stopped: "reminders" });
  });
});
