import { ACCOUNT_ERROR_CODES } from "@leximon/contract";
import { type Database, schema } from "@leximon/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { anonymous, emailOTP } from "better-auth/plugins";
import { type EmailSender, EmailSenderNotConfiguredError } from "./account/email-sender";
import { linkGuestOnSignIn, readBodyFlag } from "./account/link-on-sign-in";

export const AUTH_BASE_PATH = "/api/auth";

/** Sign-in codes (D-030): 6 digits, valid 10 minutes, 3 wrong attempts each. */
export const SIGN_IN_CODE = { length: 6, expiresInS: 10 * 60, allowedAttempts: 3 } as const;

const SEND_CODE_PATH = "/email-otp/send-verification-otp";

/**
 * Better Auth for one request (D-006). Built per request because the database client is, so the
 * closure state below lives for one request only.
 *
 * Guest accounts come first: a player arriving from a stream link plays before signing up. Signing
 * in with a code then archives the guest and moves its game in our own transaction (D-030): the
 * plugin's default would delete the guest, and its cards with it, by cascade.
 */
export function createAuth(env: Env, db: Database, emailSender: EmailSender) {
  // Better Auth logs and swallows errors thrown while sending (`runInBackgroundOrAwait`): the
  // failure is noted here and turned into an error response by the hook below (fails closed).
  let sendFailure: unknown = null;

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
    plugins: [
      anonymous({
        disableDeleteAnonymousUser: true,
        onLinkAccount: (data) => linkGuestOnSignIn(db, data),
      }),
      emailOTP({
        otpLength: SIGN_IN_CODE.length,
        expiresIn: SIGN_IN_CODE.expiresInS,
        allowedAttempts: SIGN_IN_CODE.allowedAttempts,
        // A database leak must not reveal codes still valid.
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          try {
            await emailSender.sendSignInCode({ to: email, code: otp });
          } catch (error) {
            sendFailure = error;
            throw error;
          }
        },
      }),
    ],
    user: {
      // "J'ai 15 ans ou plus" (P8): required to create an account with a code, never stored.
      // Apple and Google will pass it through their OAuth state.
      validateUserInfo({ source }, ctx) {
        if (source.action !== "create-user" || source.method !== "email-otp") return;
        if (readBodyFlag(ctx.body, "ageConfirmed")) return;
        return {
          error: ACCOUNT_ERROR_CODES.ageConfirmationRequired,
          errorDescription: "Creating an account requires being 15 or older",
        };
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Only the address is kept: no name or picture, whatever the client or provider sends.
          async before(user) {
            if (user["isAnonymous"] === true) return;
            return { data: { ...user, name: "", image: null } };
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SEND_CODE_PATH || sendFailure === null) return;
        if (!(sendFailure instanceof EmailSenderNotConfiguredError)) {
          console.error("Sign-in code not sent", {
            message: sendFailure instanceof Error ? sendFailure.message : "",
          });
        }
        throw new APIError("SERVICE_UNAVAILABLE", {
          code: ACCOUNT_ERROR_CODES.emailUnavailable,
          message: "The sign-in code could not be sent",
        });
      }),
    },
    session: {
      // Signed cookie that avoids a database lookup on most requests.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Better Auth's limiter keeps counters in memory, which breaks the stateless rule: limits are
    // Cloudflare's (D-018), see `app.ts`.
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
