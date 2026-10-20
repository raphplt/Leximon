import { z } from "zod";

/**
 * Signing up and signing in (D-030): a 6-digit code sent by e-mail, through Better Auth's routes
 * under `/api/auth`. The guest's game follows the player (P37, P54).
 */

/** E-mail addresses are compared lowercase, as Better Auth stores them. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const signInCodeSchema = z.string().regex(/^\d{6}$/);

/** `POST /api/auth/email-otp/send-verification-otp` body. Only sign-in codes are sent. */
export const sendSignInCodeRequestSchema = z.object({
  email: emailSchema,
  type: z.literal("sign-in"),
});
export type SendSignInCodeRequest = z.input<typeof sendSignInCodeRequestSchema>;

/** `POST /account/link-preview` body: checks the code without using it up. */
export const linkPreviewRequestSchema = z.object({
  email: emailSchema,
  code: signInCodeSchema,
});
export type LinkPreviewRequest = z.input<typeof linkPreviewRequestSchema>;

/**
 * What signing in with this code would do to the guest's game:
 * - `transfer`: new account (or one without any game), everything the guest owns follows (P37);
 * - `abandon`: the account already plays, the guest's cards and mastery will be lost (P54);
 * - `none`: nothing at stake: no guest session, or an empty guest joining an account that plays.
 */
export const guestLinkPreviewOutcomeSchema = z.enum(["transfer", "abandon", "none"]);
export type GuestLinkPreviewOutcome = z.infer<typeof guestLinkPreviewOutcomeSchema>;

/** `POST /account/link-preview`, 200. */
export const linkPreviewResponseSchema = z.object({
  /** An account already uses this address: no age declaration is asked. */
  accountExists: z.boolean(),
  outcome: guestLinkPreviewOutcomeSchema,
  /** Copies the guest owns: they follow (`transfer`) or are lost (`abandon`). */
  guestCards: z.int().nonnegative(),
});
export type LinkPreviewResponse = z.infer<typeof linkPreviewResponseSchema>;

/** `POST /account/link-preview` errors (`{ error }`). */
export const linkPreviewErrorSchema = z.enum([
  "invalid_code",
  "code_expired",
  "too_many_attempts",
  "rate_limited",
]);
export type LinkPreviewError = z.infer<typeof linkPreviewErrorSchema>;

/**
 * `POST /api/auth/sign-in/email-otp` body. Extra fields are read by our hooks:
 * - `ageConfirmed`: "J'ai 15 ans ou plus" (P8), required to create an account, never stored;
 * - `acceptGuestLoss`: the player saw that the guest's cards will be lost, required for `abandon`.
 */
export const emailSignInRequestSchema = z.object({
  email: emailSchema,
  otp: signInCodeSchema,
  ageConfirmed: z.boolean().optional(),
  acceptGuestLoss: z.boolean().optional(),
});
export type EmailSignInRequest = z.input<typeof emailSignInRequestSchema>;

/** Error codes of the sign-in, besides Better Auth's (`INVALID_OTP`, `OTP_EXPIRED`…). */
export const ACCOUNT_ERROR_CODES = {
  /** A new account needs the age declaration. The code is used up: ask for a new one. */
  ageConfirmationRequired: "AGE_CONFIRMATION_REQUIRED",
  /** The guest would be abandoned without `acceptGuestLoss`. The player stays a guest. */
  guestLossNotAcknowledged: "GUEST_LOSS_NOT_ACKNOWLEDGED",
  /** The guest's game could not be moved. The player stays a guest and can try again. */
  accountLinkFailed: "ACCOUNT_LINK_FAILED",
  /** No e-mail provider is configured: no code can be sent (fails closed). */
  emailUnavailable: "EMAIL_UNAVAILABLE",
} as const;

/** Errors of Better Auth's routes, ours included. */
export const authErrorResponseSchema = z.object({ code: z.string() });
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;

/** `GET /me/account`, 200: who is playing. */
export const accountResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("guest"),
    /** Boosters left before an account is required (P37). */
    boostersLeft: z.number().int().min(0),
  }),
  z.object({ kind: z.literal("member"), email: z.string() }),
]);
export type AccountResponse = z.infer<typeof accountResponseSchema>;
