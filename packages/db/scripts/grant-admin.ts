/**
 * `pnpm admin:grant <email> [--revoke]`: gives (or takes back) the back office role to an account.
 *
 * The only way to become an admin: no request can grant the role. The account must exist, so sign
 * in once on the site with that address first.
 */

import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { createDb } from "../src/client";
import { users } from "../src/schema/auth";

const ADMIN_ROLE = "admin";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { revoke: { type: "boolean", default: false } },
});
const email = positionals[0]?.trim().toLowerCase();
if (email === undefined || !email.includes("@")) {
  console.error("Usage : pnpm admin:grant <email> [--revoke]");
  process.exit(1);
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}

const { db, close } = createDb(url, { maxConnections: 1 });
try {
  const updated = await db
    .update(users)
    .set({ role: values.revoke ? "user" : ADMIN_ROLE })
    .where(and(eq(users.email, email), eq(users.isAnonymous, false)))
    .returning({ id: users.id });
  if (updated.length === 0) {
    console.error(
      `Aucun compte pour ${email}. Connecte-toi d'abord une fois sur le site avec cette adresse.`,
    );
    process.exitCode = 1;
  } else {
    console.info(values.revoke ? `${email} n'est plus admin.` : `${email} est admin.`);
  }
} finally {
  await close();
}
