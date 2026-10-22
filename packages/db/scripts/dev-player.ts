/**
 * `pnpm dev:player <email> --level N`: sets an account's level, to test what opens with the level
 * (trades at 5, clans at 10 and 15) without playing for hours.
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

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { level: { type: "string" } },
});
const email = positionals[0]?.trim().toLowerCase();
const level = Number(values.level);
if (
  email === undefined ||
  !email.includes("@") ||
  !Number.isInteger(level) ||
  level < 1 ||
  level > 200
) {
  console.error("Usage : pnpm dev:player <email> --level 1-200");
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
    const xp = xpToReach(level);
    await db
      .insert(userProgress)
      .values({ userId: user.id, xp })
      .onConflictDoUpdate({ target: userProgress.userId, set: { xp: sql`excluded.xp` } });
    console.info(`${email} est au niveau ${level} (${xp} XP).`);
  }
} finally {
  await close();
}
