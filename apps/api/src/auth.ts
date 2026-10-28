import { expo } from "@better-auth/expo";
import { ACCOUNT_ERROR_CODES } from "@leximon/contract";
import { type Database, schema } from "@leximon/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { admin, anonymous, emailOTP } from "better-auth/plugins";
import {
  EmailSendError,
  type EmailSender,
  EmailSenderNotConfiguredError,
} from "./account/email-sender";
import { linkGuestOnSignIn, readBodyFlag } from "./account/link-on-sign-in";
import { reviewSignInCode } from "./account/review-account";
import { recordingEmailSender } from "./account/sign-in-log";
import { type Arrival, admitNewPlayer, recordArrival, wouldAdmitNewPlayer } from "./beta/arrival";
import { invitesRequired } from "./beta/invites";

export const AUTH_BASE_PATH = "/api/auth";

/**
 * Origin the mobile app declares (its URL scheme), in a header Better Auth's Expo plugin reads only
 * when a request has no Origin: browsers always send one, so a web page cannot claim it.
 */
export const MOBILE_APP_ORIGIN = "leximon://";

/** Role that opens the back office, granted only from the command line (`pnpm admin:grant`). */
export const ADMIN_ROLE = "admin";

/** Sign-in codes: 6 digits, valid 10 minutes, 3 wrong attempts each. */
export const SIGN_IN_CODE = { length: 6, expiresInS: 10 * 60, allowedAttempts: 3 } as const;

const SEND_CODE_PATH = "/email-otp/send-verification-otp";

/** The request context Better Auth hands to its callbacks. */
type EndpointContext = Parameters<typeof getSessionFromCtx>[0];

/**
 * Better Auth for one request. Built per request because the database client is, so the
 * closure state below lives for one request only.
 *
 * Guest accounts come first: a player arriving from a stream link plays before signing up. Signing
 * in with a code then archives the guest and moves its game in our own transaction: the
 * plugin's default would delete the guest, and its cards with it, by cascade.
 */
export function createAuth(env: Env, db: Database, provider: EmailSender) {
  const emailSender = recordingEmailSender(provider, db);
  // Better Auth logs and swallows errors thrown while sending (`runInBackgroundOrAwait`): the
  // failure is noted here and turned into an error response by the hook below (fails closed).
  let sendFailure: unknown = null;
  // Who let the new user in (invitation, source), noted before the row exists, written after.
  let arrival: Arrival | null = null;

  /**
   * A code to an address without an account, asked without a guest session nor an open invitation,
   * would end in a refusal once typed: such an address gets the invitation e-mail instead. The
   * answer to the request stays the same, so it tells nobody whether the address has an account.
   */
  async function closedBetaWouldRefuse(
    email: string,
    ctx: EndpointContext | undefined,
  ): Promise<boolean> {
    if (!invitesRequired(env) || ctx === undefined) return false;
    if ((await ctx.context.internalAdapter.findUserByEmail(email)) !== null) return false;
    // From the database, as when the user is created: a replayed guest cookie lets nobody in.
    const session = await getSessionFromCtx(ctx, {
      disableRefresh: true,
      disableCookieCache: true,
    });
    const admitted = await wouldAdmitNewPlayer(db, env, {
      headers: ctx.headers,
      fromGuest: session?.user["isAnonymous"] === true,
      now: Date.now(),
    });
    return !admitted;
  }

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: [...parseOrigins(env.TRUSTED_ORIGINS), MOBILE_APP_ORIGIN],
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
      // The mobile app's session: a cookie it keeps in the device keychain and sends itself.
      expo(),
      anonymous({
        disableDeleteAnonymousUser: true,
        onLinkAccount: (data) => linkGuestOnSignIn(db, data),
      }),
      // Only for its schema (role, ban) and its sign-in refusal of banned players: its endpoints
      // stay unreachable (AUTH_ROUTES in app.ts), the back office has its own routes (/admin).
      admin({
        adminRoles: [ADMIN_ROLE],
        bannedUserMessage:
          "Ce compte a été suspendu. Écris à contact@leximon.fr pour en savoir plus.",
      }),
      emailOTP({
        otpLength: SIGN_IN_CODE.length,
        expiresIn: SIGN_IN_CODE.expiresInS,
        allowedAttempts: SIGN_IN_CODE.allowedAttempts,
        // A database leak must not reveal codes still valid.
        storeOTP: "hashed",
        generateOTP: ({ email, type }) =>
          type === "sign-in" ? reviewSignInCode(env, email, SIGN_IN_CODE.length) : undefined,
        async sendVerificationOTP({ email, otp, type }, ctx) {
          // The reviewers know their code: no e-mail to an inbox nobody reads.
          if (type === "sign-in" && reviewSignInCode(env, email, SIGN_IN_CODE.length)) return;
          try {
            if (await closedBetaWouldRefuse(email, ctx)) {
              await emailSender.sendInvitationOnly({ to: email });
              return;
            }
            await emailSender.sendSignInCode({
              to: email,
              code: otp,
              validMinutes: SIGN_IN_CODE.expiresInS / 60,
            });
          } catch (error) {
            sendFailure = error;
            throw error;
          }
        },
      }),
    ],
    user: {
      // "J'ai 15 ans ou plus": required to create an account with a code, never stored.
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
          async before(user, ctx) {
            const isGuest = user["isAnonymous"] === true;
            // From the database, not the signed cookie: a guest that already became an account
            // has no session left, but its cookie would still read as a guest for minutes and
            // let new accounts in without an invitation.
            const session =
              isGuest || ctx === null
                ? null
                : await getSessionFromCtx(ctx, { disableRefresh: true, disableCookieCache: true });
            arrival = await admitNewPlayer(db, env, {
              headers: ctx?.headers,
              fromGuest: session?.user["isAnonymous"] === true,
              now: Date.now(),
            });
            if (isGuest) return;
            return { data: { ...user, name: "", image: null } };
          },
          async after(user, ctx) {
            if (arrival === null) return;
            await recordArrival(db, {
              userId: user.id,
              isGuest: user["isAnonymous"] === true,
              arrival,
              body: ctx?.body,
              now: Date.now(),
            });
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SEND_CODE_PATH || sendFailure === null) return;
        if (!(sendFailure instanceof EmailSenderNotConfiguredError)) {
          // The provider's code only: its message, like the address, is personal data.
          console.error("Sign-in code not sent", {
            code: sendFailure instanceof EmailSendError ? sendFailure.code : "E_UNKNOWN",
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
    // Cloudflare's, see `app.ts`.
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
