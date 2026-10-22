/**
 * `pnpm dev:player <email> [--level N] [--age-days N]`: sets an account's level and age, to test
 * what opens with the level (clans at 10 and 15, trades at 5) or with the account's age (trades
 * after 3 days) without playing for hours.
 *
 * Local database only: it refuses any other host. The coffrets of the levels skipped wait to be
 * claimed, as if the XP had been earned.
 */

import { parseArgs } from "node:util";
import { xpToReach } from "@leximon/core";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { users } from "../src/schema/auth";
import { userProgress } from "../src/schema/game";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const DAY_MS = 86_400_000;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { level: { type: "string" }, "age-days": { type: "string" } },
});
const email = positionals[0]?.trim().toLowerCase();
const level = values.level === undefined ? undefined : Number(values.level);
const ageDays = values["age-days"] === undefined ? undefined : Number(values["age-days"]);
if (
  email === undefined ||
  !email.includes("@") ||
  (level === undefined && ageDays === undefined) ||
  (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 200)) ||
  (ageDays !== undefined && (!Number.isFinite(ageDays) || ageDays < 0))
) {
  console.error("Usage : pnpm dev:player <email> [--level 1-200] [--age-days N]");
  process.exit(1);
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}
if (!LOCAL_HOSTS.has(new URL(url).hostname)) {
  throw new Error("dev:player only runs against a local database.");
}

const { db, close } = createDb(url, { maxConnections: 1 });
try {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isAnonymous, false)));
  if (user === undefined) {
    console.error(
      `Aucun compte pour ${email}. Connecte-toi d'abord une fois sur le site avec cette adresse.`,
    );
    process.exitCode = 1;
  } else {
    if (level !== undefined) {
      const xp = xpToReach(level);
      await db
        .insert(userProgress)
        .values({ userId: user.id, xp })
        .onConflictDoUpdate({ target: userProgress.userId, set: { xp: sql`excluded.xp` } });
      console.info(`${email} est au niveau ${level} (${xp} XP).`);
    }
    if (ageDays !== undefined) {
      await db
        .update(users)
        .set({ createdAt: new Date(Date.now() - ageDays * DAY_MS) })
        .where(eq(users.id, user.id));
      console.info(`Le compte de ${email} a ${ageDays} jours.`);
    }
  }
} finally {
  await close();
}
