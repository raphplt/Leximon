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
  | "WAITLIST_RATE_LIMITER";

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
