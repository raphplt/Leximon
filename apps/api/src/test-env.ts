/** Rate limiter that always allows: tests exercise limits explicitly with their own stub. */
export const unlimited: RateLimit = { limit: async () => ({ success: true }) };

/** E-mail binding that fails if used: tests that send pass their own. */
export const unusedEmailBinding: SendEmail = {
  send: async () => {
    throw new Error("The e-mail binding is not available in this test");
  },
};

/** Queue that fails if used: campaign tests pass the pump their own. */
export const unusedQueue = {
  send: async () => {
    throw new Error("The campaign queue is not available in this test");
  },
  sendBatch: async () => {
    throw new Error("The campaign queue is not available in this test");
  },
} as unknown as Queue;

/** A queue that keeps what is sent, for tests that check or replay game events. */
export function recordingQueue<Body>(): Queue<Body> & { readonly sent: Body[] } {
  const sent: Body[] = [];
  return {
    sent,
    send: async (body: Body) => {
      sent.push(body);
    },
    sendBatch: async (messages: Iterable<MessageSendRequest<Body>>) => {
      for (const message of messages) sent.push(message.body);
    },
  } as unknown as Queue<Body> & { readonly sent: Body[] };
}

export const TEST_LINK_SECRET = "test-link-secret-0123456789abcdef";
export const TEST_WEBHOOK_SECRET = "test-webhook-secret-0123456789abcdef";

/** Worker bindings for tests that call the app directly. */
export function testEnv(connectionString = "postgres://unused@127.0.0.1:1/unused"): Env {
  return {
    APP_ENV: "test",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth-0123456789",
    BETTER_AUTH_URL: "http://localhost:8787",
    TRUSTED_ORIGINS: "http://localhost:3000",
    EMAIL_CODE_FROM: "",
    EMAIL_REPLY_TO: "contact@leximon.fr",
    EMAIL: unusedEmailBinding,
    EMAIL_CAMPAIGN_FROM: "",
    LETTERMINT_BROADCAST_ROUTE: "broadcast",
    PUBLIC_WEB_URL: "http://localhost:3000",
    EMAIL_LINK_SECRET: TEST_LINK_SECRET,
    LETTERMINT_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    CAMPAIGN_QUEUE: unusedQueue,
    // Game events are hints: tests that need them pass a recording queue.
    GAME_EVENTS: recordingQueue() as Queue,
    HYPERDRIVE: { connectionString } as Hyperdrive,
    SIGNUP_RATE_LIMITER: unlimited,
    PLAYER_RATE_LIMITER: unlimited,
    OTP_SEND_IP_RATE_LIMITER: unlimited,
    OTP_SEND_EMAIL_RATE_LIMITER: unlimited,
    OTP_VERIFY_IP_RATE_LIMITER: unlimited,
    WAITLIST_RATE_LIMITER: unlimited,
    EMAIL_LINK_RATE_LIMITER: unlimited,
  } as Env;
}

export const TEST_ORIGIN = "http://localhost:3000";
