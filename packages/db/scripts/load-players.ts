/**
 * `pnpm load:players --api <url> --count N [--cards N] [--out <file>]`: test players for the load
 * test (infra/load). Each one is a guest created through the API, then turned into a member in
 * the database (a guest may open only two boosters), with a collection already started and a
 * full reserve of bonus boosters.
 *
 * The database comes from `LOAD_DATABASE_URL`, else from `~/.config/leximon/neon-load-url` (the
 * Neon branch), never from .env. The production API and the production database
 * (`~/.config/leximon/neon-url`) are refused. The output file holds session cookies of test
 * accounts: keep it out of git.
 */

import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { capacityAt, REFILL_SCHEDULE, UNLOCK_SCHEDULE } from "@leximon/core";
import { inArray, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { users } from "../src/schema/auth";
import { boosterWallets, cards, userCards } from "../src/schema/game";

const PRODUCTION_API_HOSTS = new Set(["api.leximon.fr", "leximon.fr"]);
const RESERVE = 10;

const { values } = parseArgs({
  options: {
    api: { type: "string" },
    count: { type: "string", default: "50" },
    cards: { type: "string", default: "150" },
    origin: { type: "string", default: "http://localhost:3000" },
    out: { type: "string", default: "infra/load/players.json" },
  },
});
const count = Number(values.count);
const cardsPerPlayer = Number(values.cards);
if (values.api === undefined || !Number.isInteger(count) || count < 1 || count > 5000) {
  console.error("Usage : pnpm load:players --api <url> --count 1-5000 [--cards N] [--out <file>]");
  process.exit(1);
}
const api = new URL(values.api);
if (PRODUCTION_API_HOSTS.has(api.hostname)) {
  throw new Error("load:players never runs against the production API.");
}

/** A connection string kept in ~/.config/leximon, `null` when the file is absent. */
function savedUrl(name: string): Promise<string | null> {
  return readFile(join(homedir(), ".config", "leximon", name), "utf8")
    .then((text) => text.trim() || null)
    .catch(() => null);
}

const databaseUrl = process.env["LOAD_DATABASE_URL"] || (await savedUrl("neon-load-url"));
if (!databaseUrl) {
  throw new Error("Neither LOAD_DATABASE_URL nor ~/.config/leximon/neon-load-url is set.");
}
const productionUrl = await savedUrl("neon-url");
if (productionUrl && new URL(productionUrl).hostname === new URL(databaseUrl).hostname) {
  throw new Error("LOAD_DATABASE_URL is the production database: refused.");
}

interface Player {
  readonly userId: string;
  readonly cookie: string;
}

/** Creates a guest through the API, as the web does, waiting when the sign-up limit answers 429. */
async function createGuest(): Promise<Player> {
  for (;;) {
    const response = await fetch(new URL("/api/auth/sign-in/anonymous", api), {
      method: "POST",
      headers: { origin: values.origin, "content-type": "application/json" },
      body: "{}",
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") ?? "5");
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`Guest sign-in failed: HTTP ${response.status}`);
    const body = (await response.json()) as { user: { id: string } };
    // The signed cookie cache still says "guest": dropped, the session is read from the database.
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0] ?? "")
      .filter((pair) => pair !== "" && !pair.includes("session_data"))
      .join("; ");
    return { userId: body.user.id, cookie };
  }
}

function sample<T>(items: readonly T[], size: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as T, pool[i] as T];
  }
  return pool.slice(0, size);
}

const players: Player[] = [];
for (let i = 0; i < count; i++) {
  players.push(await createGuest());
  if ((i + 1) % 50 === 0) console.info(`${i + 1} invités créés`);
}

const { db, close } = createDb(databaseUrl, { maxConnections: 2 });
try {
  const ids = players.map((player) => player.userId);
  const catalog = (await db.select({ id: cards.id }).from(cards)).map((card) => card.id);
  if (catalog.length === 0) throw new Error("No card in this database: publish the catalogue.");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ isAnonymous: false }).where(inArray(users.id, ids));
    await tx
      .insert(boosterWallets)
      .values(
        ids.map((userId) => ({
          userId,
          stored: capacityAt(REFILL_SCHEDULE, now.getTime()),
          progressMs: 0,
          asOf: now,
          bonusBoosters: RESERVE,
        })),
      )
      .onConflictDoUpdate({
        target: boosterWallets.userId,
        set: { bonusBoosters: sql`excluded.bonus_boosters` },
      });
    for (const userId of ids) {
      const owned = sample(catalog, cardsPerPlayer).map((cardId) => ({
        userId,
        cardId,
        quantity: 1,
        firstObtainedAt: now,
        lastObtainedAt: now,
      }));
      if (owned.length > 0) await tx.insert(userCards).values(owned).onConflictDoNothing();
    }
  });
} finally {
  await close();
}

const starterCollection = UNLOCK_SCHEDULE[0]?.starterCollection;
// pnpm runs the script from packages/db: the path is read from where the command was typed.
const out = resolve(process.env["INIT_CWD"] ?? process.cwd(), values.out);
await writeFile(out, `${JSON.stringify({ starterCollection, players }, null, 1)}\n`, {
  mode: 0o600,
});
console.info(`${players.length} joueurs de test écrits dans ${out}`);
