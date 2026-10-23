import { SIGN_IN_CODE_QUOTA_ERROR } from "@leximon/contract";
import { schema } from "@leximon/db";
import { sql } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";
import { readAuthEmail } from "./auth-email";

type Limiter =
  | "SIGNUP_RATE_LIMITER"
  | "PLAYER_RATE_LIMITER"
  | "OTP_SEND_IP_RATE_LIMITER"
  | "OTP_SEND_EMAIL_RATE_LIMITER"
  | "OTP_VERIFY_IP_RATE_LIMITER"
  | "WAITLIST_RATE_LIMITER"
  | "EMAIL_LINK_RATE_LIMITER";

/** The counter a request is counted on; `null` lets it through uncounted. */
type KeyOf = (c: Context<AppEnv>) => string | null | Promise<string | null>;

/**
 * Rejects requests over a Cloudflare rate limit with 429. Counters live in Cloudflare, not in the
 * Worker: the API stays stateless.
 */
export function rateLimit(limiter: Limiter, key: KeyOf) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const counted = await key(c);
    if (counted === null) return next();
    const { success } = await c.env[limiter].limit({ key: `${limiter}:${counted}` });
    if (!success) {
      c.header("Retry-After", "60");
      return c.json({ error: "rate_limited" }, 429);
    }
    return next();
  });
}

/** Client address as seen by Cloudflare. Shared by many users on mobile networks and schools. */
export function clientIp(c: Context<AppEnv>): string {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

/** Per-player limit. Must run after `requireUser`. */
export const playerRateLimit = rateLimit("PLAYER_RATE_LIMITER", (c) => c.var.userId);

/** Guest sign-ups, per address. */
export const signupRateLimit = rateLimit("SIGNUP_RATE_LIMITER", clientIp);

/** Sign-in codes sent, per IP. */
export const codeSendIpRateLimit = rateLimit("OTP_SEND_IP_RATE_LIMITER", clientIp);

/**
 * Sign-in codes sent, per address: keeps anyone from flooding a mailbox, whatever their IPs. The
 * counter is keyed on a keyed hash, never the address itself. Requests without a readable address
 * are let through, for Better Auth to reject.
 */
export const codeSendEmailRateLimit = rateLimit("OTP_SEND_EMAIL_RATE_LIMITER", async (c) => {
  const email = await readAuthEmail(c);
  return email === null ? null : emailKey(c.env.BETTER_AUTH_SECRET, email);
});

/** Sign-in codes one address may receive over a 24-hour window, wherever the requests come from. */
export const SIGN_IN_CODE_DAILY_QUOTA = { codes: 10, windowMs: 24 * 60 * 60 * 1000 } as const;

/**
 * Sign-in codes sent, per address, over 24 hours. Each code allows 3 wrong attempts and a new code
 * starts a new count: without this ceiling, requests spread over many Cloudflare locations could
 * try code after code on one address. Counted in the database, in one statement; a request over
 * the ceiling is counted too, so retrying does not help. Must run after `withDatabase`.
 */
export const codeSendDailyQuota = createMiddleware<AppEnv>(async (c, next) => {
  const email = await readAuthEmail(c);
  if (email === null) return next();
  const key = await emailKey(c.env.BETTER_AUTH_SECRET, email);
  const now = new Date();
  const windowOver = new Date(now.getTime() - SIGN_IN_CODE_DAILY_QUOTA.windowMs);
  const quotas = schema.signInCodeQuotas;
  const [row] = await c.var.db
    .insert(quotas)
    .values({ emailKey: key, windowStart: now, sent: 1 })
    .onConflictDoUpdate({
      target: quotas.emailKey,
      set: {
        windowStart: sql`case when ${quotas.windowStart} <= ${windowOver} then excluded.window_start
          else ${quotas.windowStart} end`,
        sent: sql`case when ${quotas.windowStart} <= ${windowOver} then 1
          else ${quotas.sent} + 1 end`,
      },
    })
    .returning({ sent: quotas.sent, windowStart: quotas.windowStart });
  if (row !== undefined && row.sent > SIGN_IN_CODE_DAILY_QUOTA.codes) {
    const retryAfterS = Math.ceil(
      (row.windowStart.getTime() + SIGN_IN_CODE_DAILY_QUOTA.windowMs - now.getTime()) / 1000,
    );
    c.header("Retry-After", String(Math.max(retryAfterS, 1)));
    return c.json({ error: SIGN_IN_CODE_QUOTA_ERROR }, 429);
  }
  return next();
});

/** Code checks (preview and sign-in), per IP, on top of the attempts allowed per code. */
export const codeVerifyIpRateLimit = rateLimit("OTP_VERIFY_IP_RATE_LIMITER", clientIp);

/** Waiting-list sign-ups, per IP: keeps scripts from filling the list with made-up addresses. */
export const waitlistRateLimit = rateLimit("WAITLIST_RATE_LIMITER", clientIp);

const encoder = new TextEncoder();

/**
 * HMAC-SHA-256 of the normalised address with the server secret: unlike a plain hash, it cannot be
 * reversed by hashing a list of known addresses.
 */
export async function emailKey(secret: string, email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`rate-limit:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
