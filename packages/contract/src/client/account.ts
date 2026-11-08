import {
  type AccountResponse,
  type AppStatusResponse,
  accountResponseSchema,
  appStatusResponseSchema,
  type EmailPreferences,
  type EmailSignInRequest,
  emailPreferencesSchema,
  type GoogleLinkRequest,
  type GoogleSignInRequest,
  googleSignInStartSchema,
  type InviteStatus,
  inviteStatusSchema,
  type JoinWaitlistRequest,
  type LinkPreviewError,
  type LinkPreviewResponse,
  linkPreviewErrorSchema,
  linkPreviewResponseSchema,
  type SendCodeRefusal,
  SIGN_IN_CODE_QUOTA_ERROR,
  UNDELIVERABLE_EMAIL_ERROR,
  type UnsubscribeStopped,
  type UpdateEmailPreferencesRequest,
  unsubscribeResponseSchema,
} from "../index";
import { ApiError, authErrorCode, errorCode, type Http, json, parse, segment } from "./http";

export type SendCodeResult =
  | { readonly kind: "sent" }
  | {
      readonly kind: "refused";
      readonly reason: SendCodeRefusal;
    };

export type PreviewResult =
  | ({ readonly kind: "ok" } & LinkPreviewResponse)
  | { readonly kind: "refused"; readonly reason: LinkPreviewError };

export type SignInResult =
  | { readonly kind: "signed_in" }
  /** Better Auth's code (`INVALID_OTP`…) or ours (`ACCOUNT_ERROR_CODES`); "rate_limited" on 429. */
  | { readonly kind: "refused"; readonly code: string };

export type JoinWaitlistResult =
  | { readonly kind: "joined" }
  | { readonly kind: "refused"; readonly reason: "invalid_email" | "rate_limited" }
  /** The game is open: the list took its last address. */
  | { readonly kind: "closed" };

/** Signing in by e-mail code, campaign e-mails, the waiting list and invitations. */
export function accountRoutes(http: Http) {
  const { send, sendAsPlayer, arrival } = http;

  return {
    /** The oldest app version the API still serves. Asked without a session. */
    async fetchAppStatus(): Promise<AppStatusResponse> {
      const response = await send("/app");
      if (!response.ok) throw new ApiError("app_status_unavailable", response.status);
      return parse(response, appStatusResponseSchema);
    },

    /** Who is playing: a guest (created on the first visit) or a member. */
    async fetchAccount(): Promise<AccountResponse> {
      const response = await sendAsPlayer("/me/account");
      if (!response.ok) throw new ApiError("account_unavailable", response.status);
      return parse(response, accountResponseSchema);
    },

    /**
     * Sends a 6-digit sign-in code to the address. It brings the invitation, if any: during the
     * closed beta, an address without an account gets a code only with one.
     */
    async sendSignInCode(email: string): Promise<SendCodeResult> {
      const response = await send(
        "/api/auth/email-otp/send-verification-otp",
        json("POST", { email, type: "sign-in" }, arrival.headers()),
      );
      if (response.ok) return { kind: "sent" };
      if (response.status === 400) {
        const undeliverable = (await errorCode(response)) === UNDELIVERABLE_EMAIL_ERROR;
        return { kind: "refused", reason: undeliverable ? "undeliverable_email" : "invalid_email" };
      }
      if (response.status === 429) {
        const daily = (await errorCode(response)) === SIGN_IN_CODE_QUOTA_ERROR;
        return { kind: "refused", reason: daily ? "daily_limit" : "rate_limited" };
      }
      if (response.status === 503) return { kind: "refused", reason: "unavailable" };
      throw new ApiError("code_not_sent", response.status);
    },

    /** Checks the code, without using it up, and tells what signing in does to the guest's game. */
    async previewSignIn(email: string, code: string): Promise<PreviewResult> {
      const response = await send(
        "/account/link-preview",
        json("POST", { email, code }, arrival.headers()),
      );
      if (response.ok) return { kind: "ok", ...(await parse(response, linkPreviewResponseSchema)) };
      if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
      const reason = linkPreviewErrorSchema.safeParse(await errorCode(response));
      if (reason.success) return { kind: "refused", reason: reason.data };
      throw new ApiError("preview_failed", response.status);
    },

    /** Signs in with the code. The server moves or leaves the guest's game in the same request. */
    async signInWithCode(request: EmailSignInRequest): Promise<SignInResult> {
      // A sign-in without a guest may create a player: it brings the invitation, if any.
      const response = await send(
        "/api/auth/sign-in/email-otp",
        json("POST", request, arrival.headers()),
      );
      if (response.ok) {
        arrival.forget();
        return { kind: "signed_in" };
      }
      if (response.status === 429) return { kind: "refused", code: "rate_limited" };
      const code = await authErrorCode(response);
      if (code !== null) return { kind: "refused", code };
      throw new ApiError("sign_in_failed", response.status);
    },

    /**
     * Asks for the trip to Google and returns Google's page, where the client sends the player.
     * It brings the invitation, if any: the account may be created on the way back.
     */
    async startGoogleSignIn(request: GoogleSignInRequest): Promise<string> {
      const body = {
        provider: "google",
        callbackURL: request.callbackURL,
        errorCallbackURL: request.errorCallbackURL,
        disableRedirect: true,
        ...(request.signUp ? { requestSignUp: true } : {}),
        additionalData: request.declared,
      };
      const response = await send(
        "/api/auth/sign-in/social",
        json("POST", body, arrival.headers()),
      );
      if (!response.ok) throw new ApiError("google_unavailable", response.status);
      return (await parse(response, googleSignInStartSchema)).url;
    },

    /** Asks for the trip to Google that adds it to the signed-in member, and returns its page. */
    async startGoogleLink(request: GoogleLinkRequest): Promise<string> {
      const body = {
        provider: "google",
        callbackURL: request.callbackURL,
        errorCallbackURL: request.errorCallbackURL,
        disableRedirect: true,
      };
      const response = await send("/api/auth/link-social", json("POST", body));
      if (!response.ok) throw new ApiError("google_unavailable", response.status);
      return (await parse(response, googleSignInStartSchema)).url;
    },

    async signOut(): Promise<void> {
      const response = await send("/api/auth/sign-out", json("POST", {}));
      if (!response.ok) throw new ApiError("sign_out_failed", response.status);
    },

    /** Whether the member asked for news by e-mail. */
    async fetchEmailPreferences(): Promise<EmailPreferences> {
      const response = await send("/me/email-preferences");
      if (!response.ok) throw new ApiError("preferences_unavailable", response.status);
      return parse(response, emailPreferencesSchema);
    },

    /** Gives or withdraws consent; `source` is kept as proof of where it was given. */
    async setEmailPreferences(request: UpdateEmailPreferencesRequest): Promise<EmailPreferences> {
      const response = await send("/me/email-preferences", json("POST", request));
      if (!response.ok) throw new ApiError("preferences_unavailable", response.status);
      return parse(response, emailPreferencesSchema);
    },

    /** Unsubscribes the recipient of an e-mail, from the token of its link. No session. */
    async unsubscribeFromLink(token: string): Promise<UnsubscribeStopped | "invalid"> {
      const response = await send(`/email/unsubscribe/${segment(token)}`, { method: "POST" });
      if (response.ok) return (await parse(response, unsubscribeResponseSchema)).stopped;
      if (response.status === 400) return "invalid";
      throw new ApiError("unsubscribe_unavailable", response.status);
    },

    /** Puts the address on the list warned when the game opens. No session: no player created. */
    async joinWaitlist(email: string): Promise<JoinWaitlistResult> {
      const response = await send(
        "/waitlist",
        json("POST", { email } satisfies JoinWaitlistRequest),
      );
      if (response.ok) return { kind: "joined" };
      if (response.status === 400) return { kind: "refused", reason: "invalid_email" };
      if (response.status === 429) return { kind: "refused", reason: "rate_limited" };
      if (response.status === 410) return { kind: "closed" };
      throw new ApiError("waitlist_unavailable", response.status);
    },

    /** Whether an invitation link still lets someone in. */
    async fetchInviteStatus(code: string): Promise<InviteStatus["status"]> {
      const response = await send(`/invites/${segment(code)}`);
      if (!response.ok) throw new ApiError("invite_unavailable", response.status);
      return (await parse(response, inviteStatusSchema)).status;
    },
  };
}
