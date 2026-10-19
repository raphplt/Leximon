import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context";

type Limiter = "SIGNUP_RATE_LIMITER" | "PLAYER_RATE_LIMITER";

/**
 * Rejects requests over a Cloudflare rate limit with 429. Counters live in Cloudflare, not in the
 * Worker: the API stays stateless.
 */
export function rateLimit(limiter: Limiter, key: (c: Context<AppEnv>) => string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { success } = await c.env[limiter].limit({ key: `${limiter}:${key(c)}` });
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
