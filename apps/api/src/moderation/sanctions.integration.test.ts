import {
  adminContestsResponseSchema,
  adminJoustSuspectsResponseSchema,
  adminReportsResponseSchema,
  clanJoinResultSchema,
  clanMessageSchema,
  clanMessagesResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  sanctionSchema,
  sanctionsResponseSchema,
} from "@leximon/contract";
import { pseudoKey, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, STARTER_COLLECTION, seedTestCatalog, signInAsMember } from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const HOUR = 3_600_000;

const { adminActions, clans, moderationReports, players, sanctions, users } = schema;

beforeAll(() => seedTestCatalog(db));
afterAll(close);

interface Player extends Guest {
  readonly code: string;
  readonly pseudo: string;
}

async function player(level = 15): Promise<Player> {
  const member = await signInAsMember(app, env, db);
  expect((await request(member, "/me/profile")).status).toBe(200);
  const pseudo = `Joueur ${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await db
    .update(players)
    .set({ pseudo, pseudoKey: pseudoKey(pseudo), pseudoChangedAt: new Date("2026-01-01") })
    .where(eq(players.userId, member.userId))
    .returning({ code: players.code });
  await db.insert(schema.userProgress).values({ userId: member.userId, xp: xpToReach(level) });
  if (row === undefined) throw new Error("No player row");
  return { ...member, code: row.code, pseudo };
}

async function admin(): Promise<Guest> {
  const who = await signInAsMember(app, env, db);
  await db.update(users).set({ role: "admin" }).where(eq(users.id, who.userId));
  return who;
}

function request(who: Guest, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", TEST_ORIGIN);
  headers.set("cookie", who.cookie);
  return app.request(path, { ...init, headers }, env);
}

function send(who: Guest, method: string, path: string, body?: unknown, extra: object = {}) {
  return request(who, path, {
    method,
    headers: { "content-type": "application/json", ...extra },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function sanction(by: Guest, body: object, key = crypto.randomUUID()) {
  return send(by, "POST", "/admin/sanctions", body, { [IDEMPOTENCY_KEY_HEADER]: key });
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

/** A clan with a member who wrote a message the chief reported. */
async function reportedMessage() {
  const chief = await player();
  const created = await send(chief, "POST", "/clans", {
    name: `Clan ${crypto.randomUUID().slice(0, 8)}`,
    motto: "",
    entryMode: "open",
    emblem: { engraving: "aiguiere", colors: ["sang", "or"] },
  });
  const { clanId } = clanJoinResultSchema.parse(await created.json());
  const author = await player(10);
  await send(author, "POST", `/clans/${clanId}/join`);
  const message = clanMessageSchema.parse(
    await (
      await send(author, "POST", `/clans/${clanId}/messages`, { body: "Un texte limite" })
    ).json(),
  );
  expect((await send(chief, "POST", `/clans/${clanId}/messages/${message.id}/report`)).status).toBe(
    204,
  );
  return { chief, author, clanId, messageId: message.id };
}

describe("the back office", () => {
  it("is for admins only", async () => {
    const somebody = await player();
    expect((await request(somebody, "/admin/reports")).status).toBe(403);
    expect((await sanction(somebody, {})).status).toBe(403);
  });

  it("groups reports by target, with the messages around", async () => {
    const team = await admin();
    const { author, clanId, messageId } = await reportedMessage();
    const other = await player(10);
    await send(other, "POST", `/clans/${clanId}/join`);
    await send(other, "POST", `/clans/${clanId}/messages/${messageId}/report`);

    const body = adminReportsResponseSchema.parse(
      await (await request(team, "/admin/reports")).json(),
    );
    const group = body.reports.find((report) => report.messageId === messageId);
    expect(group).toMatchObject({
      targetKind: "message",
      reportedUserId: author.userId,
      content: "Un texte limite",
      reporters: 2,
      clanId,
      previousSanctions: 0,
    });
    expect(group?.context.map((line) => line.id)).toContain(messageId);
  });

  it("hides a reported message, closes the group and tells the player why", async () => {
    const team = await admin();
    const { chief, author, clanId, messageId } = await reportedMessage();
    const [report] = await db
      .select({ id: moderationReports.id })
      .from(moderationReports)
      .where(eq(moderationReports.messageId, messageId));
    const key = crypto.randomUUID();
    const body = {
      userId: author.userId,
      kind: "hide_message",
      reason: "Insulte envers un autre joueur (charte, article 2).",
      reportId: report?.id,
    };
    const created = await sanction(team, body, key);
    expect(created.status).toBe(201);
    const first = sanctionSchema.parse(await created.json());
    // A retry with the same key applies nothing more.
    const again = sanctionSchema.parse(await (await sanction(team, body, key)).json());
    expect(again.id).toBe(first.id);
    expect(
      await db.select().from(sanctions).where(eq(sanctions.userId, author.userId)),
    ).toHaveLength(1);

    const list = clanMessagesResponseSchema.parse(
      await (await request(chief, `/clans/${clanId}/messages`)).json(),
    );
    expect(list.messages.find((m) => m.id === messageId)).toMatchObject({
      body: null,
      removed: "hidden",
    });
    const open = await db
      .select()
      .from(moderationReports)
      .where(
        and(
          eq(moderationReports.messageId, messageId),
          eq(moderationReports.resolution, "sanctioned"),
        ),
      );
    expect(open).toHaveLength(1);

    const mine = sanctionsResponseSchema.parse(
      await (await request(author, "/me/sanctions")).json(),
    );
    expect(mine.sanctions[0]).toMatchObject({
      kind: "hide_message",
      content: "Un texte limite",
      seen: false,
      contestable: true,
    });
    expect((await send(author, "POST", "/me/sanctions/seen")).status).toBe(204);
    const seen = sanctionsResponseSchema.parse(
      await (await request(author, "/me/sanctions")).json(),
    );
    expect(seen.sanctions[0]?.seen).toBe(true);
  });

  it("silences a player until a contest lifts it", async () => {
    const team = await admin();
    const { author, clanId } = await reportedMessage();
    const created = sanctionSchema.parse(
      await (
        await sanction(team, {
          userId: author.userId,
          kind: "mute",
          reason: "Messages insultants répétés dans le clan.",
          durationMs: 24 * HOUR,
        })
      ).json(),
    );
    await db
      .update(schema.clanMembers)
      .set({ lastMessageAt: null })
      .where(eq(schema.clanMembers.userId, author.userId));
    expect(
      await errorOf(await send(author, "POST", `/clans/${clanId}/messages`, { body: "Hé" })),
    ).toBe("sanctioned");
    expect(
      await errorOf(await send(author, "PATCH", "/me/profile", { pseudo: "Nouveau Nom" })),
    ).toBe("sanctioned");

    const contest = { text: "Je n'ai insulté personne, relisez le fil." };
    expect(
      (await send(author, "POST", `/me/sanctions/${created.id}/contest`, contest)).status,
    ).toBe(204);
    expect(
      await errorOf(await send(author, "POST", `/me/sanctions/${created.id}/contest`, contest)),
    ).toBe("not_contestable");

    const contests = adminContestsResponseSchema.parse(
      await (await request(team, "/admin/contests")).json(),
    );
    expect(contests.contests.find((c) => c.sanction.id === created.id)?.contestText).toBe(
      contest.text,
    );
    expect(
      (await send(team, "POST", `/admin/sanctions/${created.id}/contest`, { outcome: "revoked" }))
        .status,
    ).toBe(204);
    expect(
      (await send(team, "POST", `/admin/sanctions/${created.id}/contest`, { outcome: "upheld" }))
        .status,
    ).toBe(409);
    expect((await send(author, "POST", `/clans/${clanId}/messages`, { body: "Hé" })).status).toBe(
      201,
    );
    const logged = await db
      .select()
      .from(adminActions)
      .where(eq(adminActions.targetUserId, author.userId));
    expect(logged.map((row) => row.action).sort()).toEqual(["resolve_contest", "sanction"]);
  });

  it("locks a suspended account's writes, not its reading nor its contest", async () => {
    const team = await admin();
    const target = await player();
    const created = sanctionSchema.parse(
      await (
        await sanction(team, {
          userId: target.userId,
          kind: "suspend",
          reason: "Comptes multiples pour s'échanger des cartes.",
          durationMs: 7 * 24 * HOUR,
        })
      ).json(),
    );
    const open = await send(
      target,
      "POST",
      "/boosters/open",
      { kind: "collection", collectionId: STARTER_COLLECTION },
      {
        [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
      },
    );
    expect(open.status).toBe(403);
    expect(await errorOf(open)).toBe("account_locked");
    expect((await request(target, "/me/wallet")).status).toBe(200);
    expect((await request(target, "/me/sanctions")).status).toBe(200);
    expect(
      (
        await send(target, "POST", `/me/sanctions/${created.id}/contest`, {
          text: "Un seul compte.",
        })
      ).status,
    ).toBe(204);
  });

  it("replaces a reported clan name and refuses to sanction an admin", async () => {
    const team = await admin();
    const chief = await player();
    const created = await send(chief, "POST", "/clans", {
      name: `Clan ${crypto.randomUUID().slice(0, 8)}`,
      motto: "Devise douteuse",
      entryMode: "open",
      emblem: { engraving: "aiguiere", colors: ["sang", "or"] },
    });
    const { clanId } = clanJoinResultSchema.parse(await created.json());
    const reporter = await player(10);
    expect((await send(reporter, "POST", `/clans/${clanId}/report`)).status).toBe(204);
    const [report] = await db
      .select({ id: moderationReports.id })
      .from(moderationReports)
      .where(
        and(eq(moderationReports.targetKind, "clan_name"), eq(moderationReports.targetKey, clanId)),
      );

    const response = await sanction(team, {
      userId: chief.userId,
      kind: "reset_clan_name",
      reason: "Nom de clan injurieux.",
      reportId: report?.id,
    });
    expect(response.status).toBe(201);
    const [clan] = await db.select().from(clans).where(eq(clans.id, clanId));
    expect(clan?.name).toMatch(/^Clan [0-9A-Z]{8}$/);
    expect(clan?.motto).toBe("");

    const other = await admin();
    expect(
      await errorOf(
        await sanction(team, {
          userId: other.userId,
          kind: "close",
          reason: "Pour voir si ça passe.",
        }),
      ),
    ).toBe("admin_target");
    expect(
      await errorOf(
        await sanction(team, { userId: chief.userId, kind: "mute", reason: "Sans durée, refusé." }),
      ),
    ).toBe("duration_required");
  });

  it("dismisses a report group with nothing to sanction", async () => {
    const team = await admin();
    const { messageId } = await reportedMessage();
    const [report] = await db
      .select({ id: moderationReports.id })
      .from(moderationReports)
      .where(eq(moderationReports.messageId, messageId));
    expect((await send(team, "POST", `/admin/reports/${report?.id}/dismiss`)).status).toBe(200);
    expect((await send(team, "POST", `/admin/reports/${report?.id}/dismiss`)).status).toBe(409);
  });
});

describe("jousters worth a look", () => {
  const CARD = `${STARTER_COLLECTION}-common-1`;

  /** Thirty ranked questions `who` answered, each after the time `msOf` gives its position. */
  async function rankedAnswers(
    who: Player,
    msOf: (position: number) => number,
    wrongAt: readonly number[] = [],
  ) {
    const other = await player();
    const [joust] = await db
      .insert(schema.jousts)
      .values({
        kind: "ranked",
        challengerId: who.userId,
        opponentId: other.userId,
        launchKey: crypto.randomUUID(),
        createdAt: new Date(),
      })
      .returning({ id: schema.jousts.id });
    if (joust === undefined) throw new Error("No joust row");
    const servedAt = Date.now() - HOUR;
    await db.insert(schema.joustQuestions).values(
      Array.from({ length: 30 }, (_, position) => ({
        joustId: joust.id,
        answererId: who.userId,
        position,
        cardId: CARD,
        choices: [CARD],
        servedAt: new Date(servedAt),
        answeredAt: new Date(servedAt + msOf(position)),
        chosenCardId: CARD,
        correct: !wrongAt.includes(position),
      })),
    );
  }

  it("lists the scripted jouster with the reasons, and leaves the others out", async () => {
    const team = await admin();
    const script = await player();
    const human = await player();
    await rankedAnswers(script, () => 300);
    await rankedAnswers(human, (position) => 2_500 + position * 250, [3, 9, 14, 20, 27]);

    const response = await request(team, "/admin/joust-suspects");
    expect(response.status).toBe(200);
    const { suspects, windowDays } = adminJoustSuspectsResponseSchema.parse(await response.json());
    expect(windowDays).toBe(7);
    expect(suspects.find((suspect) => suspect.userId === script.userId)).toMatchObject({
      player: { pseudo: script.pseudo },
      served: 30,
      correct: 30,
      medianMs: 300,
      spreadMs: 0,
      reasons: ["fast", "regular"],
      banned: false,
    });
    expect(suspects.some((suspect) => suspect.userId === human.userId)).toBe(false);
  });

  it("is closed to anyone but the team", async () => {
    expect((await request(await player(), "/admin/joust-suspects")).status).toBe(403);
  });
});
