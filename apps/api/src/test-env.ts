/** Rate limiter that always allows: tests exercise limits explicitly with their own stub. */
export const unlimited: RateLimit = { limit: async () => ({ success: true }) };

/** Worker bindings for tests that call the app directly. */
export function testEnv(connectionString = "postgres://unused@127.0.0.1:1/unused"): Env {
  return {
    APP_ENV: "test",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth-0123456789",
    BETTER_AUTH_URL: "http://localhost:8787",
    TRUSTED_ORIGINS: "http://localhost:3000",
    HYPERDRIVE: { connectionString } as Hyperdrive,
    SIGNUP_RATE_LIMITER: unlimited,
    PLAYER_RATE_LIMITER: unlimited,
    OTP_SEND_IP_RATE_LIMITER: unlimited,
    OTP_SEND_EMAIL_RATE_LIMITER: unlimited,
    OTP_VERIFY_IP_RATE_LIMITER: unlimited,
    WAITLIST_RATE_LIMITER: unlimited,
  } as Env;
}

export const TEST_ORIGIN = "http://localhost:3000";
