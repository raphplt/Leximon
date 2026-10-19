import { type Database, schema } from "@leximon/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";

export const AUTH_BASE_PATH = "/api/auth";

/**
 * Better Auth for one request (D-006). Built per request because the database client is.
 *
 * Guest accounts come first: a player arriving from a stream link plays before signing up.
 * When other sign-in methods are added, `anonymous({ onLinkAccount })` must move the guest's
 * collection to the new account: by default the guest user is deleted, with its cards.
 */
export function createAuth(env: Env, db: Database) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: parseOrigins(env.TRUSTED_ORIGINS),
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
    }),
    plugins: [anonymous()],
    session: {
      // Signed cookie that avoids a database lookup on most requests.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Better Auth's limiter keeps counters in memory, which breaks the stateless rule.
    // Rate limiting belongs to Cloudflare (to be configured before launch).
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export function parseOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
