import {
  bannerPurchaseRefusalSchema,
  bannerPurchaseResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  profileResponseSchema,
  publicProfileSchema,
} from "@leximon/contract";
import { BANNER_SCHEDULE, bannerRulesAt, xpToReach } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { TEST_ORIGIN, testEnv } from "../test-env";
import { type Guest, seedTestCatalog, setXp, signInAsGuest, signInAsMember } from "../test-support";

const url = testDatabaseUrl();
const env = testEnv(url);
const app = createApp();
const { db, close } = createDb(url, { maxConnections: 4 });
const RULES = bannerRulesAt(BANNER_SCHEDULE, Date.now());
const [FOR_SALE, PRICE] = Object.entries(RULES.forEcus)[0] ?? ["", 0];

beforeAll(() => seedTestCatalog(db));
afterAll(close);

function call(player: Guest | null, method: string, path: string, body?: unknown, key?: string) {
  const headers: Record<string, string> = { origin: TEST_ORIGIN };
  if (player !== null) headers["cookie"] = player.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key !== undefined) headers[IDEMPOTENCY_KEY_HEADER] = key;
  return app.request(
    path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    env,
  );
}

const buy = (player: Guest, motif: string, key: string = crypto.randomUUID()) =>
  call(player, "POST", `/me/banners/${motif}`, undefined, key);

async function errorOf(response: Response) {
  return bannerPurchaseRefusalSchema.parse(await response.json()).error;
}

async function giveEcus(userId: string, ecus: number) {
  await db
    .insert(schema.boosterWallets)
    .values({ userId, stored: 0, progressMs: 0, asOf: new Date(), ecus })
    .onConflictDoUpdate({ target: schema.boosterWallets.userId, set: { ecus } });
}

async function ecusOf(userId: string) {
  const [row] = await db
    .select({ ecus: schema.boosterWallets.ecus })
    .from(schema.boosterWallets)
    .where(eq(schema.boosterWallets.userId, userId));
  return row?.ecus ?? 0;
}

async function bannerMovements(userId: string) {
  return db
    .select({ amount: schema.ecuMovements.amount })
    .from(schema.ecuMovements)
    .where(and(eq(schema.ecuMovements.userId, userId), eq(schema.ecuMovements.kind, "banner")));
}

describe("POST /me/banners/:motif", () => {
  it("sells a motif once for its price, and answers a retry as the first purchase", async () => {
    const member = await signInAsMember(app, env, db);
    await giveEcus(member.userId, PRICE + 10);
    const key = crypto.randomUUID();

    const response = await buy(member, FOR_SALE, key);
    expect(response.status).toBe(200);
    const body = bannerPurchaseResponseSchema.parse(await response.json());
    expect(body.wallet.ecus).toBe(10);
    expect(body.profile.wardrobe.banners).toContain(FOR_SALE);

    const retry = await buy(member, FOR_SALE, key);
    expect(retry.status).toBe(200);
    expect(bannerPurchaseResponseSchema.parse(await retry.json()).wallet.ecus).toBe(10);

    const again = await buy(member, FOR_SALE);
    expect(again.status).toBe(409);
    expect(await errorOf(again)).toBe("already_owned");
    expect(await ecusOf(member.userId)).toBe(10);
    expect(await bannerMovements(member.userId)).toEqual([{ amount: -PRICE }]);
  });

  it("spends the écus once when the same purchase arrives several times at once", async () => {
    const member = await signInAsMember(app, env, db);
    await giveEcus(member.userId, PRICE * 3);
    const responses = await Promise.all(Array.from({ length: 4 }, () => buy(member, FOR_SALE)));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409]);
    expect(await ecusOf(member.userId)).toBe(PRICE * 2);
    expect(await bannerMovements(member.userId)).toHaveLength(1);
  });

  it("refuses a motif not for sale, a short purse, a guest and a missing key", async () => {
    const member = await signInAsMember(app, env, db);
    await giveEcus(member.userId, PRICE - 1);

    const earned = await buy(member, RULES.completeCollection);
    expect(earned.status).toBe(409);
    expect(await errorOf(earned)).toBe("not_for_sale");

    const short = await buy(member, FOR_SALE);
    expect(short.status).toBe(409);
    expect(await errorOf(short)).toBe("not_enough_ecus");
    expect(await ecusOf(member.userId)).toBe(PRICE - 1);

    const guest = await signInAsGuest(app, env);
    await giveEcus(guest.userId, PRICE);
    const refused = await buy(guest, FOR_SALE);
    expect(refused.status).toBe(409);
    expect(await errorOf(refused)).toBe("account_required");

    const noKey = await call(member, "POST", `/me/banners/${FOR_SALE}`);
    expect(noKey.status).toBe(400);
  });
});

describe("PATCH /me/profile: banner", () => {
  it("wears a free tint and an earned motif, and shows them on the public page", async () => {
    const member = await signInAsMember(app, env, db);
    const own = profileResponseSchema.parse(
      await (await call(member, "GET", "/me/profile")).json(),
    );
    expect(own.banner).toEqual({ motif: RULES.startingMotif, tint: RULES.tints[0] });
    expect(own.wardrobe.banners).toEqual([RULES.startingMotif]);

    const [levelText, levelMotif] = Object.entries(RULES.levels)[0] ?? ["0", ""];
    const tint = RULES.tints[1] ?? "";
    const locked = await call(member, "PATCH", "/me/profile", { bannerMotif: levelMotif });
    expect(locked.status).toBe(422);
    const badTint = await call(member, "PATCH", "/me/profile", { bannerTint: "fuchsia" });
    expect(badTint.status).toBe(422);

    await setXp(db, member.userId, xpToReach(Number(levelText)));
    const response = await call(member, "PATCH", "/me/profile", {
      bannerMotif: levelMotif,
      bannerTint: tint,
      pseudo: `Tenture${crypto.randomUUID().slice(0, 6)}`,
    });
    expect(response.status).toBe(200);
    const changed = profileResponseSchema.parse(await response.json());
    expect(changed.banner).toEqual({ motif: levelMotif, tint });

    const path = `/players/${encodeURIComponent((changed.pseudo ?? "").toLowerCase())}`;
    const page = publicProfileSchema.parse(await (await call(null, "GET", path)).json());
    expect(page).toMatchObject({ visibility: "public", banner: { motif: levelMotif, tint } });
  });
});
