/** Rate limiter that always allows: tests exercise limits explicitly with their own stub. */
export const unlimited: RateLimit = { limit: async () => ({ success: true }) };

/** Queue that keeps what is sent to it, for tests to read. */
export interface RecordingQueue extends Queue {
  readonly sent: unknown[];
}

export function recordingQueue(): RecordingQueue {
  const sent: unknown[] = [];
  return {
    sent,
    send: async (message: unknown) => {
      sent.push(message);
    },
    sendBatch: async (messages: Iterable<MessageSendRequest>) => {
      for (const { body } of messages) sent.push(body);
    },
  } as unknown as RecordingQueue;
}

/** Worker bindings for tests that call the app directly. */
export function testEnv(
  connectionString = "postgres://unused@127.0.0.1:1/unused",
  analyticsQueue: Queue = recordingQueue(),
): Env {
  return {
    APP_ENV: "test",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth-0123456789",
    ANALYTICS_SECRET: "test-analytics-secret",
    ANALYTICS_QUEUE: analyticsQueue,
    BETTER_AUTH_URL: "http://localhost:8787",
    TRUSTED_ORIGINS: "http://localhost:3000",
    HYPERDRIVE: { connectionString } as Hyperdrive,
    SIGNUP_RATE_LIMITER: unlimited,
    PLAYER_RATE_LIMITER: unlimited,
  } as Env;
}

export const TEST_ORIGIN = "http://localhost:3000";
